"""PAX worker job 5: analyze every video in s3://pax-638175140432/videos/ and write features/<take>.json.

Each feature carries its provenance so the interface can keep them apart:
  platform-free measurements  -> "derived"  (ffmpeg loudness, pauses, pace)
  speech-to-text              -> "derived"  (Amazon Transcribe word timings)
  vision                      -> "ai"       (Rekognition shots and on-screen text; Pegasus observations)
Usage: python3 analyze.py [take-id ...]
"""
import json, os, re, subprocess, sys, time, uuid
import boto3, numpy as np

B = "pax-638175140432"
R = "us-east-1"
s3 = boto3.client("s3", region_name=R)
tr = boto3.client("transcribe", region_name=R)
rk = boto3.client("rekognition", region_name=R)
br = boto3.client("bedrock-runtime", region_name=R)
D = "/opt/pax/analyze"
os.makedirs(D, exist_ok=True)


def takes():
    keys = [o["Key"] for o in s3.list_objects_v2(Bucket=B, Prefix="videos/").get("Contents", []) if o["Key"].endswith(".mp4")]
    return [k.split("/")[-1][:-4] for k in keys]


def start_transcribe(tid):
    name = f"pax-{tid}-{uuid.uuid4().hex[:6]}"
    tr.start_transcription_job(TranscriptionJobName=name, LanguageCode="en-US", Media={"MediaFileUri": f"s3://{B}/videos/{tid}.mp4"}, OutputBucketName=B, OutputKey=f"transcribe/{tid}.json")
    return name


def start_rek(tid):
    v = {"S3Object": {"Bucket": B, "Name": f"videos/{tid}.mp4"}}
    seg = rk.start_segment_detection(Video=v, SegmentTypes=["SHOT", "TECHNICAL_CUE"])["JobId"]
    txt = rk.start_text_detection(Video=v)["JobId"]
    return seg, txt


def wait_transcribe(name):
    while True:
        j = tr.get_transcription_job(TranscriptionJobName=name)["TranscriptionJob"]
        if j["TranscriptionJobStatus"] in ("COMPLETED", "FAILED"):
            return j["TranscriptionJobStatus"]
        time.sleep(5)


def wait_rek(fn, job):
    out, token = [], None
    while True:
        r = fn(JobId=job, **({"NextToken": token} if token else {}))
        if r["JobStatus"] == "IN_PROGRESS":
            time.sleep(5)
            continue
        if r["JobStatus"] == "FAILED":
            return None, r
        out.append(r)
        token = r.get("NextToken")
        if not token:
            return out, None


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
    # Pitch by autocorrelation over voiced frames (80–400 Hz).
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
    # The loudest and quietest sustained seconds, the moments to look at.
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
 "accessibility": [str]}
Rules: describe only what is visible or audible, with times in seconds. Do not guess anyone's race, ethnicity, age or gender. Keep each field under 30 words."""


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


ids = sys.argv[1:] or takes()
jobs = {}
for tid in ids:
    jobs[tid] = {"tr": start_transcribe(tid), "rek": start_rek(tid)}
    print("started", tid, flush=True)
for tid in ids:
    feat = {"take": tid, "analyzedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    try:
        feat["audio"] = {"source": "derived", **audio_features(tid)}
    except Exception as e:
        feat["audio"] = {"error": repr(e)[:300]}
    st = wait_transcribe(jobs[tid]["tr"])
    if st == "COMPLETED":
        t = json.loads(s3.get_object(Bucket=B, Key=f"transcribe/{tid}.json")["Body"].read())
        items = t["results"]["items"]
        words = [{"t": float(i["start_time"]), "end": float(i["end_time"]), "w": i["alternatives"][0]["content"], "conf": float(i["alternatives"][0]["confidence"])} for i in items if i["type"] == "pronunciation"]
        feat["transcript"] = {"source": "derived", "text": t["results"]["transcripts"][0]["transcript"], "words": words, "wpm": round(len(words) / max(1e-6, (words[-1]["end"] - words[0]["t"]) / 60), 1) if words else None, "firstWordSec": words[0]["t"] if words else None}
    else:
        feat["transcript"] = {"error": st}
    seg, err = wait_rek(rk.get_segment_detection, jobs[tid]["rek"][0])
    feat["shots"] = {"source": "ai", "segments": [{"type": s["Type"], "start": s["StartTimestampMillis"] / 1000, "end": s["EndTimestampMillis"] / 1000, "kind": (s.get("TechnicalCueSegment") or {}).get("Type")} for p in (seg or []) for s in p.get("Segments", [])]} if seg else {"error": str(err)[:300]}
    txt, err = wait_rek(rk.get_text_detection, jobs[tid]["rek"][1])
    if txt:
        lines = {}
        for p in txt:
            for d in p.get("TextDetections", []):
                td = d["TextDetection"]
                if td["Type"] == "LINE" and td["Confidence"] > 85:
                    sec = int(d["Timestamp"] / 1000)
                    lines.setdefault(sec, set()).add(td["DetectedText"])
        feat["onScreenText"] = {"source": "ai", "bySecond": {str(k): sorted(v) for k, v in sorted(lines.items())}, "secondsWithText": len(lines)}
    else:
        feat["onScreenText"] = {"error": str(err)[:300]}
    try:
        feat["pegasus"] = {"source": "ai", "model": "twelvelabs.pegasus-1-2", **pegasus(tid)}
    except Exception as e:
        feat["pegasus"] = {"error": repr(e)[:400]}
    s3.put_object(Bucket=B, Key=f"features/{tid}.json", Body=json.dumps(feat).encode())
    print("done", tid, flush=True)
print("all done", flush=True)
