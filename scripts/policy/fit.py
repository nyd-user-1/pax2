"""Window P: the publish policy. An offline contextual bandit over topic cluster, length bucket and
publish hour, warm-started by replaying the settled catalog in publish order, evaluated off-policy
exactly as registered in docs/briefs/WINDOW-P.md (2026-10-22T18:51:28Z).

  python3 scripts/policy/fit.py

Reads  data/velocity/catalog.json, data/generated/model/encoder-map.json
Writes data/generated/model/martian-publish-policy.json  (shipped model, epoch marker)
       data/generated/model/martian-publish-policy-eval.json  (the off-policy numbers)
"""
import json, math, time
from collections import Counter, defaultdict
from datetime import datetime
from zoneinfo import ZoneInfo

import numpy as np

SEED = 20261022
ET = ZoneInfo("America/New_York")
LEN_EDGES = [(0, 30, "<=30s"), (31, 60, "31-60s"), (61, 90, "61-90s"), (91, 10**9, ">=91s")]
HOUR_BLOCKS = ["0-3", "4-7", "8-11", "12-15", "16-19", "20-23"]
K = 40
log = lambda *a: print(time.strftime("%H:%M:%S"), *a, flush=True)

# ---------- rows ----------
cat = json.load(open("data/velocity/catalog.json"))["videos"]
emap = json.load(open("data/generated/model/encoder-map.json"))
assert emap["k"] == K
cluster = {p["id"]: p["cluster"] for p in emap["points"]}
fam_of_channel = {}
for p in emap["points"]:
    fam_of_channel.setdefault(p["channelId"], p["family"])
FAMILIES = sorted(set(fam_of_channel.values()))

settled = [v for v in cat if v["tier"] != "unsettled"]
rows = [v for v in settled if v["id"] in cluster and v["channelId"] in fam_of_channel]
dropped = {"unsettled": len(cat) - len(settled), "noCluster": len(settled) - len(rows)}
rows.sort(key=lambda v: (v["published"], v["id"]))


def len_bucket(s):
    return next(i for i, (lo, hi, _) in enumerate(LEN_EDGES) if lo <= s <= hi)


def hour_block(iso):
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(ET).hour // 4


N = len(rows)
ch = [r["channelId"] for r in rows]
fam = np.array([FAMILIES.index(fam_of_channel[c]) for c in ch])
lmed = np.array([math.log10(max(r["channelMedian"], 1)) for r in rows])
A = np.array([[cluster[r["id"]], len_bucket(r["durationSec"]), hour_block(r["published"])] for r in rows])
y = np.array([1.0 if r["ratio"] >= 3 else 0.0 for r in rows])
NV = [K, len(LEN_EDGES), len(HOUR_BLOCKS)]
FACTORS = ["topic", "length", "hour"]
SPLIT = int(0.8 * N)
log(f"rows {N} (dropped {dropped}), train {SPLIT}, test {N - SPLIT}, base rate {y.mean():.4f}")

# ---------- features ----------
NF = len(FAMILIES)
OFF = {}
o = 0
for name, size in [("bias", 1), ("family", NF), ("lmed", 1), ("topic", K), ("length", NV[1]), ("hour", NV[2]),
                   ("fam_x_topic", NF * K), ("fam_x_length", NF * NV[1]), ("fam_x_hour", NF * NV[2])]:
    OFF[name] = (o, size)
    o += size
D = o


def feats(f, z, a, context_only=False):
    """Sparse feature (indices, values) for family f, standardized log median z, action a=(c,l,h)."""
    idx = [OFF["bias"][0], OFF["family"][0] + f, OFF["lmed"][0]]
    val = [1.0, 1.0, z]
    if not context_only:
        c, l, h = a
        idx += [OFF["topic"][0] + c, OFF["length"][0] + l, OFF["hour"][0] + h,
                OFF["fam_x_topic"][0] + f * K + c, OFF["fam_x_length"][0] + f * NV[1] + l,
                OFF["fam_x_hour"][0] + f * NV[2] + h]
        val += [1.0] * 6
    return np.array(idx), np.array(val)


class Learner:
    """Online Bayesian logistic regression, diagonal Laplace posterior (Chapelle & Li 2011), prior N(0,1)."""

    def __init__(self):
        self.m = np.zeros(D)
        self.q = np.ones(D)
        self.n = 0

    def mean(self, idx, val):
        return 1 / (1 + math.exp(-float(self.m[idx] @ val)))

    def update(self, idx, val, yy):
        m0, q0 = self.m[idx].copy(), self.q[idx]
        w = m0.copy()
        for _ in range(4):  # Newton steps on the per-row MAP with diagonal Hessian
            p = 1 / (1 + math.exp(-float(w @ val)))
            g = q0 * (w - m0) - (yy - p) * val
            H = q0 + p * (1 - p) * val ** 2
            w = w - g / H
        p = 1 / (1 + math.exp(-float(w @ val)))
        self.m[idx] = w
        self.q[idx] = q0 + p * (1 - p) * val ** 2
        self.n += 1


