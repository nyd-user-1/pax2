"""Original videos uploaded to S3, through the content pipeline on the CPU box: a Whisper transcript
with word timings, the measured audio features worker/analyze_organic.py produces (loudness, pitch,
pauses), and frame embeddings for the content model (CLIP ViT-B-32 on one frame every five seconds,
plus ResMem memorability of the first frame). Each file is matched to its YouTube id by title.

Input:  every video or zip under s3://<bucket>/uploads/voter-freedom/ (Frame.io downloads Brendan
        copied to S3; nothing comes from YouTube), and the title lists under its meta/ prefix.
Output, under the rig prefix:
  transcripts-voter-freedom.json   { "<file>": { text, words, wpm, firstWordSec, durationSec, language, youtubeId, matchedBy } }
  features-voter-freedom.json      { "yt-<id>": { take, analyzedAt, audio{...as features.json}, transcript{...}, frames{ n, first: [...], mean: [...], memorability } } }
  unmatched.json                   files no title matched
Matching: letters and digits only, lowercased, the file's duration and "4x5" tags dropped, against the
catalog titles and the paid creative names; exact first, then the closest by difflib ratio, 0.55 or better.
"""
import json, os, re, subprocess, tempfile, time, zipfile, wave
import boto3, numpy as np

from common import BUCKET, dump, get_json, log

s3 = boto3.client("s3", region_name="us-east-1")
SRC = "uploads/voter-freedom/"
VIDEO_EXT = (".mp4", ".mov", ".m4v", ".webm", ".mkv")

def norm(s):
    s = os.path.splitext(os.path.basename(s))[0].lower()
    s = re.sub(r"[-_ ]?\d+m?\d*s[-_ ]?", " ", s)
    s = s.replace("4x5", " ").replace("9x16", " ")
    return re.sub(r"[^a-z0-9]+", "", s)

uploads = get_json(SRC + "meta/voter-freedom.json")["videos"]
paid = get_json(SRC + "meta/voter-freedom-paid.json")["creatives"]
titles = {norm(v["title"]): v["id"] for v in uploads}
for c in paid:
    titles.setdefault(norm(c["name"]), c["videoId"])

def match(name):
    """Exact normalized match first; otherwise the closest title by difflib ratio at 0.55 or better."""
    import difflib
    n = norm(name)
    if n in titles:
        return titles[n], "exact"
    best, score = None, 0.0
    for t, yid in titles.items():
        r = difflib.SequenceMatcher(None, n, t).ratio()
        if r > score:
            best, score = yid, r
    return (best, f"ratio {score:.2f}") if best and score >= 0.55 else (None, None)

def run(*a):
    subprocess.run(list(a), check=True, capture_output=True)

def audio_features(mp4, work):
    """The same measurements as worker/analyze_organic.py, from a 16 kHz mono wav."""
    wav = os.path.join(work, "a.wav")
    run("ffmpeg", "-y", "-loglevel", "error", "-i", mp4, "-ac", "1", "-ar", "16000", wav)
    w = wave.open(wav)
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    sr = 16000
    hop = sr // 10
    frames = [x[i:i + hop] for i in range(0, len(x) - hop, hop)]
    rms = np.array([np.sqrt(np.mean(f ** 2)) + 1e-9 for f in frames])
    db = 20 * np.log10(rms)
    pitch = []
    for f in frames:
        if np.sqrt(np.mean(f ** 2)) < 0.01:
            pitch.append(None)
            continue
        f = f - f.mean()
        ac = np.correlate(f, f, mode="full")[len(f) - 1:]
        lo, hi = sr // 400, sr // 80
        lag = lo + int(np.argmax(ac[lo:hi]))
        pitch.append(round(sr / lag, 1) if ac[lag] > 0.3 * ac[0] else None)
    voiced = [p for p in pitch if p]
    silent = db < (np.median(db) - 18)
    pauses, runlen = [], 0
    for i, s in enumerate(silent):
        if s:
            runlen += 1
        else:
            if runlen >= 3:
                pauses.append({"t": round((i - runlen) / 10, 1), "sec": round(runlen / 10, 1)})
            runlen = 0
    sec_db = [float(np.mean(db[i:i + 10])) for i in range(0, len(db) - 10, 10)]
    peaks = sorted(range(len(sec_db)), key=lambda i: -sec_db[i])[:3]
    lows = sorted(range(len(sec_db)), key=lambda i: sec_db[i])[:3]
    pitch_sec = []
    for i in range(0, len(pitch), 10):
        vs = [p for p in pitch[i:i + 10] if p]
        pitch_sec.append(round(float(np.median(vs)), 1) if vs else None)
    return {
        "source": "derived",
        "durationSec": round(len(x) / sr, 2),
        "loudnessDb": [round(v, 1) for v in sec_db],
        "pitchHz": pitch_sec,
        "pitchMedianHz": round(float(np.median(voiced)), 1) if voiced else None,
        "pitchRangeHz": [round(float(np.percentile(voiced, 10)), 1), round(float(np.percentile(voiced, 90)), 1)] if voiced else None,
        "pauses": pauses,
        "loudestSec": sorted(peaks),
        "quietestSec": sorted(lows),
    }

