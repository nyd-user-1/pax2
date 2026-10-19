"""The serving index for PAX2 Encoder (requirement 3): every corpus document embedded by the
fine-tuned weights, written where the analyze chain can pull neighbors for a new original.

  env: BUCKET (pax-2-638175140432)  MODEL_S3 (s3://nsr-embed-v2/pax2/models/<run>/encoder/)
       RUN (the run id, names the output prefix)

Reads  model/encoder-index/corpus.jsonl from BUCKET (uploaded by index-launch.sh)
Writes model/encoder-index/<RUN>/embeddings.npy (float16, L2-normalized, one row per document),
       rows.json ({ id, channelId, family, tier, breakout, label } per row, same order),
       meta.json (counts, model, builtAt). Exit code is the last line of the log.
"""
import json, os, subprocess, time

import boto3
import numpy as np

BUCKET = os.environ["BUCKET"]
MODEL_S3 = os.environ["MODEL_S3"]
RUN = os.environ["RUN"]
s3 = boto3.client("s3", region_name="us-east-1")
log = lambda *a: print(time.strftime("%H:%M:%S"), *a, flush=True)

subprocess.run(["aws", "s3", "cp", "--only-show-errors", "--recursive", MODEL_S3, "/work/model/"], check=True)
s3.download_file(BUCKET, "model/encoder-index/corpus.jsonl", "/work/corpus.jsonl")
docs = [json.loads(l) for l in open("/work/corpus.jsonl") if l.strip()]
log(f"corpus {len(docs)} documents; model from {MODEL_S3}")

from sentence_transformers import SentenceTransformer

model = SentenceTransformer("/work/model", device="cpu")
t0 = time.time()
E = model.encode([d["text"] for d in docs], batch_size=64, normalize_embeddings=True, show_progress_bar=False, convert_to_numpy=True)
log(f"embedded {len(docs)} in {time.time() - t0:.0f}s, shape {E.shape}")

np.save("/work/embeddings.npy", E.astype(np.float16))
rows = [{"id": d["id"], "channelId": d["channelId"], "family": d["family"], "tier": d["tier"], "breakout": d["breakout"], "label": d["text"].split("\n")[0][:90]} for d in docs]
json.dump(rows, open("/work/rows.json", "w"))
json.dump({"n": len(rows), "dim": int(E.shape[1]), "model": MODEL_S3, "run": RUN, "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}, open("/work/meta.json", "w"), indent=1)
for f in ("embeddings.npy", "rows.json", "meta.json"):
    s3.upload_file(f"/work/{f}", BUCKET, f"model/encoder-index/{RUN}/{f}")
log(f"uploaded to s3://{BUCKET}/model/encoder-index/{RUN}/")
log("EXIT=0")
