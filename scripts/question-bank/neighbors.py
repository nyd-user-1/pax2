"""Nearest neighbors among the baseline shorts in the serving index, for the question bank.
Reads data/raw/composition/index (embeddings.npy, float16 18,455 x 1,024; rows.json) and the baseline ids
on stdin (one per line); prints {id: [[neighborId, cosine], ...]} with the 20 nearest from other channels.
Usage: python3 scripts/question-bank/neighbors.py < ids.txt"""
import json, sys
import numpy as np

K = 20
ids = [l.strip() for l in sys.stdin if l.strip()]
rows = json.load(open("data/raw/composition/index/rows.json"))
emb = np.load("data/raw/composition/index/embeddings.npy").astype(np.float32)
at = {r["id"]: i for i, r in enumerate(rows)}
keep = [i for i in ids if i in at]
x = emb[[at[i] for i in keep]]
chan = np.array([rows[at[i]]["channelId"] for i in keep])
x /= np.linalg.norm(x, axis=1, keepdims=True)
out = {}
for s in range(0, len(keep), 1000):
    sims = x[s : s + 1000] @ x.T
    for j in range(sims.shape[0]):
        sims[j, chan == chan[s + j]] = -2
    top = np.argpartition(-sims, K, axis=1)[:, :K]
    for j in range(sims.shape[0]):
        order = top[j][np.argsort(-sims[j, top[j]])]
        out[keep[s + j]] = [[keep[k], round(float(sims[j, k]), 3)] for k in order]
json.dump(out, sys.stdout)
