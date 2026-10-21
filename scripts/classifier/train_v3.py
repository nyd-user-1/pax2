"""PAX2 Classifier v3: PAX2 Classifier with transcript features and the PAX2 Encoder's embedding. Run on
the box by box.sh (TRAINER=train_v3.py).

train_v2.py's regression and validation, unchanged (common.py: L2 logistic regression by Newton's method,
lambda 2 on standardized features, leave-one-channel-out, within-channel AUC), with one new input: each
short's embedding from the serving index of the encoder run that passed Gate E, reduced to its first 32
principal components (PCA fit on the whole index, unsupervised; the basis ships in the model file so the
app can project an original's embedding the same way). A short missing from the index keeps zeros and
noEmbedding = 1.

Leakage, and why the gate reads held-out channels only. The encoder was fine-tuned with the breakout label
on every channel except its held-out ones (holdout.json, the channel rule in scripts/encoder/corpus.mjs).
On those training channels the embedding has already seen the label, so a pooled leave-one-channel-out AUC
that includes them overstates the embedding. It is reported, marked as such, and never gates. The gate
reads the rows of the encoder's held-out channels, where neither the encoder nor the classifier fold saw
the label.

Models, each reported:
  metadata    var-1's metadata features (parity: v1 measured LOCO AUC 0.604)
  transcript  + noTranscript, the 400-term TF-IDF, logWords, wordRate, titleOverlap (v2's "overlap" set)
  embed       metadata + noEmbedding + emb0..emb31
  full        transcript + noEmbedding + emb0..emb31

Gate C, pre-registered here on 2026-10-20 before any full run: the candidate is whichever of embed and full
has the higher AUC on the encoder-held-out channels' rows (leave-one-channel-out predictions). It passes
when, on those same rows, (a) its AUC is above v1's 0.604 (Brendan's bar, 03:25 Eastern: "the same 0.604
bar"), (b) its AUC is above the metadata model's on the same rows, so a pass is a gain and not the rows'
own ease, and (c) its within-channel AUC is not below 0.55.

Task 7b (COMPOSITION=1, Brendan's raised bar): window C's composition.json adds each short's composition
(title traits for every short; cuts, loudness, on-screen text, brightness and speech timing where media or
word times exist). The media subset is the breakout-and-control pair set, chosen by the label, so a
"has media" flag would leak the label: there is none, and a missing value sits at the feature's mean
(zero pull in a linear model). Variants become metadata, full, full+comp; the candidate is full+comp under
the same gate, and the report adds every arm's AUC on the held-out rows that carry media features.

Window MM-A, Gate M2 (VIDEO=1, docs/briefs/MM-A-videoprism-stock.md): v3's features plus 32 components of
a stock video embedding (<RUN>video.jsonl, {id, vector}, the best Gate M1 arm), v3b's exact protocol: PCA
fit on the videos of channels outside the encoder's held-out set, missing values at the feature's mean
(no flag). The 1,212 media rows are v3b's (composition.json carries cutsPerSec), so the read sits on the
same rows. Variants become metadata, full, fullvideo; writes var-model-v3v.json, predictions-v3v.jsonl.
Bar, registered in the brief: fullvideo at least full + 0.02 on the held-out media rows. Predictions carry
each row's settled ratio for the secondary 5x and 10x reads.

Env: BUCKET, RUN (s3 prefix model/v3/<run>/), OUT (local output dir), LIMIT (every Nth row; rehearsal only),
     COMPOSITION=1 (task 7b; reads <RUN>composition.json, writes var-model-v3b.json),
     INDEX_RUN (the serving index's run id, stamped on the model so the app pairs it with that index's embeddings)
Reads  <RUN>training-set.jsonl, <RUN>training-set.manifest.json, <RUN>transcript-features.json,
       <RUN>embeddings.npy, <RUN>rows.json (the serving index), <RUN>holdout.json (the encoder run's)
Writes var-model-v3.json, predictions-v3.jsonl
"""
import io, json, os, sys, time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import auc, decile_table, fit, get_bytes, get_json, loco, predict, r3, standardize, within_channel_auc

RUN = os.environ["RUN"]
OUT = os.environ.get("OUT", "/work/out")
os.makedirs(OUT, exist_ok=True)
LAMBDA = 2.0
CUT = "2026-07-01"
K = 32
MARGIN = 0.0
V1 = {"auc": 0.604, "withinChannelAuc": 0.55}
GATE_WITHIN = 0.55


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


