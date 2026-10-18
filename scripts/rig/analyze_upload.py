"""One uploaded original through the content pipeline, on a box the pax2-analyze Lambda starts the
moment the upload's mp4 lands in S3 (requirements 4b and 5 of docs/SPEC.md): a Whisper transcript with
word timings, the measured audio features and frame embeddings of scripts/rig/analyze_common.py.

  env: BUCKET  KEY (uploads/<workspace>/<id>.mp4)  ORIGINAL (the original's id)  TABLE (pax2-ledger)

Writes features/<id>.json to the bucket, the full feature record in the shape of data/generated/
features.json, and one "analyzed" event on the original in DynamoDB (pk ORIG#<id>, sk EVENT#<iso>),
write-once like src/lib/originals.ts addEvent, carrying the transcript text and words, the audio
summary and the first frame's memorability, so the video page and the next score can read them
without S3. Exit code is the last line of the log.
"""
import json, os, sys, tempfile, time

import boto3

from analyze_common import audio_features, frame_features, load_models, log, pegasus, transcribe

BUCKET = os.environ["BUCKET"]
KEY = os.environ["KEY"]
ORIGINAL = os.environ["ORIGINAL"]
TABLE = os.environ.get("TABLE", "pax2-ledger")
s3 = boto3.client("s3", region_name="us-east-1")
ddb = boto3.client("dynamodb", region_name="us-east-1")

t0 = time.time()
work = tempfile.mkdtemp(prefix="an-")
local = os.path.join(work, os.path.basename(KEY))
s3.download_file(BUCKET, KEY, local)
log(f"analyze: {KEY} ({os.path.getsize(local)} bytes) for original {ORIGINAL}")

whisper, clip, preprocess, resmem = load_models()
log(f"analyze: models loaded in {time.time() - t0:.0f}s")

feat = {"take": ORIGINAL, "key": KEY, "analyzedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "provenance": "upload", "by": "pax2-analyze"}
errors = []
try:
    feat["audio"] = audio_features(local, work)
except Exception as e:
    feat["audio"] = {"error": str(e)[:200]}
    errors.append("audio")
try:
    rec = transcribe(whisper, local)
    feat["transcript"] = {"source": "derived", "model": "whisper-small", **rec}
except Exception as e:
    feat["transcript"] = {"error": str(e)[:200]}
    errors.append("transcript")
try:
    feat["frames"] = frame_features(local, work, clip, preprocess, resmem)
except Exception as e:
    feat["frames"] = {"error": str(e)[:200]}
    errors.append("frames")
# Pegasus reads the video itself, as the worker did for the 40 campaign shorts: about 4 cents a video.
if os.environ.get("PEGASUS", "1") != "0":
    try:
        tp = time.time()
        feat["pegasus"] = {"source": "ai", **pegasus(BUCKET, KEY)}
        log(f"analyze: pegasus {'ok' if feat['pegasus'].get('ok') else 'unparsed'} in {time.time() - tp:.0f}s")
    except Exception as e:
        feat["pegasus"] = {"error": str(e)[:300]}
        errors.append("pegasus")
        log(f"analyze: pegasus failed: {str(e)[:200]}")

out_key = f"features/{ORIGINAL}.json"
s3.put_object(Bucket=BUCKET, Key=out_key, Body=json.dumps(feat).encode(), ContentType="application/json")
log(f"analyze: wrote s3://{BUCKET}/{out_key}")

# The event: what the app reads. Numbers the Scored tab shows and the transcript the next score reads;
# the frame embeddings stay in S3.
a = feat.get("audio") or {}
t = feat.get("transcript") or {}
f = feat.get("frames") or {}
loud = a.get("loudnessDb") or []
summary = {
    "durationSec": a.get("durationSec"),
    "words": len(t.get("words") or []) or None,
    "wpm": t.get("wpm"),
    "firstWordSec": t.get("firstWordSec"),
    "language": t.get("language"),
    "pauses": len(a.get("pauses") or []) if a.get("pauses") is not None else None,
    "longestPauseSec": max((p["sec"] for p in a.get("pauses") or []), default=None),
    "loudnessRangeDb": round(max(loud) - min(loud), 1) if len(loud) > 1 else None,
    "pitchMedianHz": a.get("pitchMedianHz"),
    "pitchRangeHz": a.get("pitchRangeHz"),
    "memorability": f.get("memorability"),
    "frames": f.get("n"),
}
pg = (feat.get("pegasus") or {}).get("result") or {}
if pg:
    d, s, ch, hk = pg.get("delivery") or {}, pg.get("semantics") or {}, pg.get("characteristics") or {}, pg.get("hook") or {}
    summary["delivery"] = {
        "energy": d.get("energy"),
        "vocalTone": d.get("vocal_tone"),
        "directAddress": d.get("direct_address"),
        "frame": s.get("frame"),
        "firstPerson": s.get("first_person"),
        "questionLed": s.get("question_led"),
        "coreClaim": s.get("core_claim"),
        "hook": hk.get("text"),
        "hookAt": hk.get("t"),
        "pace": ch.get("pace"),
        "captions": ch.get("captions"),
        "callToAction": ch.get("call_to_action"),
        "visualVariety": ch.get("visual_variety"),
        "summary": pg.get("summary"),
    }
at = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + f".{int((time.time() % 1) * 1000):03d}Z"
item = {
    "pk": {"S": f"ORIG#{ORIGINAL}"},
    "sk": {"S": f"EVENT#{at}"},
    "at": {"S": at},
    "kind": {"S": "analyzed"},
    "by": {"S": "pax2-analyze"},
    "key": {"S": out_key},
    "seconds": {"N": str(round(time.time() - t0))},
    "summary": {"S": json.dumps(summary)},
    "transcript": {"S": (t.get("text") or "")[:20000]},
    "transcriptWords": {"S": json.dumps([{"t": w["t"], "w": w["w"]} for w in (t.get("words") or [])])[:200000]},
}
if errors:
    item["errors"] = {"S": ",".join(errors)}
ddb.put_item(TableName=TABLE, Item=item, ConditionExpression="attribute_not_exists(pk)")
log(f"analyze: event ORIG#{ORIGINAL} EVENT#{at} written; {time.time() - t0:.0f}s; errors: {errors or 'none'}")
sys.exit(1 if len(errors) == 3 else 0)