def frame_features(mp4, work, clip, preprocess, tokenizer_unused, resmem):
    """One frame every five seconds, CLIP ViT-B-32 embeddings; memorability of the first frame."""
    import torch
    from PIL import Image
    fdir = os.path.join(work, "frames")
    os.makedirs(fdir, exist_ok=True)
    for f in os.listdir(fdir):
        os.remove(os.path.join(fdir, f))
    run("ffmpeg", "-y", "-loglevel", "error", "-i", mp4, "-vf", "fps=1/5,scale=320:-1", os.path.join(fdir, "f%03d.jpg"))
    paths = sorted(os.path.join(fdir, f) for f in os.listdir(fdir))
    if not paths:
        return None
    ims = torch.stack([preprocess(Image.open(p).convert("RGB")) for p in paths])
    with torch.no_grad():
        emb = clip.encode_image(ims)
        emb = emb / emb.norm(dim=-1, keepdim=True)
    emb = emb.numpy()
    mem = None
    if resmem is not None:
        try:
            from resmem import transformer as rtf
            img = rtf(Image.open(paths[0]).convert("RGB")).unsqueeze(0)
            with torch.no_grad():
                mem = round(float(resmem(img).item()), 4)
        except Exception as e:
            log(f"memorability failed: {str(e)[:120]}")
    return {"n": len(paths), "everySec": 5, "first": [round(float(v), 5) for v in emb[0]], "mean": [round(float(v), 5) for v in emb.mean(0)], "memorability": mem, "model": "open_clip ViT-B-32 openai"}

# ---------- gather the files ----------
work = tempfile.mkdtemp(prefix="vf-")
files = []
keys = [o["Key"] for p in s3.get_paginator("list_objects_v2").paginate(Bucket=BUCKET, Prefix=SRC) for o in p.get("Contents", []) if not o["Key"].startswith(SRC + "meta/")]
log(f"originals: {len(keys)} objects under {SRC}")
for k in keys:
    local = os.path.join(work, os.path.basename(k))
    s3.download_file(BUCKET, k, local)
    if local.lower().endswith(".zip"):
        with zipfile.ZipFile(local) as z:
            for m in z.namelist():
                if m.lower().endswith(VIDEO_EXT) and not os.path.basename(m).startswith("."):
                    z.extract(m, work)
                    files.append(os.path.join(work, m))
    elif local.lower().endswith(VIDEO_EXT):
        files.append(local)
log(f"originals: {len(files)} video files")

# ---------- models ----------
from faster_whisper import WhisperModel
whisper = WhisperModel("small", device="cpu", compute_type="int8")
import open_clip
clip, _, preprocess = open_clip.create_model_and_transforms("ViT-B-32", pretrained="openai")
clip.eval()
resmem = None
try:
    from resmem import ResMem
    resmem = ResMem(pretrained=True).eval()
except Exception as e:
    log(f"resmem unavailable: {str(e)[:120]}")

transcripts, features, unmatched = {}, {}, []
for i, f in enumerate(sorted(files)):
    name = os.path.basename(f)
    yid, how = match(name)
    rec = {"youtubeId": yid, "matchedBy": how, "source": "whisper-small"}
    try:
        segments, info = whisper.transcribe(f, beam_size=1, vad_filter=True, word_timestamps=True)
        words = []
        for s in segments:
            for w in s.words or []:
                words.append({"t": round(w.start, 2), "end": round(w.end, 2), "w": w.word.strip()})
        text = re.sub(r"\s+", " ", " ".join(w["w"] for w in words)).strip()
        rec.update({
            "text": text,
            "words": words,
            "wpm": round(len(words) / max(1e-6, (words[-1]["end"] - words[0]["t"]) / 60), 1) if words else None,
            "firstWordSec": words[0]["t"] if words else None,
            "durationSec": round(info.duration, 1),
            "language": info.language,
        })
    except Exception as e:
        rec.update({"text": None, "error": str(e)[:200]})
    transcripts[name] = rec
    if not yid:
        unmatched.append(name)
    feat = {"take": f"yt-{yid}" if yid else name, "file": name, "analyzedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "provenance": "frame.io original"}
    try:
        feat["audio"] = audio_features(f, work)
    except Exception as e:
        feat["audio"] = {"error": str(e)[:200]}
    if rec.get("text") is not None:
        feat["transcript"] = {"source": "derived", "model": "whisper-small", "text": rec["text"], "words": [{"t": w["t"], "w": w["w"]} for w in rec["words"]], "wpm": rec["wpm"], "firstWordSec": rec["firstWordSec"]}
    try:
        feat["frames"] = frame_features(f, work, clip, preprocess, None, resmem)
    except Exception as e:
        feat["frames"] = {"error": str(e)[:200]}
    key = feat["take"] if feat["take"] not in features else f"{feat['take']}|{name}"
    features[key] = feat
    log(f"originals: {i + 1}/{len(files)} {name} -> {yid or 'unmatched'} ({len(rec.get('words') or [])} words)")

log(f"originals: done, {sum(1 for v in transcripts.values() if v.get('text'))} transcripts, {len(unmatched)} unmatched")
dump("transcribe", "transcripts-voter-freedom.json", transcripts)
dump("transcribe", "features-voter-freedom.json", features)
dump("transcribe", "unmatched.json", unmatched)