t0 = time.time()
rows = [json.loads(l) for l in get_bytes(f"{RUN}training-set.jsonl").decode().splitlines() if l.strip()]
rows = [r for r in rows if r.get("breakout") is not None and r.get("group") != "paid-ad"][:: int(os.environ.get("LIMIT", "1"))]
defs = get_json(f"{RUN}training-set.manifest.json")["features"]
tf = get_json(f"{RUN}transcript-features.json")
vocab = tf["vocab"]
EMPTY = {"noTranscript": 1, "logWords": 0, "wordRate": 0, "titleOverlap": 0}
tx = [tf["rows"].get(r["id"], EMPTY) for r in rows]
has = np.array([0 if t.get("noTranscript", 1) else 1 for t in tx])

# The embedding: PCA on the whole serving index, float32.
E = np.load(io.BytesIO(get_bytes(f"{RUN}embeddings.npy"))).astype(np.float32)
index_ids = [r["id"] for r in get_json(f"{RUN}rows.json")]
pos = {i: k for k, i in enumerate(index_ids)}
mu = E.mean(0)
_, S, Vt = np.linalg.svd(E - mu, full_matrices=False)
basis = Vt[:K]
explained = (S[:K] ** 2).sum() / (S**2).sum()
P = (E - mu) @ basis.T
emb = []
for r in rows:
    k = pos.get(r["id"])
    emb.append({**{f"emb{j}": float(P[k, j]) for j in range(K)}, "noEmbedding": 0} if k is not None else {**{f"emb{j}": 0.0 for j in range(K)}, "noEmbedding": 1})
log(f"train_v3: index {E.shape}, {K} components explain {explained:.3f} of variance, {sum(1 - e['noEmbedding'] for e in emb)} of {len(rows)} rows embedded")

held_ids = set(get_json(f"{RUN}holdout.json")["ids"])
held_channels = {r["channelId"] for r in rows if r["id"] in held_ids}
COMP = os.environ.get("COMPOSITION") == "1"
comp_defs, comp_x, has_media = [], [{} for _ in rows], np.zeros(len(rows), dtype=bool)
if COMP:
    cj = get_json(f"{RUN}composition.json")
    MEDIA = "cutsPerSec"
    keys = [k for k in cj["features"] if k != "durationSec"]
    comp_defs = [{"key": f"c:{k}", "label": cj["features"][k], "kind": "continuous"} for k in keys]
    for i, r in enumerate(rows):
        c = cj["shorts"].get(r["id"], {})
        comp_x[i] = {f"c:{k}": float(c[k]) for k in keys if c.get(k) is not None}
        has_media[i] = c.get(MEDIA) is not None
    # Missing values at the mean of present values: zero pull, no flag.
    for d in comp_defs:
        vals = [cx[d["key"]] for cx in comp_x if d["key"] in cx]
        m = float(np.mean(vals)) if vals else 0.0
        for cx in comp_x:
            cx.setdefault(d["key"], m)
    log(f"train_v3: composition {len(comp_defs)} features, {int(has_media.sum())} rows with media features")
VIDEO = os.environ.get("VIDEO") == "1"
vid_defs, vid_x = [], [{} for _ in rows]
if VIDEO:
    if not COMP:
        cj = get_json(f"{RUN}composition.json")
        for i, r in enumerate(rows):
            has_media[i] = cj["shorts"].get(r["id"], {}).get("cutsPerSec") is not None
    V = {}
    for l in get_bytes(f"{RUN}video.jsonl").decode().splitlines():
        if l.strip():
            o = json.loads(l)
            V[o["id"]] = np.asarray(o["vector"], dtype=np.float64)
    chan_of = {r["id"]: r["channelId"] for r in rows}
    fit_ids = sorted(i for i in V if i in chan_of and chan_of[i] not in held_channels)
    VX = np.stack([V[i] for i in fit_ids])
    vmu = VX.mean(0)
    _, VS, VVt = np.linalg.svd(VX - vmu, full_matrices=False)
    vbasis = VVt[:K]
    vexplained = float((VS[:K] ** 2).sum() / (VS**2).sum())
    vid_defs = [{"key": f"v:{j}", "label": f"Video component {j + 1}", "kind": "continuous"} for j in range(K)]
    for i, r in enumerate(rows):
        if r["id"] in V:
            pv = (V[r["id"]] - vmu) @ vbasis.T
            vid_x[i] = {f"v:{j}": float(pv[j]) for j in range(K)}
    for d in vid_defs:
        vals = [vx[d["key"]] for vx in vid_x if d["key"] in vx]
        m = float(np.mean(vals)) if vals else 0.0
        for vx in vid_x:
            vx.setdefault(d["key"], m)
    log(f"train_v3: video {len(V)} embedded, PCA on {len(fit_ids)} training-channel videos, {K} components explain {vexplained:.3f}, {sum(1 for r in rows if r['id'] in V)} rows carry a video, {int(has_media.sum())} rows with media features")
