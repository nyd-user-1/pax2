"""The content measurements PAX2 takes from a video file, shared by scripts/rig/transcribe.py (the
Voter Freedom originals in bulk) and scripts/rig/analyze_upload.py (one upload, started by the
pax2-analyze Lambda). One definition (rig rule 15): the same numbers worker/analyze_organic.py
produced for the 40 campaign shorts, so content features compare across every video PAX2 has.

  audio_features(mp4, work)   loudness by second, pitch by second, pauses, loudest and quietest seconds
  frame_features(mp4, work, clip, preprocess, resmem)   CLIP ViT-B-32 on one frame every five seconds,
                                                        ResMem memorability of the first frame
  transcribe(whisper, mp4)    faster-whisper small, word timings, words a minute, first word's second
"""
import os, re, subprocess, time, wave

import numpy as np


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


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


def frame_features(mp4, work, clip, preprocess, resmem):
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


def transcribe(whisper, mp4):
    """faster-whisper with word timings; the words, their pace and where the first one lands."""
    segments, info = whisper.transcribe(mp4, beam_size=1, vad_filter=True, word_timestamps=True)
    words = []
    for s in segments:
        for w in s.words or []:
            words.append({"t": round(w.start, 2), "end": round(w.end, 2), "w": w.word.strip()})
    text = re.sub(r"\s+", " ", " ".join(w["w"] for w in words)).strip()
    return {
        "text": text,
        "words": words,
        "wpm": round(len(words) / max(1e-6, (words[-1]["end"] - words[0]["t"]) / 60), 1) if words else None,
        "firstWordSec": words[0]["t"] if words else None,
        "durationSec": round(info.duration, 1),
        "language": info.language,
    }


def load_models():
    """Whisper small (CPU, int8), CLIP ViT-B-32 and, when it installs, ResMem."""
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
    return whisper, clip, preprocess, resmem