mu, sd = lmed[:SPLIT].mean(), lmed[:SPLIT].std()
z = (lmed - mu) / sd

# ---------- replay the training segment ----------
full, ctx = Learner(), Learner()
for i in range(SPLIT):
    full.update(*feats(fam[i], z[i], A[i]), y[i])
    ctx.update(*feats(fam[i], z[i], A[i], context_only=True), y[i])
log("training segment replayed")
eval_m = full.m.copy()  # evaluation model frozen here


def pred_m(m, f, zz, a):
    idx, val = feats(f, zz, a)
    return 1 / (1 + math.exp(-float(m[idx] @ val)))


# ---------- behavior policy and support from the training segment ----------
cnt = [defaultdict(Counter) for _ in FACTORS]
fcnt = [defaultdict(Counter) for _ in FACTORS]
nch, nfam = Counter(), Counter()
for i in range(SPLIT):
    nch[ch[i]] += 1
    nfam[fam[i]] += 1
    for k in range(3):
        cnt[k][ch[i]][A[i, k]] += 1
        fcnt[k][fam[i]][A[i, k]] += 1


def pib(k, i, v):
    if nch[ch[i]]:
        return (cnt[k][ch[i]][v] + 0.5) / (nch[ch[i]] + 0.5 * NV[k])
    return (fcnt[k][fam[i]][v] + 0.5) / (nfam[fam[i]] + 0.5 * NV[k])


def support(k, i):
    s = sorted(cnt[k][ch[i]]) if nch[ch[i]] else sorted(fcnt[k][fam[i]])
    return s


# ---------- progressive validation on the test segment ----------
pv_full, pv_ctx = [], []
for i in range(SPLIT, N):
    fi = feats(fam[i], z[i], A[i])
    ci = feats(fam[i], z[i], A[i], context_only=True)
    pv_full.append(full.mean(*fi))
    pv_ctx.append(ctx.mean(*ci))
    full.update(*fi, y[i])
    ctx.update(*ci, y[i])
yt = y[SPLIT:]


def logloss(p, t):
    p = np.clip(np.array(p), 1e-9, 1 - 1e-9)
    return float(-np.mean(t * np.log(p) + (1 - t) * np.log(1 - p)))


def auc(p, t):
    p = np.array(p)
    order = np.argsort(p, kind="mergesort")
    ranks = np.empty(len(p))
    sp = p[order]
    i = 0
    while i < len(p):  # average ranks over ties
        j = i
        while j + 1 < len(p) and sp[j + 1] == sp[i]:
            j += 1
        ranks[order[i:j + 1]] = (i + j) / 2 + 1
        i = j + 1
    npos = t.sum()
    return float((ranks[t == 1].sum() - npos * (npos + 1) / 2) / (npos * (len(t) - npos)))


model_check = {
    "full": {"logLoss": logloss(pv_full, yt), "auc": auc(pv_full, yt)},
    "contextOnly": {"logLoss": logloss(pv_ctx, yt), "auc": auc(pv_ctx, yt)},
}
log("progressive validation", model_check)

# ---------- off-policy evaluation (frozen evaluation model) ----------
T = np.arange(SPLIT, N)
policies = {}
for k, name in enumerate(FACTORS):
    choice, qpi, qlog, w = [], [], [], []
    for i in T:
        best, bv = None, -1
        for v in support(k, i):
            a = A[i].copy()
            a[k] = v
            pv = pred_m(eval_m, fam[i], z[i], a)
            if pv > bv:
                best, bv = v, pv
        choice.append(best)
        qpi.append(bv)
        qlog.append(pred_m(eval_m, fam[i], z[i], A[i]))
        w.append((A[i, k] == best) / pib(k, i, A[i, k]))
    policies[name] = dict(choice=np.array(choice), qpi=np.array(qpi), qlog=np.array(qlog), w=np.array(w))
    log(f"policy {name}: matched {int((np.array(w) > 0).sum())}")

choice, qpi, qlog, w = [], [], [], []
for i in T:
    sup = [support(k, i) for k in range(3)]
    best, bv = None, -1
    for c in sup[0]:
        for l in sup[1]:
            for h in sup[2]:
                pv = pred_m(eval_m, fam[i], z[i], (c, l, h))
                if pv > bv:
                    best, bv = (c, l, h), pv
    choice.append(best)
    qpi.append(bv)
    qlog.append(pred_m(eval_m, fam[i], z[i], A[i]))
    match = tuple(A[i]) == best
    w.append(match / (pib(0, i, A[i, 0]) * pib(1, i, A[i, 1]) * pib(2, i, A[i, 2])))