XR = [{**r["x"], **t, **e, **cx, **vx} for r, t, e, cx, vx in zip(rows, tx, emb, comp_x, vid_x)]

y = np.array([r["breakout"] for r in rows], dtype=float)
ch = np.array([r["channelId"] for r in rows])
fam = np.array([r["family"] for r in rows])
when = np.array([r["published"] for r in rows])
names = {r["channelId"]: r["channel"] for r in rows}
H = np.array([c in held_channels for c in ch])
log(f"train_v3: {len(rows)} settled rows, {int(has.sum())} with a transcript; encoder-held-out channels {len(held_channels)}, {int(H.sum())} rows, {int(y[H].sum())} breakouts")

TF_DEFS = [{"key": f"tf:{t}", "label": f"Says “{t}”", "kind": "continuous"} for t in vocab["terms"]]
FLAG = [{"key": "noTranscript", "label": "No transcript", "kind": "binary"}]
RATE = [{"key": "logWords", "label": "Words spoken (log)", "kind": "continuous"}, {"key": "wordRate", "label": "Words per second", "kind": "continuous"}]
OVERLAP = [{"key": "titleOverlap", "label": "Title said in the first ten seconds", "kind": "continuous"}]
EMB = [{"key": "noEmbedding", "label": "Not in the encoder's index", "kind": "binary"}] + [{"key": f"emb{j}", "label": f"Encoder component {j + 1}", "kind": "continuous"} for j in range(K)]
TRANSCRIPT = defs + FLAG + TF_DEFS + RATE + OVERLAP
VARIANTS = [
    ("metadata", "var-3-metadata", defs),
    ("transcript", "var-3-transcript", TRANSCRIPT),
    ("embed", "var-3-embed", defs + EMB),
    ("full", "var-3-full", TRANSCRIPT + EMB),
]
if COMP:
    VARIANTS = [VARIANTS[0], VARIANTS[3], ("fullcomp", "var-3b-fullcomp", TRANSCRIPT + EMB + comp_defs)]
if VIDEO:
    VARIANTS = [VARIANTS[0], VARIANTS[3], ("fullvideo", "var-3v-fullvideo", TRANSCRIPT + EMB + vid_defs)]
CANDIDATES = ["fullvideo"] if VIDEO else ["fullcomp"] if COMP else ["embed", "full"]
HM = H & has_media


def train(model_defs, version):
    keys = [d["key"] for d in model_defs]
    X = np.array([[xr.get(k, 0.0) for k in keys] for xr in XR], dtype=float)
    Z, mean, sd = standardize(X, model_defs)
    oof = loco(Z, y, ch, LAMBDA)
    base_rate = float(y.mean())
    dec = decile_table(y, oof)
    wc, wc_parts = within_channel_auc(y, oof, ch, names)
    hwc, hwc_parts = within_channel_auc(y[H], oof[H], ch[H], names)
    tr = when < CUT
    p_time = predict(fit(Z[tr], y[tr], LAMBDA), Z[~tr]) if tr.sum() and (~tr).sum() else np.array([])
    per_family = []
    for f in sorted(set(fam.tolist())):
        m = fam == f
        per_family.append({"family": str(f), "n": int(m.sum()), "baseRate": r3(y[m].mean()), "auc": r3(auc(y[m], oof[m]))})
    b = fit(Z, y, LAMBDA)
    out_feats = []
    for i, d in enumerate(model_defs):
        out_feats.append({**d, "coef": round(float(b[i + 1]), 4), "mean": round(float(mean[i]), 6), "sd": round(float(sd[i]), 6), "prevalence": round(float((X[:, i] > 0).mean()), 3) if d["kind"] != "continuous" else None})
    td = dec[0]["observed"] if dec else None
    return {
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
                "auc": r3(auc(y, oof)),
                "withinChannelAuc": r3(wc),
                "topDecileRate": td,
                "topDecileLift": round(td / base_rate, 2) if td is not None and base_rate else None,
                "deciles": dec,
                "withinChannel": sorted(wc_parts, key=lambda p: -p["n"])[:30],
                "perFamily": per_family,
            },
            "encoderHeldOut": {
                "channels": len(held_channels),
                "n": int(H.sum()),
                "baseRate": r3(y[H].mean()),
                "auc": r3(auc(y[H], oof[H])),
                "withinChannelAuc": r3(hwc),
                "withinChannel": sorted(hwc_parts, key=lambda p: -p["n"]),
            },
            "encoderHeldOutWithMedia": {"n": int(HM.sum()), "baseRate": r3(y[HM].mean()) if HM.sum() else None, "auc": r3(auc(y[HM], oof[HM])) if HM.sum() else None} if (COMP or VIDEO) else None,
            "timeSplit": {"cut": CUT, "train": int(tr.sum()), "test": int((~tr).sum()), "auc": r3(auc(y[~tr], p_time)) if len(p_time) else None},
        },
    }, oof


