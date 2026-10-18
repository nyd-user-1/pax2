"""PAX2 Classifier v2, PAX2 Classifier with transcript features. Run on the box by box.sh.

scripts/rig/train_var.py's regression and validation, unchanged (common.py: L2 logistic regression by
Newton's method, lambda 2 on standardized features, leave-one-channel-out, within-channel AUC), on every
settled catalog short, with the transcript features scripts/classifier/transcript-features.mjs computed
on the Mac from src/lib/transcript-features.ts (rule 15: this file never tokenizes). A short without a
transcript keeps its metadata features and noTranscript = 1; it is not dropped.

Models, each reported, in the brief's order of trying, each adding to the last:
  metadata  var-1's metadata features on the same rows (parity: v1 measured LOCO AUC 0.604)
  tfidf     + noTranscript + the 400-term TF-IDF of unigrams and bigrams
  rate      + logWords and wordRate
  overlap   + titleOverlap, the title's words said in the first ten seconds
The candidate, pre-registered in docs/briefs/2026-10-18-brief-7-prediction.md and here before the run:
the variant with the highest pooled leave-one-channel-out AUC. Gate C: that AUC at least 0.624 (v1's
0.604 plus 0.02) and its within-channel AUC not below 0.55.

Env: BUCKET, RUN (s3 prefix model/v2/<run>/), OUT (local output dir)
Reads  <RUN>training-set.jsonl, <RUN>training-set.manifest.json, <RUN>transcript-features.json
Writes var-model-v2.json, predictions-v2.jsonl (every row's held-out probability under each model)
"""
import json, os, sys, time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import auc, decile_table, fit, get_bytes, get_json, loco, predict, r3, standardize, within_channel_auc

RUN = os.environ["RUN"]
OUT = os.environ.get("OUT", "/work/out")
os.makedirs(OUT, exist_ok=True)
LAMBDA = 2.0
CUT = "2026-07-01"
GATE_AUC = 0.624
GATE_WITHIN = 0.55
V1 = {"auc": 0.604, "withinChannelAuc": 0.55}


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


rows = [json.loads(l) for l in get_bytes(f"{RUN}training-set.jsonl").decode().splitlines() if l.strip()]
rows = [r for r in rows if r.get("breakout") is not None and r.get("group") != "paid-ad"]
defs = get_json(f"{RUN}training-set.manifest.json")["features"]
tf = get_json(f"{RUN}transcript-features.json")
vocab = tf["vocab"]
feats = tf["rows"]
EMPTY = {"noTranscript": 1, "logWords": 0, "wordRate": 0, "titleOverlap": 0}
tx = [feats.get(r["id"], EMPTY) for r in rows]
has = np.array([0 if t.get("noTranscript", 1) else 1 for t in tx])
XR = [{**r["x"], **t} for r, t in zip(rows, tx)]
log(f"train_v2: {len(rows)} settled rows, {int(has.sum())} with a transcript, vocabulary {len(vocab['terms'])}")

y = np.array([r["breakout"] for r in rows], dtype=float)
ch = np.array([r["channelId"] for r in rows])
fam = np.array([r["family"] for r in rows])
when = np.array([r["published"] for r in rows])
names = {r["channelId"]: r["channel"] for r in rows}

TF_DEFS = [{"key": f"tf:{t}", "label": f"Says “{t}”", "kind": "continuous"} for t in vocab["terms"]]
FLAG = [{"key": "noTranscript", "label": "No transcript", "kind": "binary"}]
RATE = [{"key": "logWords", "label": "Words spoken (log)", "kind": "continuous"}, {"key": "wordRate", "label": "Words per second", "kind": "continuous"}]
OVERLAP = [{"key": "titleOverlap", "label": "Title said in the first ten seconds", "kind": "continuous"}]
VARIANTS = [
    ("metadata", "var-2-metadata", defs),
    ("tfidf", "var-2-tfidf", defs + FLAG + TF_DEFS),
    ("rate", "var-2-rate", defs + FLAG + TF_DEFS + RATE),
    ("overlap", "var-2-overlap", defs + FLAG + TF_DEFS + RATE + OVERLAP),
]


