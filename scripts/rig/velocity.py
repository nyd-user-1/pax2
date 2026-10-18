"""B4. PAX2 Velocity Classifier: from a short's first hours of views, the chance it is a Hit at 72 hours.

Qualifying videos: a reading at or before hour 6, a reading at or after hour 6, and either a 72-hour
value (velocity_common.H72_FLOOR) or a settled tier in the training set. Target: views at 72 hours at
least 3x the channel median (baselines.json), falling back to the settled tier's breakout label.
Three models, one per horizon, each using only what is known by then:
  1h: views at 1h            3h: views at 1h and 3h      6h: views at 1, 3, 6h plus likes and comments at 6h
each as log views and log views over the channel median, plus the hour of the first reading and the
pre-publish x features (src/lib/video-features.ts, exported for every polled video by
scripts/rig/export-fixtures.mjs into poll-x.json; the training set's x where the id is in it).
L2 logistic regression, leave-one-channel-out, the same metrics as PAX2 Classifier.
Writes velocity-model.json, the count of qualifying videos first; under 80 it writes the counts and stops.
"""
import json, math, os, time

import numpy as np

from common import CODE, auc, decile_table, dump, families, fit, log, loco, predict, r3, standardize, training_rows, within_channel_auc
from velocity_common import H72_FLOOR, at, baselines, readings, series, views72

JOB = "velocity"
LAMBDA = 2.0
MIN_N = 80
fam_of = families()

# The full training set even in a rehearsal: the readings are small.
train = {r["id"]: r for r in training_rows(1)}
with open(os.path.join(CODE, "poll-x.json")) as f:
    poll_x = json.load(f)
x_defs = json.load(open(os.path.join(CODE, "feature-defs.json")))
base = baselines()
S = series(readings())

counts = {"videos": len(S), "firstReadingBy6h": 0, "readingAfter6h": 0, "literal72h": 0, "has72h": 0, "settledInTrainingSet": 0, "noMedian": 0, "noX": 0, "qualifying": 0, "labelFrom72h": 0, "labelFromTier": 0}
rows = []
for vid, s in S.items():
    m = s["meta"]
    if s["h"][0] > 6:
        continue
    counts["firstReadingBy6h"] += 1
    if s["h"][-1] < 6:
        continue
    counts["readingAfter6h"] += 1
    counts["literal72h"] += int((s["h"] >= 72).any())
    v72 = views72(s)
    counts["has72h"] += int(v72 is not None)
    tr = train.get(vid)
    counts["settledInTrainingSet"] += int(tr is not None)
    if v72 is None and tr is None:
        continue
    med = (base.get(m["channelId"]) or {}).get("median") or (tr or {}).get("channelMedian")
    if not med:
        counts["noMedian"] += 1
        continue
    x = tr["x"] if tr else poll_x.get(vid)
    if x is None:
        counts["noX"] += 1
        continue
    if v72 is not None:
        y = int(v72 >= 3 * med)
        counts["labelFrom72h"] += 1
    else:
        y = int(tr["breakout"])
        counts["labelFromTier"] += 1
    rows.append({"id": vid, "channelId": m["channelId"], "channel": m["channel"], "family": fam_of.get(m.get("group") or "", None), "published": m["published"], "median": med, "s": s, "x": x, "y": y, "views72": v72})
counts["qualifying"] = len(rows)
log(f"velocity: {json.dumps(counts)}")