models, oofs = {}, {}
for kind, version, model_defs in VARIANTS:
    m, oof = train(model_defs, version)
    models[kind], oofs[kind] = m, oof
    l, h = m["metrics"]["leaveOneChannelOut"], m["metrics"]["encoderHeldOut"]
    log(f"train_v3: {kind} ({len(model_defs)} features) pooled LOCO {l['auc']} within {l['withinChannelAuc']} | encoder-held-out AUC {h['auc']} within {h['withinChannelAuc']} | time {m['metrics']['timeSplit']['auc']} ({time.time() - t0:.0f}s)")

meta_h = models["metadata"]["metrics"]["encoderHeldOut"]
best = max(CANDIDATES, key=lambda k: models[k]["metrics"]["encoderHeldOut"]["auc"] or 0)
bh = models[best]["metrics"]["encoderHeldOut"]
checks = {
    "overMetadata": bh["auc"] is not None and meta_h["auc"] is not None and bh["auc"] > meta_h["auc"] + MARGIN,
    "overV1": bh["auc"] is not None and bh["auc"] > V1["auc"],
    "within": bh["withinChannelAuc"] is not None and bh["withinChannelAuc"] >= GATE_WITHIN,
}
passed = all(checks.values())
gate = {
    "passed": bool(passed),
    "rule": f"pre-registered 2026-10-20 in train_v3.py: the candidate is {'full+video (window MM-A; Gate M2 is read by scripts/video/bench_m2.py, not here)' if VIDEO else 'full+comp (task 7b)' if COMP else 'whichever of embed and full scores higher'} on the encoder-held-out channels' rows; it passes when, on those rows, its AUC is above v1's {V1['auc']} and above the metadata model's, and its within-channel AUC is at least {GATE_WITHIN}. Pooled AUC includes channels the encoder trained on and never gates.",
    "candidate": best,
    "checks": checks,
    "heldOut": {k: {"auc": models[k]["metrics"]["encoderHeldOut"]["auc"], "withinChannelAuc": models[k]["metrics"]["encoderHeldOut"]["withinChannelAuc"]} for k in models},
    "pooledLeaky": {k: {"auc": models[k]["metrics"]["leaveOneChannelOut"]["auc"], "withinChannelAuc": models[k]["metrics"]["leaveOneChannelOut"]["withinChannelAuc"]} for k in models},
}
log(f"train_v3: gate C {'PASSED' if passed else 'FAILED'}: {json.dumps(gate)}")

cand = models[best]
cand["transcriptFeatures"] = {"vocab": vocab, "rule": tf["rule"], "builtAt": tf["builtAt"], "counts": tf["counts"]}
cand["embedding"] = {"indexRun": os.environ.get("INDEX_RUN"), "components": K, "explained": round(float(explained), 4), "mean": [round(float(v), 6) for v in mu], "basis": [[round(float(v), 6) for v in row] for row in basis]}
out = {
    "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "name": "PAX2 Classifier",
    "version": "var-3v" if VIDEO else "var-3b" if COMP else "var-3",
    "run": RUN,
    "rows": {"trainingSet": len(rows), "withTranscript": int(has.sum()), "embedded": int(sum(1 - e["noEmbedding"] for e in emb))},
    "candidate": cand,
    "variants": {k: {"version": models[k]["version"], "features": len(models[k]["features"]), "metrics": models[k]["metrics"]} for k in models},
    "gates": {"embedding": gate},
    "caveats": [
        "Observational: a coefficient is association within and across channels, not the effect of the input.",
        "The encoder was fine-tuned with the breakout label on every channel but its held-out ones; only those channels' rows judge the embedding.",
        "Encoder components are directions in the embedding, not named traits.",
    ],
}
SUFFIX = "v3v" if VIDEO else "v3b" if COMP else "v3"
with open(f"{OUT}/var-model-{SUFFIX}.json", "w") as f:
    json.dump(out, f, indent=1, allow_nan=False)
with open(f"{OUT}/predictions-{SUFFIX}.jsonl", "w") as f:
    for i, r in enumerate(rows):
        f.write(json.dumps({"id": r["id"], "channelId": r["channelId"], "y": int(y[i]), "heldOut": int(H[i]), "media": int(has_media[i]), "ratio": rows[i].get("ratio"), **{k: round(float(oofs[k][i]), 6) for k in oofs}}) + "\n")
log(f"train_v3: wrote var-model-{SUFFIX}.json and predictions-{SUFFIX}.jsonl in {time.time() - t0:.0f}s")
