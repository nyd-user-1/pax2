"""PAX2 worker: analyze campaign shorts in s3://pax-2-638175140432/videos/.

The same checks as analyze.py (Pegasus covers text overlays, pace and visual variety). For
organic shorts pulled from the campaigns' own channels: transcript, Pegasus review, measured sound. Writes features/<take>.json and
the same jobs/status.json the Pipeline page reads.

Usage: python3 analyze_organic.py <take-id ...>
"""
import json, os, re, subprocess, sys, time, uuid
import boto3, numpy as np

B = "pax-2-638175140432"
R = "us-east-1"
s3 = boto3.client("s3", region_name=R)
tr = boto3.client("transcribe", region_name=R)
br = boto3.client("bedrock-runtime", region_name=R)
D = "/opt/pax2/analyze"
os.makedirs(D, exist_ok=True)


def start_transcribe(tid):
    name = f"pax2-{tid}-{uuid.uuid4().hex[:6]}"
    tr.start_transcription_job(TranscriptionJobName=name, LanguageCode="en-US", Media={"MediaFileUri": f"s3://{B}/videos/{tid}.mp4"}, OutputBucketName=B, OutputKey=f"transcribe/{tid}.json")
    return name


def wait_transcribe(name):
    while True:
        j = tr.get_transcription_job(TranscriptionJobName=name)["TranscriptionJob"]
        if j["TranscriptionJobStatus"] in ("COMPLETED", "FAILED"):
            return j["TranscriptionJobStatus"]
        time.sleep(5)


def audio_features(tid):
    mp4 = f"{D}/{tid}.mp4"
    s3.download_file(B, f"videos/{tid}.mp4", mp4)
    wav = f"{D}/{tid}.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", mp4, "-ac", "1", "-ar", "16000", wav], check=True)
    import wave
    w = wave.open(wav)
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    sr = 16000
    hop = sr // 10  # 100 ms
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
    pauses, run = [], 0
    for i, s in enumerate(silent):
        if s:
            run += 1
        else:
            if run >= 3:
                pauses.append({"t": round((i - run) / 10, 1), "sec": round(run / 10, 1)})
            run = 0
    sec_db = [float(np.mean(db[i:i + 10])) for i in range(0, len(db) - 10, 10)]
    peaks = sorted(range(len(sec_db)), key=lambda i: -sec_db[i])[:3]
    lows = sorted(range(len(sec_db)), key=lambda i: sec_db[i])[:3]
    pitch_sec = []
    for i in range(0, len(pitch), 10):
        vs = [p for p in pitch[i:i + 10] if p]
        pitch_sec.append(round(float(np.median(vs)), 1) if vs else None)
    return {
        "durationSec": round(len(x) / sr, 2),
        "loudnessDb": [round(v, 1) for v in sec_db],
        "pitchHz": pitch_sec,
        "pitchMedianHz": round(float(np.median(voiced)), 1) if voiced else None,
        "pitchRangeHz": [round(float(np.percentile(voiced, 10)), 1), round(float(np.percentile(voiced, 90)), 1)] if voiced else None,
        "pauses": pauses,
        "loudestSec": sorted(peaks),
        "quietestSec": sorted(lows),
    }


PEGASUS_PROMPT = """You are reviewing a short vertical advocacy video for a partner organization.
Return JSON only, no prose, with this shape:
{"summary": str,
 "hook": {"t": number, "text": str, "assessment": str},
 "observations": [{"t": number, "end": number, "what": str}],
 "characteristics": {"setting": str, "on_screen_people": str, "captions": str, "text_overlays": str, "music": str, "pace": str, "call_to_action": str, "visual_variety": str},
 "delivery": {"vocal_tone": [str], "energy": "low"|"medium"|"high", "energy_arc": str, "facial_affect_on_hook": str, "direct_address": bool, "sarcasm_or_irony": {"present": bool, "cue": str}},
 "semantics": {"frame": "personal-story"|"explainer"|"call-out"|"news-reaction"|"stat-led"|"testimonial"|"montage", "first_person": bool, "question_led": bool, "core_claim": str},
 "accessibility": [str]}
Rules: describe only what is visible or audible, with times in seconds. Do not guess anyone's race, ethnicity, age or gender. Delivery labels describe the performance, never the person; when the speaker is off-screen or the tone is ambiguous, write "unclear" rather than guessing. vocal_tone uses 1-3 words like urgent, conversational, earnest, deadpan, upbeat, angry, wry. Keep each field under 30 words."""


