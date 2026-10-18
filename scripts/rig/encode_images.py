"""B2. PAX2 Vision Encoder (borrowed: CLIP ViT-B-32 openai, and ResMem) over every thumbnail.

Per thumbnail: the 512-d CLIP image embedding (L2-normalized, float16) into thumb-embeddings.npy with
ids.json beside it; brightness (mean luma, 0-255), contrast (luma standard deviation), colorfulness
(Hasler and Susstrunk 2003) and ResMem memorability (0-1). PCA with 8 components on the embeddings,
components and mean in thumb-pca.json. thumb-features.json: { id: { mem, bright, contrast, color, pca } }.
If resmem does not import, mem is null for every id and the log says so.
"""
import json, os, time

import numpy as np
import torch
from PIL import Image

from common import dump, log, out_dir, training_rows

JOB = "encode"
DIR = "/work/thumbs"
BATCH = 64
torch.set_num_threads(os.cpu_count() or 4)

wanted = sorted({r["id"] for r in training_rows()})
ids = [i for i in wanted if os.path.exists(f"{DIR}/{i}.jpg")]
log(f"encode: {len(ids)} thumbnails on disk of {len(wanted)} training ids")

import open_clip

clip, _, clip_pre = open_clip.create_model_and_transforms("ViT-B-32", pretrained="openai")
clip.eval()
try:
    from resmem import ResMem, transformer as resmem_pre

    resmem = ResMem(pretrained=True)
    resmem.eval()
    log("encode: resmem loaded")
except Exception as e:
    resmem = None
    log(f"encode: resmem unavailable, mem will be null for every id: {type(e).__name__}: {e}")


def stats(img):
    a = np.asarray(img, dtype=np.float32)
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    luma = 0.299 * R + 0.587 * G + 0.114 * B
    rg = R - G
    yb = 0.5 * (R + G) - B
    color = np.sqrt(rg.std() ** 2 + yb.std() ** 2) + 0.3 * np.sqrt(rg.mean() ** 2 + yb.mean() ** 2)
    return float(luma.mean()), float(luma.std()), float(color)


emb, mems, kept, feats, bad = [], [], [], {}, []
t0 = time.time()
for s in range(0, len(ids), BATCH):
    chunk = ids[s : s + BATCH]
    imgs, ok = [], []
    for i in chunk:
        try:
            im = Image.open(f"{DIR}/{i}.jpg").convert("RGB")
            imgs.append(im)
            ok.append(i)
        except Exception as e:
            bad.append({"id": i, "reason": f"{type(e).__name__}: {e}"[:160]})
    if not ok:
        continue
    with torch.no_grad():
        e = clip.encode_image(torch.stack([clip_pre(im) for im in imgs]))
        e = e / e.norm(dim=-1, keepdim=True)
        emb.append(e.numpy().astype(np.float16))
        if resmem is not None:
            m = resmem(torch.stack([resmem_pre(im) for im in imgs]).view(-1, 3, 227, 227)).view(-1).numpy()
        else:
            m = [None] * len(ok)
    for i, im, mv in zip(ok, imgs, m):
        b, c, col = stats(im)
        feats[i] = {"mem": None if mv is None else round(float(mv), 4), "bright": round(b, 2), "contrast": round(c, 2), "color": round(col, 2)}
    kept.extend(ok)
    done = s + len(chunk)
    if done % 512 < BATCH or done == len(ids):
        rate = len(kept) / (time.time() - t0)
        log(f"encode: {len(kept)}/{len(ids)} at {rate:.1f} img/s, eta {(len(ids) - len(kept)) / max(rate, 1e-9) / 60:.1f} min")

E = np.concatenate(emb) if emb else np.zeros((0, 512), np.float16)
log(f"encode: {len(kept)} encoded, {len(bad)} unreadable in {time.time() - t0:.0f}s; embeddings {E.shape}")

# PCA, 8 components, on the float32 embeddings.
X = E.astype(np.float32)
mu = X.mean(0)
U, S, Vt = np.linalg.svd(X - mu, full_matrices=False)
comps = Vt[:8]
var = (S**2) / max(len(X) - 1, 1)
evr = var[:8] / var.sum()
P = (X - mu) @ comps.T
for k, i in enumerate(kept):
    feats[i]["pca"] = [round(float(v), 5) for v in P[k]]

d = out_dir(JOB)
np.save(f"{d}/thumb-embeddings.npy", E)
with open(f"{d}/ids.json", "w") as f:
    json.dump(kept, f)
dump(JOB, "thumb-pca.json", {"model": "CLIP ViT-B-32 (open_clip, pretrained openai), image embeddings L2-normalized", "n": len(kept), "components": [[round(float(v), 6) for v in c] for c in comps], "mean": [round(float(v), 6) for v in mu], "explainedVarianceRatio": [round(float(v), 5) for v in evr]})
dump(JOB, "thumb-features.json", feats)
mem_n = sum(1 for v in feats.values() if v["mem"] is not None)
log(f"encode: features for {len(feats)} ids, mem for {mem_n}; pca explained {float(evr.sum()):.3f}; unreadable {len(bad)}")
