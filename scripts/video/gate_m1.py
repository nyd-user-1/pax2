"""Window MM-A, Gate M1 — the pair read, per arm (docs/briefs/MM-A-videoprism-stock.md). Runs on the box.

Pairs: data/generated/model/video-pairs.json (scripts/video/pairs.mjs): the Composition Ranker's pairs with
media on both sides, 2,481, of which 590 sit on the encoder's 10 held-out channels.
Per arm, fixed before any run:
- PCA to 32 components, fit on the training pairs' videos only (each distinct video once, centered on
  their mean).
- Each component standardized by its mean and spread over the training pairs' shorts (both sides of every
  training pair, fit.mjs's rule); a pair's difference is 0 unless both sides are embedded.
- Bradley-Terry logistic on breakout-minus-control differences, no intercept, L2 0.001, 600 steps of plain
  gradient descent at 0.5 (scripts/pairwise/train.mjs and scripts/composition/fit.mjs, unchanged).
- Read: accuracy on the 590 held-out pairs (a zero score counts half), with a channel-block bootstrap 95%
  interval (2,000 resamples of the 10 held-out channels with replacement, seed 20261020).
- Bar: 0.615. Secondary reads (gate nothing, select nothing): accuracy on the held-out pairs whose breakout
  reached 5x and 10x its channel median, subset sizes stated, same bootstrap.

Env: PAIRS (json path), ARMS ("name=path.jsonl,..."), OUT (dir)
Writes OUT/bench-m1.json, OUT/video-pair-predictions.jsonl
"""
import json, os, time

import numpy as np

K, LAMBDA, ITERS, LR, BAR, B, SEED = 32, 1e-3, 600, 0.5, 0.615, 2000, 20261020
OUT = os.environ.get("OUT", "/work/out")
P = json.load(open(os.environ["PAIRS"]))
pairs = P["pairs"]
arms = dict(a.split("=", 1) for a in os.environ["ARMS"].split(","))


def load(path):
    out = {}
    for l in open(path):
        if l.strip():
            r = json.loads(l)
            out[r["id"]] = np.asarray(r["vector"], dtype=np.float64)
    return out


def boot(correct, chans):
    """Channel-block bootstrap over the 10 held-out channels; the draws (PICKS) ship in the bench so the
    Mac's scorer recomputes the interval on the same resamples. A drawn channel with no items adds none."""
    by = {}
    for c, ch in zip(correct, chans):
        by.setdefault(ch, []).append(c)
    vals = []
    for pick in PICKS:
        allc = np.concatenate([by.get(CHANNELS[i], []) for i in pick])
        if len(allc):
            vals.append(allc.mean())
    return [round(float(np.percentile(vals, 2.5)), 4), round(float(np.percentile(vals, 97.5)), 4)]


CHANNELS = sorted({p["channelId"] for p in pairs if p["heldOut"]})
PICKS = np.random.default_rng(SEED).integers(0, len(CHANNELS), (B, len(CHANNELS)))
train = [p for p in pairs if not p["heldOut"]]
held = [p for p in pairs if p["heldOut"]]
bench = {"builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "gate": "M1", "bar": BAR, "pairs": P["counts"], "settings": {"components": K, "l2": LAMBDA, "steps": ITERS, "lr": LR, "bootstrap": f"channel-block, {B} resamples, seed {SEED}"}, "bootstrap": {"channels": CHANNELS, "picks": PICKS.tolist()}, "arms": {}}
scores = {}
for arm, path in arms.items():
    E = load(path)
    tv = sorted({i for p in train for i in (p["breakout"], p["control"]) if i in E})
    X = np.stack([E[i] for i in tv])
    mu = X.mean(0)
    _, S, Vt = np.linalg.svd(X - mu, full_matrices=False)
    basis = Vt[:K]
    explained = float((S[:K] ** 2).sum() / (S**2).sum())
    proj = {i: (v - mu) @ basis.T for i, v in E.items()}
    side = np.stack([proj[i] for p in train for i in (p["breakout"], p["control"]) if i in proj])
    sd = np.sqrt(np.maximum(side.var(0), 1e-12))

    def diff(p):
        a, b = proj.get(p["breakout"]), proj.get(p["control"])
        return np.zeros(K) if a is None or b is None else (a - b) / sd

    Xd = np.stack([diff(p) for p in train])
    w = np.zeros(K)
    for _ in range(ITERS):
        pr = 1 / (1 + np.exp(-(Xd @ w)))
        g = ((pr - 1)[:, None] * Xd).sum(0)
        w -= LR * (g / len(Xd) + 2 * LAMBDA * w)

    def score(p):
        return float(diff(p) @ w)

    def correct(ps):
        z = np.array([score(p) for p in ps])
        return np.where(z > 0, 1.0, np.where(z == 0, 0.5, 0.0))

    ch = held
    c = correct(ch)
    reads = {"heldOut": {"n": len(ch), "accuracy": round(float(c.mean()), 4), "interval": boot(c, [p["channelId"] for p in ch])}}
    for t in (5, 10):
        sub = [p for p in held if (p["breakoutRatio"] or 0) >= t]
        cs = correct(sub)
        reads[f"heldOut{t}x"] = {"n": len(sub), "accuracy": round(float(cs.mean()), 4) if len(sub) else None, "interval": boot(cs, [p["channelId"] for p in sub]), "rule": f"held-out pairs whose breakout reached {t}x its channel median; secondary, gates nothing"}
    acc = reads["heldOut"]["accuracy"]
    bench["arms"][arm] = {
        "embedded": len(E),
        "trainVideos": len(tv),
        "explained": round(explained, 4),
        "pairsBothEmbedded": {"train": sum(1 for p in train if p["breakout"] in E and p["control"] in E), "heldOut": sum(1 for p in held if p["breakout"] in E and p["control"] in E)},
        "trainAccuracy": round(float(correct(train).mean()), 4),
        **reads,
        "pass": acc >= BAR,
        "weights": [round(float(x), 6) for x in w],
    }
    scores[arm] = {(p["breakout"], p["control"]): score(p) for p in pairs}
    print(time.strftime("%H:%M:%S"), f"M1 {arm}: held-out {acc} {reads['heldOut']['interval']} (bar {BAR}: {'PASS' if acc >= BAR else 'fail'}); 5x {reads['heldOut5x']['accuracy']} n={reads['heldOut5x']['n']}; 10x {reads['heldOut10x']['accuracy']} n={reads['heldOut10x']['n']}; train {bench['arms'][arm]['trainAccuracy']}, {len(E)} embedded, {explained:.3f} explained", flush=True)

best = max(bench["arms"], key=lambda a: bench["arms"][a]["heldOut"]["accuracy"])
bench["bestArm"] = best
json.dump(bench, open(f"{OUT}/bench-m1.json", "w"), indent=1)
with open(f"{OUT}/video-pair-predictions.jsonl", "w") as f:
    for p in pairs:
        f.write(json.dumps({"breakout": p["breakout"], "control": p["control"], "channelId": p["channelId"], "heldOut": p["heldOut"], "breakoutRatio": p["breakoutRatio"], **{a: round(scores[a][(p["breakout"], p["control"])], 8) for a in scores}}) + "\n")
print(time.strftime("%H:%M:%S"), f"M1 best arm {best}", flush=True)
