"""The encoder map: the serving index projected to 2-D for cluster display on /graph.

  env: BUCKET  RUN (the index run under model/encoder-index/<RUN>/)

Reads  embeddings.npy and rows.json from the index prefix.
Writes model/encoder-index/<RUN>/map.json: per short { id, x, y, cluster, tier, breakout, family,
       channelId, label }, and clusters[]: { id, n, outlierRate, labels (the three most central
       shorts' labels) }. PCA to 50 dimensions, then UMAP to 2 (cosine metric), then k-means k=40
       on the 50-dimensional PCA. Exit code is the last line of the log.
"""
import json, os, time

import boto3
import numpy as np

BUCKET = os.environ["BUCKET"]
RUN = os.environ["RUN"]
s3 = boto3.client("s3", region_name="us-east-1")
log = lambda *a: print(time.strftime("%H:%M:%S"), *a, flush=True)

for f in ("embeddings.npy", "rows.json"):
    s3.download_file(BUCKET, f"model/encoder-index/{RUN}/{f}", f"/work/{f}")
E = np.load("/work/embeddings.npy").astype(np.float32)
rows = json.load(open("/work/rows.json"))
log(f"index {RUN}: {E.shape}")

from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
import umap

P = PCA(n_components=50, random_state=20261019).fit_transform(E)
log("PCA done")
XY = umap.UMAP(n_components=2, metric="cosine", random_state=20261019).fit_transform(P)
log("UMAP done")
km = KMeans(n_clusters=40, n_init=4, random_state=20261019).fit(P)
log("k-means done")

points = [
    {"id": r["id"], "x": round(float(XY[i, 0]), 3), "y": round(float(XY[i, 1]), 3), "cluster": int(km.labels_[i]),
     "tier": r["tier"], "breakout": r["breakout"], "family": r["family"], "channelId": r["channelId"], "label": r["label"]}
    for i, r in enumerate(rows)
]
clusters = []
for c in range(km.n_clusters):
    idx = np.where(km.labels_ == c)[0]
    labeled = [rows[int(i)] for i in idx if rows[int(i)]["breakout"] is not None]
    rate = round(sum(r["breakout"] for r in labeled) / len(labeled), 3) if labeled else None
    central = idx[np.argsort(np.linalg.norm(P[idx] - km.cluster_centers_[c], axis=1))[:3]]
    clusters.append({"id": c, "n": int(len(idx)), "outlierRate": rate, "labels": [rows[int(i)]["label"] for i in central]})

out = {"run": RUN, "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "n": len(points), "k": km.n_clusters, "clusters": clusters, "points": points}
json.dump(out, open("/work/map.json", "w"))
s3.upload_file("/work/map.json", BUCKET, f"model/encoder-index/{RUN}/map.json")
log(f"uploaded map.json ({os.path.getsize('/work/map.json')} bytes)")
log("EXIT=0")