def train(model_defs, version):
    keys = [d["key"] for d in model_defs]
    X = np.array([[xr.get(k, 0.0) for k in keys] for xr in XR], dtype=float)
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
    seg = {}
    for name, m in (("withTranscript", has == 1), ("withoutTranscript", has == 0)):
        w, _ = within_channel_auc(y[m], oof[m], ch[m], names)
        seg[name] = {"n": int(m.sum()), "baseRate": r3(y[m].mean()) if m.sum() else None, "auc": r3(auc(y[m], oof[m])), "withinChannelAuc": r3(w)}
    b = fit(Z, y, LAMBDA)
    full = predict(b, Z)
    out_feats = []
    for i, d in enumerate(model_defs):
        out_feats.append({**d, "coef": round(float(b[i + 1]), 4), "mean": round(float(mean[i]), 6), "sd": round(float(sd[i]), 6), "prevalence": round(float((X[:, i] > 0).mean()), 3) if d["kind"] != "continuous" else None})
    checks = []
    idx = list(np.where(has == 1)[0][:: max(1, int(has.sum()) // 4)][:4]) + list(np.where(has == 0)[0][:: max(1, int((has == 0).sum()) // 4)][:4])
    for k in idx:
        r = rows[k]
        checks.append({"id": r["id"], "input": {"title": r["title"], "description": r["description"], "tags": r["tags"], "durationSec": r["durationSec"], "published": r["published"], "group": r["group"], "channelMedian": r["channelMedian"]}, "transcript": bool(has[k]), "p": round(float(full[k]), 6)})
    a = auc(y, oof)
    td = dec[0]["observed"] if dec else None
    model = {
        "version": version,
        "method": f"L2 logistic regression (lambda {LAMBDA} on standardized features, intercept free) on {len(y)} settled shorts from {len(np.unique(ch))} channels, {int(has.sum())} with a transcript; validated leave-one-channel-out and on a time split at {CUT}.",
        "target": "breakout: lifetime views at least 3x the channel's median of settled shorts",
        "n": int(len(y)),
        "positives": int(y.sum()),
        "baseRate": round(base_rate, 4),
        "intercept": round(float(b[0]), 4),
        "features": out_feats,
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
                "bySegment": seg,
            },
            "timeSplit": {"cut": CUT, "train": int(tr.sum()), "test": int((~tr).sum()), "testBaseRate": r3(y[~tr].mean()) if (~tr).sum() else None, "auc": r3(auc(y[~tr], p_time)) if len(p_time) else None},
        },
        "checks": checks,
    }
    return model, oof


t0 = time.time()
models, oofs = {}, {}
for kind, version, model_defs in VARIANTS:
    m, oof = train(model_defs, version)
    models[kind], oofs[kind] = m, oof
    l = m["metrics"]["leaveOneChannelOut"]
    log(f"train_v2: {kind} ({len(model_defs)} features) LOCO AUC {l['auc']} within {l['withinChannelAuc']} time {m['metrics']['timeSplit']['auc']} segments {json.dumps(l['bySegment'])} ({time.time() - t0:.0f}s)")

meta = models["metadata"]["metrics"]["leaveOneChannelOut"]
parity = {"v1": V1, "here": {"auc": meta["auc"], "withinChannelAuc": meta["withinChannelAuc"]}, "match": meta["auc"] == V1["auc"] and meta["withinChannelAuc"] == V1["withinChannelAuc"]}
log(f"train_v2: parity with v1 metadata {'OK' if parity['match'] else 'DIFFERS'}: {json.dumps(parity)}")

cands = ["tfidf", "rate", "overlap"]
best = max(cands, key=lambda k: models[k]["metrics"]["leaveOneChannelOut"]["auc"] or 0)
bl = models[best]["metrics"]["leaveOneChannelOut"]
passed = bl["auc"] is not None and bl["auc"] >= GATE_AUC and bl["withinChannelAuc"] is not None and bl["withinChannelAuc"] >= GATE_WITHIN
gate = {
    "passed": bool(passed),
    "rule": f"pre-registered 2026-10-18: the transcript variant with the highest pooled leave-one-channel-out AUC; passes when that AUC is at least {GATE_AUC} (v1 {V1['auc']} plus 0.02) and its within-channel AUC is not below {GATE_WITHIN}",
    "candidate": best,
    "transcript": {"auc": bl["auc"], "withinChannelAuc": bl["withinChannelAuc"]},
    "metadata": {"auc": meta["auc"], "withinChannelAuc": meta["withinChannelAuc"]},
    "variants": {k: {"auc": models[k]["metrics"]["leaveOneChannelOut"]["auc"], "withinChannelAuc": models[k]["metrics"]["leaveOneChannelOut"]["withinChannelAuc"], "features": len(models[k]["features"])} for k in ["metadata"] + cands},
}
log(f"train_v2: gate C {'PASSED' if passed else 'FAILED'}: {json.dumps(gate)}")

transcript = models[best]
transcript["transcriptFeatures"] = {"vocab": vocab, "rule": tf["rule"], "definition": "src/lib/transcript-features.ts", "builtAt": tf["builtAt"], "counts": tf["counts"]}
out = {
    "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "name": "PAX2 Classifier",
    "version": "var-2",
    "method": transcript["method"],
    "run": RUN,
    "rows": {"trainingSet": len(rows), "withTranscript": int(has.sum())},
    "metadata": models["metadata"],
    "transcript": transcript,
    "variants": {k: {"version": models[k]["version"], "metrics": {"leaveOneChannelOut": {kk: models[k]["metrics"]["leaveOneChannelOut"][kk] for kk in ("auc", "withinChannelAuc", "topDecileLift", "bySegment", "perFamily")}, "timeSplit": models[k]["metrics"]["timeSplit"]}} for k in cands},
    "parity": parity,
    "gates": {"transcript": gate},
    "caveats": [
        "Observational: a word's coefficient is association within and across channels, not the effect of saying it.",
        "Transcripts are YouTube's auto-captions for the reform, voting-rights and nonpartisan channels; an original's transcript is its script.",
        "The label is relative to the channel's own median, so a fast-growing channel's new shorts read low.",
        "Probabilities are calibrated on the catalog's mix of channels; a new channel inherits its family's rate until it has a median.",
    ],
}
with open(f"{OUT}/var-model-v2.json", "w") as f:
    json.dump(out, f, indent=1, allow_nan=False)
with open(f"{OUT}/predictions-v2.jsonl", "w") as f:
    for i, r in enumerate(rows):
        f.write(json.dumps({"id": r["id"], "channelId": r["channelId"], "family": r["family"], "y": int(y[i]), "transcript": int(has[i]), **{k: round(float(oofs[k][i]), 6) for k in oofs}}) + "\n")
log(f"train_v2: wrote var-model-v2.json and predictions-v2.jsonl ({len(rows)} rows) in {time.time() - t0:.0f}s")
