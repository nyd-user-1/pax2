"""PAX2 Encoder's neighbors for one analyzed original (requirement 3): the fine-tuned encoder embeds
the upload's transcript and pulls its nearest training shorts from the serving index, so the record
carries what this video resembles and how those lookalikes performed. Runs as its own process after
analyze_upload.py (the box has 4 GB; the encoder needs ~2.5 of them to itself).

  env: BUCKET  ORIGINAL  TABLE (pax2-ledger)

Reads  model/encoder-index/current.json (absent means the index is not built; exits clean),
       the index under model/encoder-index/<run>/, the weights it names, features/<ORIGINAL>.json.
Query text is the measured transcript capped at 1,200 characters — the corpus documents lead with
title and description, so similarity leans on the spoken words, which carry most of the tokens.
Writes a "neighbors" event on the original and a neighbors section into features/<ORIGINAL>.json.

Also the embedding PAX2 Classifier v3 reads (2026-10-20): the original's text in the corpus's own recipe
(scripts/encoder/corpus.mjs docText: title, then description, then transcript, non-empty parts joined by
newlines, the first 1,200 characters), embedded the way scripts/encoder/index.py embedded the catalog. The
title and description are the META item's title and text (GetItem, scoped to ORIG# keys). Stored on the
event as "embedding" (JSON, 4 decimals) with the index run, so the app reads it only beside the model
fit on that run's index. A failed read skips the embedding, never the neighbors.
"""
import json, os, subprocess, time

import boto3
import numpy as np

BUCKET = os.environ["BUCKET"]
ORIGINAL = os.environ["ORIGINAL"]
TABLE = os.environ.get("TABLE", "pax2-ledger")
K = 20
s3 = boto3.client("s3", region_name="us-east-1")
ddb = boto3.client("dynamodb", region_name="us-east-1")
log = lambda *a: print(time.strftime("%H:%M:%S"), "neighbors:", *a, flush=True)

try:
    ptr = json.loads(s3.get_object(Bucket=BUCKET, Key="model/encoder-index/current.json")["Body"].read())
except Exception:
    log("no current.json; index not built, skipping")
    raise SystemExit(0)

feat_key = f"features/{ORIGINAL}.json"
features = json.loads(s3.get_object(Bucket=BUCKET, Key=feat_key)["Body"].read())
text = ((features.get("transcript") or {}).get("text") or "").strip()[:1200]
if not text:
    log("no transcript text; skipping")
    raise SystemExit(0)

run = ptr["run"]
for f in ("embeddings.npy", "rows.json"):
    s3.download_file(BUCKET, f"model/encoder-index/{run}/{f}", f"/work/{f}")
subprocess.run(["aws", "s3", "cp", "--only-show-errors", "--recursive", ptr["modelS3"], "/work/encoder/"], check=True)
E = np.load("/work/embeddings.npy").astype(np.float32)
rows = json.load(open("/work/rows.json"))
log(f"index {run}: {len(rows)} documents")

from sentence_transformers import SentenceTransformer

encoder = SentenceTransformer("/work/encoder", device="cpu")
q = encoder.encode([text], normalize_embeddings=True, convert_to_numpy=True)[0].astype(np.float32)

embedding = None
try:
    meta = ddb.get_item(TableName=TABLE, Key={"pk": {"S": f"ORIG#{ORIGINAL}"}, "sk": {"S": "META"}}).get("Item", {})
    title = (meta.get("title", {}).get("S") or "").strip()
    description = (meta.get("text", {}).get("S") or "").strip()[:600]  # the training set cuts descriptions at 600
    transcript = ((features.get("transcript") or {}).get("text") or "").strip()
    clean = lambda t: t.encode("utf-8", "replace").decode("utf-8").replace("\ufffd", "").strip()
    doc = "\n".join(p for p in (clean(title), clean(description), clean(transcript)) if p)[:1200]
    if doc:
        v = encoder.encode([doc], normalize_embeddings=True, convert_to_numpy=True)[0].astype(np.float32)
        embedding = [round(float(x), 4) for x in v]
        log(f"embedding: {len(embedding)} dims over {len(doc)} characters (title {bool(title)}, description {bool(description)})")
except Exception as e:
    log(f"embedding skipped: {e}")
sims = E @ q
top = np.argsort(-sims)[:K]
neighbors = [{**rows[int(i)], "sim": round(float(sims[int(i)]), 4)} for i in top]
labeled = [n for n in neighbors if n["breakout"] is not None]
share = round(sum(n["breakout"] for n in labeled) / len(labeled), 3) if labeled else None
log(f"top {K}: outlier share {share}")

at = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
ddb.put_item(
    TableName=TABLE,
    Item={"pk": {"S": f"ORIG#{ORIGINAL}"}, "sk": {"S": f"EVENT#{at}"},
          "kind": {"S": "neighbors"}, "at": {"S": at}, "run": {"S": run},
          "outlierShare": {"N": str(share)} if share is not None else {"NULL": True},
          "neighbors": {"S": json.dumps(neighbors)},
          **({"embedding": {"S": json.dumps(embedding)}} if embedding else {})},
    ConditionExpression="attribute_not_exists(sk)",
)
features["neighbors"] = {"run": run, "at": at, "outlierShare": share, "top": neighbors, **({"embedding": embedding} if embedding else {})}
s3.put_object(Bucket=BUCKET, Key=feat_key, Body=json.dumps(features).encode(), ContentType="application/json")
log("EXIT=0")
