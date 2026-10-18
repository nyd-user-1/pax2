"""B3. PAX2 Classifier (the VAR model, Value Above Replacement): the chance a short is a Hit, pushed
past 3x its channel's median, from what is knowable before it is posted.

Two models on the same rows, one var-model.json:
  "metadata"  the pre-publish features from src/lib/video-features.ts (unchanged from var-0)
  "image"     those plus the thumbnail's ResMem memorability, brightness, contrast, colorfulness
              and its first eight CLIP principal components (encode_images.py)
L2-regularized logistic regression (Newton's method, numpy only), validated leave-one-channel-out,
within-channel AUC, deciles, a time split and parity checks for each. The gate, gates.image: the
image model passes only if both its leave-one-channel-out AUC and its within-channel AUC are at
least the metadata model's.

Reads  s3 model/training-set.jsonl, model/training-set.manifest.json, <prefix>thumb-features.json
Writes var-model.json
"""
import json, time

import numpy as np

from common import PREFIX, auc, decile_table, dump, fit, get_json, log, loco, predict, r3, standardize, training_rows, within_channel_auc

JOB = "train_var"
LAMBDA = 2.0
CUT = "2026-07-01"

# Settled catalog rows only: paid-ad rows (scripts/training-set.mjs) carry no breakout label.
rows_all = [r for r in training_rows() if r.get("breakout") is not None and r.get("group") != "paid-ad"]
defs = get_json("model/training-set.manifest.json")["features"]
thumbs = get_json(f"{PREFIX}thumb-features.json")
mem_ok = any(v.get("mem") is not None for v in thumbs.values())
IMAGE_DEFS = ([{"key": "mem", "label": "Thumbnail memorability (ResMem)", "kind": "continuous"}] if mem_ok else []) + [
    {"key": "bright", "label": "Thumbnail brightness (mean luma)", "kind": "continuous"},
    {"key": "contrast", "label": "Thumbnail contrast (luma standard deviation)", "kind": "continuous"},
    {"key": "color", "label": "Thumbnail colorfulness (Hasler and Susstrunk)", "kind": "continuous"},
] + [{"key": f"pca{k}", "label": f"Thumbnail CLIP component {k + 1}", "kind": "continuous"} for k in range(8)]
IMAGE_SOURCE = {
    "mem": "ResMem (pip resmem, pretrained) on the 227x227 center crop, 0 to 1",
    "bright": "mean of 0.299R + 0.587G + 0.114B over hqdefault.jpg, 0 to 255",
    "contrast": "standard deviation of the same luma",
    "color": "sqrt(sd(R-G)^2 + sd((R+G)/2-B)^2) + 0.3 * sqrt(mean(R-G)^2 + mean((R+G)/2-B)^2)",
    "pca0..pca7": "(L2-normalized CLIP ViT-B-32 openai image embedding - thumb-pca.json mean) projected on thumb-pca.json components",
}


def image_x(t):
    out = {"bright": t["bright"], "contrast": t["contrast"], "color": t["color"], **{f"pca{k}": t["pca"][k] for k in range(8)}}
    if mem_ok:
        out["mem"] = t["mem"]
    return out


rows = [r for r in rows_all if r["id"] in thumbs and "pca" in thumbs[r["id"]] and (not mem_ok or thumbs[r["id"]]["mem"] is not None)]
log(f"train_var: {len(rows)} of {len(rows_all)} training rows have thumbnail features; mem {'on' if mem_ok else 'OFF (resmem missing)'}")
y = np.array([r["breakout"] for r in rows], dtype=float)
ch = np.array([r["channelId"] for r in rows])
fam = np.array([r["family"] for r in rows])
when = np.array([r["published"] for r in rows])
names = {r["channelId"]: r["channel"] for r in rows}


