"""Window MM-A, diagnosis check 4 (docs/briefs/MULTIMODAL-SURVEY.md, domain gap): do a video's nearest
neighbors in the stock embedding share its visual format? No format labels exist, so two proxies, both
read against chance:
- Channel and group: share of each video's 10 nearest neighbors (cosine, self excluded) from the same
  channel and the same catalog group. A channel's shorts mostly share one production format.
- Measured format: composition.json's visual and pacing features (cuts per second, visual activity,
  on-screen text share, brightness, saturation, speech share). For each feature, the Pearson correlation
  between a video's value and the mean of its neighbors' values, over videos where both are measured.
  Read twice: all neighbors, and cross-channel neighbors only (the 10 nearest from other channels), so a
  format signal is not just channel identity.
No label enters. Runs on the Mac: 5,108 vectors, one 5,108 x 5,108 similarity matrix per arm.

Usage: python3 scripts/video/retrieval.py <dir with the three arm jsonl files>
Writes data/generated/model/video/retrieval.json
"""
import json, os, sys

import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../..")
D = sys.argv[1]
K = 10
ARMS = {"base": "videoprism-base.jsonl", "large": "videoprism-large.jsonl", "rung0": "clip-frame-mean.jsonl"}
FEATS = ["cutsPerSec", "visualActivity", "textFrameShare", "brightness", "saturation", "speechShare"]

cat = {v["id"]: v for v in json.load(open(f"{ROOT}/data/velocity/catalog.json"))["videos"]}
comp = json.load(open(f"{ROOT}/data/generated/model/composition.json"))["shorts"]


def load(p):
    ids, vs = [], []
    for l in open(p):
        if l.strip():
            r = json.loads(l)
            ids.append(r["id"])
            vs.append(r["vector"])
    return ids, np.asarray(vs, dtype=np.float32)


def chance_same(keys):
    _, c = np.unique(keys, return_counts=True)
    n = len(keys)
    return float((c * (c - 1)).sum() / (n * (n - 1)))


def feat_corr(nbr, ids):
    out = {}
    for f in FEATS:
        x = np.array([comp.get(i, {}).get(f, np.nan) for i in ids], dtype=float)
        nm = np.array([np.nanmean(x[row]) if np.isfinite(x[row]).any() else np.nan for row in nbr])
        ok = np.isfinite(x) & np.isfinite(nm)
        out[f] = {"r": round(float(np.corrcoef(x[ok], nm[ok])[0, 1]), 3), "n": int(ok.sum())}
    return out


res = {"k": K, "features": FEATS, "arms": {}}
for arm, f in ARMS.items():
    ids, V = load(f"{D}/{f}")
    V /= np.linalg.norm(V, axis=1, keepdims=True)
    keep = [i for i, x in enumerate(ids) if x in cat]
    ids, V = [ids[i] for i in keep], V[keep]
    ch = np.array([cat[i]["channelId"] for i in ids])
    grp = np.array([cat[i].get("group") or "" for i in ids])
    S = V @ V.T
    np.fill_diagonal(S, -np.inf)
    nbr = np.argsort(-S, axis=1)[:, :K]
    Sx = np.where(ch[:, None] == ch[None, :], -np.inf, S)
    xnbr = np.argsort(-Sx, axis=1)[:, :K]
    res["arms"][arm] = {
        "videos": len(ids),
        "sameChannel": round(float((ch[nbr] == ch[:, None]).mean()), 3),
        "sameChannelChance": round(chance_same(ch), 3),
        "sameGroup": round(float((grp[nbr] == grp[:, None]).mean()), 3),
        "sameGroupChance": round(chance_same(grp), 3),
        "formatCorrelation": feat_corr(nbr, ids),
        "formatCorrelationCrossChannel": feat_corr(xnbr, ids),
        "meanNeighborCosine": round(float(np.take_along_axis(S, nbr, 1).mean()), 3),
    }
    a = res["arms"][arm]
    print(arm, "same channel", a["sameChannel"], "chance", a["sameChannelChance"], "| same group", a["sameGroup"], "chance", a["sameGroupChance"], "| cos", a["meanNeighborCosine"])
    print("   format r (all / cross-channel):", {k: (a["formatCorrelation"][k]["r"], a["formatCorrelationCrossChannel"][k]["r"]) for k in FEATS})
os.makedirs(f"{ROOT}/data/generated/model/video", exist_ok=True)
json.dump(res, open(f"{ROOT}/data/generated/model/video/retrieval.json", "w"), indent=1)