policies["joint"] = dict(qpi=np.array(qpi), qlog=np.array(qlog), w=np.array(w))
log(f"policy joint: matched {int((np.array(w) > 0).sum())}")


def estimates(P, sel):
    w, r, qpi, qlog = P["w"][sel], yt[sel], P["qpi"][sel], P["qlog"][sel]
    vb = r.mean()
    snips = (w * r).sum() / w.sum() if w.sum() > 0 else float("nan")
    dr = np.mean(qpi + w * (r - qlog))
    return vb, snips, dr


test_ch = np.array([ch[i] for i in T])
uch = sorted(set(test_ch))
rows_of = {c: np.where(test_ch == c)[0] for c in uch}
rng = np.random.default_rng(SEED)
boots = [np.concatenate([rows_of[c] for c in rng.choice(uch, size=len(uch), replace=True)]) for _ in range(1000)]

ope = {}
allsel = np.arange(len(T))
for name, P in policies.items():
    vb, snips, dr = estimates(P, allsel)
    bs = np.array([estimates(P, b) for b in boots])
    d_snips = bs[:, 1] - bs[:, 0]
    d_dr = bs[:, 2] - bs[:, 0]
    w = P["w"]
    matched = int((w > 0).sum())
    ess = float(w.sum() ** 2 / (w ** 2).sum()) if matched else 0.0
    lo, hi = np.nanpercentile(d_dr, [2.5, 97.5])
    ope[name] = {
        "matched": matched, "ess": round(ess, 1),
        "Vlogged": round(float(vb), 4),
        "SNIPS": round(float(snips), 4), "SNIPSminusLogged": round(float(snips - vb), 4),
        "SNIPSdiffCI95": [round(float(x), 4) for x in np.nanpercentile(d_snips, [2.5, 97.5])],
        "DR": round(float(dr), 4), "DRminusLogged": round(float(dr - vb), 4),
        "DRdiffCI95": [round(float(lo), 4), round(float(hi), 4)],
        "pass": bool(lo > 0 and matched >= 200),
    }
    log(name, ope[name])

model_pass = any(ope[f]["pass"] for f in FACTORS) and model_check["full"]["logLoss"] < model_check["contextOnly"]["logLoss"]
log("MODEL PASS" if model_pass else "MODEL FAIL")

# ---------- shipped model: replay every row; epoch marker after the last ----------
shipped = Learner()
for i in range(N):
    shipped.update(*feats(fam[i], z[i], A[i]), y[i])
names = (["bias"] + [f"family={f}" for f in FAMILIES] + ["log10ChannelMedian(z)"] + [f"topic={c}" for c in range(K)]
         + [f"length={l[2]}" for l in LEN_EDGES] + [f"hour={h}" for h in HOUR_BLOCKS]
         + [f"family={f}|topic={c}" for f in FAMILIES for c in range(K)]
         + [f"family={f}|length={l[2]}" for f in FAMILIES for l in LEN_EDGES]
         + [f"family={f}|hour={h}" for f in FAMILIES for h in HOUR_BLOCKS])
assert len(names) == D
epoch = {"replayRows": N, "lastReplayedPublished": rows[-1]["published"], "lastReplayedId": rows[-1]["id"],
         "rule": "Updates 1..replayRows are replay of the settled catalog (reward: settled ratio >= 3). "
                 "Every update after replayRows is a client's own publish (reward: outperformed 3x within 72 hours)."}
model = {
    "name": "martian-publish-policy", "version": 1, "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "learner": "Bayesian logistic regression, diagonal Laplace posterior, prior N(0,1), per-row updates; act by Thompson sampling",
    "arms": {"topic": {"source": f"encoder-map run {emap['run']}, k-means k={K}", "values": K},
             "length": [l[2] for l in LEN_EDGES], "hourBlocksET": HOUR_BLOCKS},
    "context": {"families": FAMILIES, "log10ChannelMedian": {"mean": mu, "sd": sd}},
    "reward": {"replay": "settled ratio >= 3", "online": "outperformed 3x within 72 hours of publish"},
    "epochMarker": epoch, "updates": shipped.n,
    "features": names, "mean": [round(float(x), 6) for x in shipped.m], "precision": [round(float(x), 6) for x in shipped.q],
}
json.dump(model, open("data/generated/model/martian-publish-policy.json", "w"))
json.dump({"registration": "docs/briefs/WINDOW-P.md 2026-10-22T18:51:28Z", "rows": N, "dropped": dropped,
           "train": SPLIT, "test": N - SPLIT, "baseRate": round(float(y.mean()), 4),
           "testBaseRate": round(float(yt.mean()), 4), "trainEndsAt": rows[SPLIT - 1]["published"],
           "modelCheck": model_check, "ope": ope, "pass": model_pass, "epochMarker": epoch},
          open("data/generated/model/martian-publish-policy-eval.json", "w"), indent=1)
log("wrote model and eval; EXIT=0")