def pegasus(tid):
    body = {"inputPrompt": PEGASUS_PROMPT, "mediaSource": {"s3Location": {"uri": f"s3://{B}/videos/{tid}.mp4", "bucketOwner": "638175140432"}}, "temperature": 0}
    r = br.invoke_model(modelId="us.twelvelabs.pegasus-1-2-v1:0", body=json.dumps(body))
    j = json.loads(r["body"].read())
    text = j.get("message") or j.get("output") or json.dumps(j)
    m = re.search(r"\{.*\}", text, re.S)
    try:
        return {"ok": True, "result": json.loads(m.group(0)) if m else None, "raw": text[:4000]}
    except Exception:
        return {"ok": False, "raw": text[:4000]}


def have(key):
    try:
        s3.head_object(Bucket=B, Key=key)
        return True
    except Exception:
        return False


ids = sys.argv[1:]
if not ids:
    print("pass take ids explicitly; this job never sweeps the whole videos/ prefix", flush=True)
    sys.exit(1)

STEPS = ["transcribe", "pegasus", "audio"]
now = lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
status = {"startedAt": now(), "updatedAt": now(), "finishedAt": None, "videos": {t: {s: "queued" for s in STEPS} for t in ids}}


def mark(tid, step, state):
    status["videos"][tid][step] = state
    status["updatedAt"] = now()
    s3.put_object(Bucket=B, Key="jobs/status.json", Body=json.dumps(status).encode())


jobs = {}
for tid in ids:
    jobs[tid] = None if have(f"transcribe/{tid}.json") else start_transcribe(tid)
    mark(tid, "transcribe", "running")
    print("started", tid, flush=True)
for tid in ids:
    mark(tid, "audio", "running")
    feat = {"take": tid, "analyzedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    try:
        feat["audio"] = {"source": "derived", **audio_features(tid)}
    except Exception as e:
        feat["audio"] = {"error": repr(e)[:300]}
    mark(tid, "audio", "failed" if "error" in feat["audio"] else "done")
    st = wait_transcribe(jobs[tid]) if jobs[tid] else "COMPLETED"
    if st == "COMPLETED":
        t = json.loads(s3.get_object(Bucket=B, Key=f"transcribe/{tid}.json")["Body"].read())
        items = t["results"]["items"]
        words = [{"t": float(i["start_time"]), "end": float(i["end_time"]), "w": i["alternatives"][0]["content"], "conf": float(i["alternatives"][0]["confidence"])} for i in items if i["type"] == "pronunciation"]
        feat["transcript"] = {"source": "derived", "text": t["results"]["transcripts"][0]["transcript"], "words": words, "wpm": round(len(words) / max(1e-6, (words[-1]["end"] - words[0]["t"]) / 60), 1) if words else None, "firstWordSec": words[0]["t"] if words else None}
    else:
        feat["transcript"] = {"error": st}
    mark(tid, "transcribe", "failed" if "error" in feat["transcript"] else "done")
    mark(tid, "pegasus", "running")
    try:
        feat["pegasus"] = {"source": "ai", "model": "twelvelabs.pegasus-1-2", **pegasus(tid)}
    except Exception as e:
        feat["pegasus"] = {"error": repr(e)[:400]}
    mark(tid, "pegasus", "failed" if "error" in feat["pegasus"] else "done")
    s3.put_object(Bucket=B, Key=f"features/{tid}.json", Body=json.dumps(feat).encode())
    print("done", tid, flush=True)
status["finishedAt"] = now()
s3.put_object(Bucket=B, Key="jobs/status.json", Body=json.dumps(status).encode())
print("all done", flush=True)