out = {"builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "name": "PAX2 Velocity Classifier", "qualifying": len(rows), "counts": counts}
if len(rows) < MIN_N:
    out["stopped"] = f"only {len(rows)} videos qualify, under {MIN_N}"
    log(f"velocity: STOPPED, {out['stopped']}")
    dump(JOB, "velocity-model.json", out)
    raise SystemExit(0)


def vel_features(r, horizon):
    """Only readings at or before the horizon: what is known at that hour."""
    s, med = r["s"], r["median"]
    k = s["h"] <= horizon
    hk = s["h"][k]
    f = {}
    for h in (1, 3, 6):
        if h > horizon:
            break
        v = at(hk, s["v"][k], h)
        f[f"logViews{h}h"] = math.log10(v + 1)
        f[f"ratio{h}h"] = math.log10((v + 1) / (med + 1))
    if horizon >= 6:
        f["hasCounts6h"] = float(s["l"] is not None and s["c"] is not None)
        f["logLikes6h"] = math.log10(at(hk, s["l"][k], 6) + 1) if s["l"] is not None else 0.0
        f["logComments6h"] = math.log10(at(hk, s["c"][k], 6) + 1) if s["c"] is not None else 0.0
    f["firstHour"] = float(min(s["h"][0], horizon))
    return f


def vel_defs(horizon):
    d = []
    for h in (1, 3, 6):
        if h > horizon:
            break
        d += [{"key": f"logViews{h}h", "label": f"Views at {h}h (log10)", "kind": "continuous"}, {"key": f"ratio{h}h", "label": f"Views at {h}h over the channel median (log10)", "kind": "continuous"}]
    if horizon >= 6:
        d += [{"key": "hasCounts6h", "label": "Likes and comments public", "kind": "binary"}, {"key": "logLikes6h", "label": "Likes at 6h (log10)", "kind": "continuous"}, {"key": "logComments6h", "label": "Comments at 6h (log10)", "kind": "continuous"}]
    d.append({"key": "firstHour", "label": "Hour of the first reading", "kind": "continuous"})
    return d


y = np.array([r["y"] for r in rows], dtype=float)
ch = np.array([r["channelId"] for r in rows])
fam = np.array([r["family"] or "Unmapped" for r in rows])
when = np.array([r["published"] for r in rows])
names = {r["channelId"]: r["channel"] for r in rows}
cut = sorted(when)[int(len(when) * 0.7)]


def train_h(horizon):
    defs = vel_defs(horizon) + x_defs
    keys = [d["key"] for d in defs]
    X = np.array([[{**vel_features(r, horizon), **r["x"]}[k] for k in keys] for r in rows], dtype=float)
    Z, mean, sd = standardize(X, defs)
    oof = loco(Z, y, ch, LAMBDA)
    oof_pre = loco(Z[:, len(vel_defs(horizon)) :], y, ch, LAMBDA)
    wc, parts = within_channel_auc(y, oof, ch, names, min_n=10, min_each=2)
    dec = decile_table(y, oof)
    tr = when < cut
    pt = predict(fit(Z[tr], y[tr], LAMBDA), Z[~tr])
    b = fit(Z, y, LAMBDA)
    full = predict(b, Z)
    per_family = [{"family": str(f), "n": int((fam == f).sum()), "baseRate": r3(y[fam == f].mean()), "auc": r3(auc(y[fam == f], oof[fam == f]))} for f in sorted(set(fam.tolist()))]
    checks = []
    for k in list(range(0, len(rows), max(1, len(rows) // 6)))[:6]:
        r = rows[k]
        s = r["s"]
        keep = s["h"] <= 6.5
        checks.append({"readings": [{"hour": float(s["h"][i]), "views": float(s["v"][i]), "likes": None if s["l"] is None else float(s["l"][i]), "comments": None if s["c"] is None else float(s["c"][i])} for i in np.where(keep)[0]], "channelMedian": r["median"], "x": r["x"], "p": round(float(full[k]), 6)})
    td = dec[0]["observed"]
    return {
        "horizon": horizon,
        "intercept": round(float(b[0]), 4),
        "features": [{**d, "coef": round(float(b[i + 1]), 4), "mean": round(float(mean[i]), 6), "sd": round(float(sd[i]), 6)} for i, d in enumerate(defs)],
        "metrics": {
            "leaveOneChannelOut": {"auc": r3(auc(y, oof)), "aucPrePublishOnly": r3(auc(y, oof_pre)), "withinChannelAuc": r3(wc), "withinChannelMin": "channels with 10+ videos and 2+ of each outcome", "topDecileRate": td, "topDecileLift": round(td / y.mean(), 2) if y.mean() else None, "bottomDecileRate": dec[-1]["observed"], "deciles": dec, "withinChannel": sorted(parts, key=lambda p: -p["n"])[:30], "perFamily": per_family},
            "timeSplit": {"cut": cut, "train": int(tr.sum()), "test": int((~tr).sum()), "testBaseRate": r3(y[~tr].mean()), "auc": r3(auc(y[~tr], pt))},
        },
        "checks": checks,
    }


t0 = time.time()
models = {}
for h in (1, 3, 6):
    models[str(h)] = train_h(h)
    m = models[str(h)]["metrics"]
    log(f"velocity: {h}h LOCO AUC {m['leaveOneChannelOut']['auc']} (pre-publish only {m['leaveOneChannelOut']['aucPrePublishOnly']}) within {m['leaveOneChannelOut']['withinChannelAuc']} time {m['timeSplit']['auc']}")
out.update({
    "n": len(rows),
    "positives": int(y.sum()),
    "baseRate": round(float(y.mean()), 4),
    "method": f"L2 logistic regression (lambda {LAMBDA} on standardized features) per horizon on {len(rows)} shorts from {len(np.unique(ch))} channels; leave-one-channel-out and a time split at {cut}.",
    "target": "Hit at 72 hours: views at 72 hours at least 3x the channel median (baselines.json); the training set's settled tier where no 72-hour reading exists",
    "series": f"running maximum of views, anchored at (0h, 0 views), linear in hours; the 72-hour value is the last reading at or after hour {H72_FLOOR} (the poller stops at 72.0)",
    "aucByHorizon": {h: models[h]["metrics"]["leaveOneChannelOut"]["auc"] for h in models},
    "horizons": models,
})
dump(JOB, "velocity-model.json", out)
log(f"velocity: wrote velocity-model.json, {len(rows)} videos, {int(y.sum())} Hits, in {time.time() - t0:.0f}s")