def train(model_defs, getx, version):
    keys = [d["key"] for d in model_defs]
    X = np.array([[getx(r)[k] for k in keys] for r in rows], dtype=float)
    Z, mean, sd = standardize(X, model_defs)
    oof = loco(Z, y, ch, LAMBDA)
    base_cols = np.array([d["kind"] == "family" or d["key"] == "logMedian" for d in model_defs])
    oof_base = loco(Z[:, base_cols], y, ch, LAMBDA)
    base_rate = float(y.mean())
    dec = decile_table(y, oof)
    wc, wc_parts = within_channel_auc(y, oof, ch, names)
    wc_base, _ = within_channel_auc(y, oof_base, ch, names)
    tr = when < CUT
    p_time = predict(fit(Z[tr], y[tr], LAMBDA), Z[~tr]) if tr.sum() and (~tr).sum() else np.array([])
    per_family = []
    for f in sorted(set(fam.tolist())):
        m = fam == f
        per_family.append({"family": str(f), "n": int(m.sum()), "baseRate": r3(y[m].mean()), "auc": r3(auc(y[m], oof[m]))})
    b = fit(Z, y, LAMBDA)
    full = predict(b, Z)
    feats = []
    for i, d in enumerate(model_defs):
        feats.append({**d, "coef": round(float(b[i + 1]), 4), "mean": round(float(mean[i]), 6), "sd": round(float(sd[i]), 6), "prevalence": round(float((X[:, i] > 0).mean()), 3) if d["kind"] != "continuous" else None})
    checks = []
    step = max(1, len(rows) // 8)
    for k in list(range(0, len(rows), step))[:8]:
        r = rows[k]
        c = {"input": {"title": r["title"], "description": r["description"], "tags": r["tags"], "durationSec": r["durationSec"], "published": r["published"], "group": r["group"], "channelMedian": r["channelMedian"]}, "p": round(float(full[k]), 6)}
        if version.endswith("image"):
            c["image"] = {**{kk: thumbs[r["id"]][kk] for kk in ("mem", "bright", "contrast", "color")}, "pca": thumbs[r["id"]]["pca"]}
        checks.append(c)
    a = auc(y, oof)
    td = dec[0]["observed"] if dec else None
    return {
        "version": version,
        "method": f"L2 logistic regression (lambda {LAMBDA} on standardized features, intercept free) on {len(y)} settled shorts from {len(np.unique(ch))} channels; validated leave-one-channel-out and on a time split at {CUT}.",
        "target": "breakout: lifetime views at least 3x the channel's median of settled shorts",
        "n": int(len(y)),
        "positives": int(y.sum()),
        "baseRate": round(base_rate, 4),
        "intercept": round(float(b[0]), 4),
        "features": feats,
        "metrics": {
            "leaveOneChannelOut": {
                "auc": r3(a),
                "aucChannelOnly": r3(auc(y, oof_base)),
                "withinChannelAuc": r3(wc),
                "withinChannelAucChannelOnly": r3(wc_base),
                "topDecileRate": td,
                "topDecileLift": round(td / base_rate, 2) if td is not None and base_rate else None,
                "bottomDecileRate": dec[-1]["observed"] if dec else None,
                "deciles": dec,
                "withinChannel": sorted(wc_parts, key=lambda p: -p["n"])[:30],
                "perFamily": per_family,
            },
            "timeSplit": {"cut": CUT, "train": int(tr.sum()), "test": int((~tr).sum()), "testBaseRate": r3(y[~tr].mean()) if (~tr).sum() else None, "auc": r3(auc(y[~tr], p_time)) if len(p_time) else None},
        },
        "checks": checks,
    }


t0 = time.time()
meta = train(defs, lambda r: r["x"], "var-1-metadata")
log(f"train_var: metadata LOCO AUC {meta['metrics']['leaveOneChannelOut']['auc']} within {meta['metrics']['leaveOneChannelOut']['withinChannelAuc']} time {meta['metrics']['timeSplit']['auc']} ({time.time() - t0:.0f}s)")
img = train(defs + IMAGE_DEFS, lambda r: {**r["x"], **image_x(thumbs[r["id"]])}, "var-1-image")
log(f"train_var: image LOCO AUC {img['metrics']['leaveOneChannelOut']['auc']} within {img['metrics']['leaveOneChannelOut']['withinChannelAuc']} time {img['metrics']['timeSplit']['auc']} ({time.time() - t0:.0f}s)")
img["imageFeatures"] = {"defs": IMAGE_DEFS, "source": IMAGE_SOURCE, "pca": "thumb-pca.json", "thumbnail": "https://i.ytimg.com/vi/<id>/hqdefault.jpg"}

mm, im = meta["metrics"]["leaveOneChannelOut"], img["metrics"]["leaveOneChannelOut"]
ge = lambda a, b: a is not None and b is not None and a >= b
passed = ge(im["auc"], mm["auc"]) and ge(im["withinChannelAuc"], mm["withinChannelAuc"])
gate = {"passed": bool(passed), "rule": "image leave-one-channel-out AUC and within-channel AUC both at least the metadata model's, on the same rows", "metadata": {"auc": mm["auc"], "withinChannelAuc": mm["withinChannelAuc"]}, "image": {"auc": im["auc"], "withinChannelAuc": im["withinChannelAuc"]}, "memorability": mem_ok}
log(f"train_var: gate image {'PASSED' if passed else 'FAILED'}: {json.dumps(gate)}")

out = {
    "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "name": "PAX2 Classifier",
    "version": "var-1",
    # Kept at the top level for readers of var-0's shape (src/lib/evaluate.ts reads method).
    "method": meta["method"],
    "rows": {"trainingSet": len(rows_all), "withThumbnailFeatures": len(rows)},
    "metadata": meta,
    "image": img,
    "gates": {"image": gate},
    "caveats": [
        "Observational: a trait's coefficient is association within and across channels, not the effect of adding it.",
        "The label is relative to the channel's own median, so a fast-growing channel's new shorts read low.",
        "The metadata model has not seen the video; the image model has seen only its thumbnail.",
        "Probabilities are calibrated on the catalog's mix of channels; a new channel inherits its family's rate until it has a median.",
    ],
}
dump(JOB, "var-model.json", out)
log(f"train_var: wrote var-model.json n={len(rows)} positives={int(y.sum())} in {time.time() - t0:.0f}s")
