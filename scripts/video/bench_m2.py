"""Window MM-A, Gate M2 bench, on the box after train_v3.py (VIDEO=1). Reads OUT/predictions-v3v.jsonl
(every row's leave-one-channel-out probability under metadata, full and fullvideo) and writes
OUT/bench-m2.json: held-out AUC on the encoder's 10 held-out channels and on the 1,212 held-out rows with
media, each with a channel-block bootstrap 95% interval (2,000 resamples, seed 20261020), and the bar —
fullvideo at least full + 0.02 on the media rows. Secondary reads (gate nothing): the same AUCs with rows
re-labeled at 5x and 10x the channel median (the same predictions, only the label moves).
Env: OUT, ARM (the M1 arm that fed the run)
"""
import json, os, time

import numpy as np

OUT = os.environ.get("OUT", "/work/out")
B, SEED, BAR = 2000, 20261020, 0.02
rows = [json.loads(l) for l in open(f"{OUT}/predictions-v3v.jsonl") if l.strip()]


def auc(y, p):
    """Probability a random positive outranks a random negative, ties half (average ranks, vectorized)."""
    y, p = np.asarray(y, float), np.asarray(p, float)
    n, pos = len(y), y.sum()
    if not n or pos in (0, n):
        return None
    o = np.argsort(p, kind="mergesort")
    ps = p[o]
    start = np.r_[0, np.flatnonzero(np.diff(ps)) + 1]
    size = np.diff(np.r_[start, n])
    avg = start + (size + 1) / 2  # mean 1-based rank of each tie group
    ranks = np.empty(n)
    ranks[o] = np.repeat(avg, size)
    return float((ranks[y == 1].sum() - pos * (pos + 1) / 2) / (pos * (n - pos)))


def read(rs, label):
    by = {}
    for r in rs:
        by.setdefault(r["channelId"], []).append(r)
    keys = CHANNELS
    out = {"n": len(rs), "positives": int(sum(label(r) for r in rs))}
    picks = PICKS
    for k in ("metadata", "full", "fullvideo"):
        out[k] = round(auc([label(r) for r in rs], [r[k] for r in rs]), 4)
        vals = []
        for pick in picks:
            s = [r for i in pick for r in by.get(keys[i], [])]
            a = auc([label(r) for r in s], [r[k] for r in s])
            if a is not None:
                vals.append(a)
        out[f"{k}Interval"] = [round(float(np.percentile(vals, 2.5)), 4), round(float(np.percentile(vals, 97.5)), 4)]
    d = []
    for pick in picks:
        s = [r for i in pick for r in by.get(keys[i], [])]
        a, b = auc([label(r) for r in s], [r["fullvideo"] for r in s]), auc([label(r) for r in s], [r["full"] for r in s])
        if a is not None and b is not None:
            d.append(a - b)
    out["delta"] = round(out["fullvideo"] - out["full"], 4)
    out["deltaInterval"] = [round(float(np.percentile(d, 2.5)), 4), round(float(np.percentile(d, 97.5)), 4)]
    return out


H = [r for r in rows if r["heldOut"]]
CHANNELS = sorted({r["channelId"] for r in H})
PICKS = np.random.default_rng(SEED).integers(0, len(CHANNELS), (B, len(CHANNELS)))  # shipped in the bench for the Mac
HM = [r for r in H if r["media"]]
y3 = lambda r: r["y"]
bench = {
    "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "gate": "M2",
    "arm": os.environ.get("ARM"),
    "bar": "fullvideo AUC at least full + 0.02 on the held-out rows with media",
    "heldOut": read(H, y3),
    "heldOutMedia": read(HM, y3),
    "secondary": {},
    "bootstrap": {"channels": CHANNELS, "picks": PICKS.tolist()},
}
for t in (5, 10):
    lab = lambda r, t=t: 1 if (r.get("ratio") or 0) >= t else 0
    bench["secondary"][f"{t}x"] = {"rule": f"rows re-labeled at {t}x the channel median, same predictions; secondary, gates nothing", "heldOut": read(H, lab), "heldOutMedia": read(HM, lab)}
bench["pass"] = bench["heldOutMedia"]["delta"] >= BAR
json.dump(bench, open(f"{OUT}/bench-m2.json", "w"), indent=1)
m = bench["heldOutMedia"]
print(time.strftime("%H:%M:%S"), f"M2 {bench['arm']}: media rows n={m['n']} full {m['full']} fullvideo {m['fullvideo']} delta {m['delta']} {m['deltaInterval']} -> {'PASS' if bench['pass'] else 'fail'}; all held-out full {bench['heldOut']['full']} fullvideo {bench['heldOut']['fullvideo']}", flush=True)
