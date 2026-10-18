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
from analyze_common import audio_features, frame_features

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

# audio_features and frame_features live in analyze_common.py, shared with analyze_upload.py (rule 15).

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
