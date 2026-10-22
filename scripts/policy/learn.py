"""Shared machinery for the learning loops (docs/briefs/WINDOW-P2.md): the Window P learner (Bayesian
logistic regression, diagonal Laplace posterior, Chapelle & Li 2011, prior N(0,1), per-row updates),
the factor-bandit off-policy evaluation registered in docs/briefs/WINDOW-P.md, and the event log in the
shape /reinforcement-learning reads (data/generated/model/martian-publish-policy-events.json).
"""
import json, math, os, time
from collections import Counter, defaultdict
from datetime import datetime
from zoneinfo import ZoneInfo

import numpy as np

ET = ZoneInfo("America/New_York")
SEED = 20261022
EVENT_LOG = 240
OUT = "data/generated/model/learning"
log = lambda *a: print(time.strftime("%H:%M:%S"), *a, flush=True)


def et_hour(iso):
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(ET).hour


def ts(iso):
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()


def settled_catalog():
    """Settled catalog shorts with their channel family (the encoder map's families, joined by channel)."""
    cat = json.load(open("data/velocity/catalog.json"))["videos"]
    emap = json.load(open("data/generated/model/encoder-map.json"))
    fam_of = {}
    for p in emap["points"]:
        fam_of.setdefault(p["channelId"], p["family"])
    cluster = {p["id"]: p["cluster"] for p in emap["points"]}
    return cat, fam_of, cluster


class Learner:
    def __init__(self, D):
        self.m = np.zeros(D)
        self.q = np.ones(D)
        self.n = 0

    def logit(self, idx, val):
        return float(self.m[idx] @ val)

    def mean(self, idx, val):
        return 1 / (1 + math.exp(-self.logit(idx, val)))

    def var(self, idx, val):
        """Posterior variance of the logit."""
        return float((val ** 2 / self.q[idx]).sum())

    def update(self, idx, val, yy):
        m0, q0 = self.m[idx].copy(), self.q[idx]
        w = m0.copy()
        for _ in range(4):
            p = 1 / (1 + math.exp(-float(w @ val)))
            g = q0 * (w - m0) - (yy - p) * val
            H = q0 + p * (1 - p) * val ** 2
            w = w - g / H
        p = 1 / (1 + math.exp(-float(w @ val)))
        self.m[idx] = w
        self.q[idx] = q0 + p * (1 - p) * val ** 2
        self.n += 1


class Design:
    """Features: bias; one-hot of the main context; standardized continuous context; one-hot per factor;
    main context x each factor."""

    def __init__(self, ctx_name, ctx_values, cont_names, factors):
        self.ctx_name, self.ctx_values, self.cont_names = ctx_name, ctx_values, cont_names
        self.factors = factors  # [(name, [value labels])]
        self.off, o = {}, 0
        C = len(ctx_values)
        blocks = [("bias", 1), ("ctx", C), ("cont", len(cont_names))]
        blocks += [(f"f:{n}", len(v)) for n, v in factors]
        blocks += [(f"x:{n}", C * len(v)) for n, v in factors]
        for name, size in blocks:
            self.off[name] = o
            o += size
        self.D = o
        self.names = (["bias"] + [f"{ctx_name}={c}" for c in ctx_values] + cont_names
                      + [f"{n}={v}" for n, vs in factors for v in vs]
                      + [f"{ctx_name}={c}|{n}={v}" for n, vs in factors for c in ctx_values for v in vs])
        assert len(self.names) == self.D

    def feats(self, c, z, a, context_only=False):
        idx = [self.off["bias"], self.off["ctx"] + c] + [self.off["cont"] + j for j in range(len(z))]
        val = [1.0, 1.0] + list(z)
        if not context_only:
            for k, (n, vs) in enumerate(self.factors):
                idx += [self.off[f"f:{n}"] + a[k], self.off[f"x:{n}"] + c * len(vs) + a[k]]
                val += [1.0, 1.0]
        return np.array(idx), np.array(val, dtype=float)


def logloss(p, t):
    p = np.clip(np.array(p), 1e-9, 1 - 1e-9)
    return float(-np.mean(t * np.log(p) + (1 - t) * np.log(1 - p)))


def auc(p, t):
    p, t = np.array(p), np.array(t)
    order = np.argsort(p, kind="mergesort")
    ranks = np.empty(len(p))
    sp = p[order]
    i = 0
    while i < len(p):
        j = i
        while j + 1 < len(p) and sp[j + 1] == sp[i]:
            j += 1
        ranks[order[i:j + 1]] = (i + j) / 2 + 1
        i = j + 1
    npos = t.sum()
    return float((ranks[t == 1].sum() - npos * (npos + 1) / 2) / (npos * (len(t) - npos)))


def advice(design, m, c, z):
    """Greedy choice per factor under posterior means, coordinate ascent, two passes."""
    best = [0] * len(design.factors)
    for _ in range(2):
        for k, (_, vs) in enumerate(design.factors):
            vals = []
            for v in range(len(vs)):
                a = list(best)
                a[k] = v
                idx, val = design.feats(c, z, a)
                vals.append(float(m[idx] @ val))
            best[k] = int(np.argmax(vals))
    return best


def run_factor_loop(loop, rows, ctx, Z, A, y, unit, design, ctx_fallback=None, joint=True, extra_event=None):
    """Replay, evaluate as registered in WINDOW-P.md, ship.

    rows: dicts sorted by publish order (id, channelId, channel, title, published, ratio)
    ctx: main-context index per row; Z: continuous context (raw, standardized here on the train segment)
    A: factor value index per row (N x F); y: 0/1; unit: behavior-policy key per row (e.g. channel id)
    ctx_fallback: when a unit has no training rows, behavior and support fall back to the main context's.
    """
    N, F = A.shape
    NV = [len(v) for _, v in design.factors]
    SPLIT = int(0.8 * N)
    mu, sd = Z[:SPLIT].mean(axis=0), Z[:SPLIT].std(axis=0)
    sd[sd == 0] = 1
    Zs = (Z - mu) / sd
    log(f"[{loop}] rows {N}, train {SPLIT}, test {N - SPLIT}, base {y.mean():.4f}, test base {y[SPLIT:].mean():.4f}")

    full, ctxm = Learner(design.D), Learner(design.D)
    for i in range(SPLIT):
        full.update(*design.feats(ctx[i], Zs[i], A[i]), y[i])
        ctxm.update(*design.feats(ctx[i], Zs[i], A[i], context_only=True), y[i])
    eval_m = full.m.copy()

    cnt = [defaultdict(Counter) for _ in range(F)]
    ccnt = [defaultdict(Counter) for _ in range(F)]
    nu, nc = Counter(), Counter()
    for i in range(SPLIT):
        nu[unit[i]] += 1
        nc[ctx[i]] += 1
        for k in range(F):
            cnt[k][unit[i]][A[i, k]] += 1
            ccnt[k][ctx[i]][A[i, k]] += 1

    def pib(k, i, v):
        if nu[unit[i]]:
            return (cnt[k][unit[i]][v] + 0.5) / (nu[unit[i]] + 0.5 * NV[k])
        return (ccnt[k][ctx[i]][v] + 0.5) / (nc[ctx[i]] + 0.5 * NV[k])

    def support(k, i):
        return sorted(cnt[k][unit[i]]) if nu[unit[i]] else sorted(ccnt[k][ctx[i]])

    pv_f, pv_c = [], []
    for i in range(SPLIT, N):
        fi = design.feats(ctx[i], Zs[i], A[i])
        ci = design.feats(ctx[i], Zs[i], A[i], context_only=True)
        pv_f.append(full.mean(*fi))
        pv_c.append(ctxm.mean(*ci))
        full.update(*fi, y[i])
        ctxm.update(*ci, y[i])
    yt = y[SPLIT:]
    check = {"full": {"logLoss": round(logloss(pv_f, yt), 5), "auc": round(auc(pv_f, yt), 4)},
             "contextOnly": {"logLoss": round(logloss(pv_c, yt), 5), "auc": round(auc(pv_c, yt), 4)}}
    log(f"[{loop}] progressive validation {check}")

    def pm(i, a):
        idx, val = design.feats(ctx[i], Zs[i], a)
        return 1 / (1 + math.exp(-float(eval_m[idx] @ val)))

    T = np.arange(SPLIT, N)
    pols = {}
    names = [n for n, _ in design.factors]
    for k in range(F):
        qpi, qlog, w = [], [], []
        for i in T:
            best, bv = None, -1
            for v in support(k, i):
                a = A[i].copy()
                a[k] = v
                p = pm(i, a)
                if p > bv:
                    best, bv = v, p
            qpi.append(bv)
            qlog.append(pm(i, A[i]))
            w.append((A[i, k] == best) / pib(k, i, A[i, k]))
        pols[names[k]] = (np.array(qpi), np.array(qlog), np.array(w))
    if joint and F > 1:
        import itertools
        qpi, qlog, w = [], [], []
        for i in T:
            best, bv = None, -1
            for a in itertools.product(*[support(k, i) for k in range(F)]):
                p = pm(i, np.array(a))
                if p > bv:
                    best, bv = a, p
            qpi.append(bv)
            qlog.append(pm(i, A[i]))
            match = tuple(int(x) for x in A[i]) == tuple(int(x) for x in best)
            w.append(match / np.prod([pib(k, i, A[i, k]) for k in range(F)]))
        pols["joint"] = (np.array(qpi), np.array(qlog), np.array(w))

    def est(P, sel):
        qpi, qlog, w = P[0][sel], P[1][sel], P[2][sel]
        r = yt[sel]
        vb = r.mean()
        sn = (w * r).sum() / w.sum() if w.sum() > 0 else float("nan")
        return vb, sn, float(np.mean(qpi + w * (r - qlog)))

    tch = np.array([rows[i]["channelId"] for i in T])
    uch = sorted(set(tch))
    rows_of = {c: np.where(tch == c)[0] for c in uch}
    rng = np.random.default_rng(SEED)
    boots = [np.concatenate([rows_of[c] for c in rng.choice(uch, size=len(uch), replace=True)]) for _ in range(1000)]
    ope = {}
    for name, P in pols.items():
        vb, sn, dr = est(P, np.arange(len(T)))
        bs = np.array([est(P, b) for b in boots])
        w = P[2]
        matched = int((w > 0).sum())
        lo, hi = np.nanpercentile(bs[:, 2] - bs[:, 0], [2.5, 97.5])
        ope[name] = {"matched": matched, "ess": round(float(w.sum() ** 2 / (w ** 2).sum()), 1) if matched else 0.0,
                     "Vlogged": round(float(vb), 4), "SNIPS": round(float(sn), 4), "SNIPSminusLogged": round(float(sn - vb), 4),
                     "SNIPSdiffCI95": [round(float(x), 4) for x in np.nanpercentile(bs[:, 1] - bs[:, 0], [2.5, 97.5])],
                     "DR": round(float(dr), 4), "DRminusLogged": round(float(dr - vb), 4),
                     "DRdiffCI95": [round(float(lo), 4), round(float(hi), 4)],
                     "pass": bool(lo > 0 and matched >= 200)}
        log(f"[{loop}] {name} {ope[name]}")
    factor_pass = any(ope[n]["pass"] for n in names)
    verdict = factor_pass and check["full"]["logLoss"] < check["contextOnly"]["logLoss"]
    log(f"[{loop}] {'PASS' if verdict else 'FAIL'}")

    shipped = Learner(design.D)
    events = []
    for i in range(N):
        fi = design.feats(ctx[i], Zs[i], A[i])
        logged = i >= N - EVENT_LOG
        if logged:
            idx = fi[0]
            bw, bp, ba = shipped.m[idx].copy(), shipped.mean(*fi), advice(design, shipped.m, ctx[i], Zs[i])
        shipped.update(*fi, y[i])
        if logged:
            aa = advice(design, shipped.m, ctx[i], Zs[i])
            r = rows[i]
            ev = {"n": i + 1, "id": r["id"], "title": r.get("title", ""), "channel": r.get("channel", ""),
                  "channelId": r["channelId"], "family": r.get("family", ""), "published": r["published"],
                  "ratio": round(float(r["ratio"]), 3), "outcome": int(y[i]),
                  "arm": {n: vs[A[i, k]] for k, (n, vs) in enumerate(design.factors)},
                  "predicted": [round(bp, 4), round(shipped.mean(*fi), 4)],
                  "weights": [[int(j), round(float(b), 6), round(float(shipped.m[j]), 6)] for j, b in zip(idx, bw)],
                  "advice": {n: [vs[ba[k]], vs[aa[k]]] for k, (n, vs) in enumerate(design.factors)}}
            if extra_event:
                ev.update(extra_event(i))
            events.append(ev)
    epoch = {"replayRows": N, "lastReplayedPublished": rows[-1]["published"], "lastReplayedId": rows[-1]["id"],
             "rule": f"Updates 1..replayRows are replay of the catalog (reward: settled ratio >= 3). Every update after replayRows is a client's own publish."}
    built = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    model = {"loop": loop, "builtAt": built,
             "learner": "Bayesian logistic regression, diagonal Laplace posterior, prior N(0,1), per-row updates; act by Thompson sampling",
             "context": {design.ctx_name: design.ctx_values, "continuous": {n: {"mean": float(mu[j]), "sd": float(sd[j])} for j, n in enumerate(design.cont_names)}},
             "arms": {n: vs for n, vs in design.factors}, "epochMarker": epoch, "updates": shipped.n,
             "features": design.names, "mean": [round(float(x), 6) for x in shipped.m],
             "precision": [round(float(x), 6) for x in shipped.q],
             "eval": {"rows": N, "train": SPLIT, "test": N - SPLIT, "baseRate": round(float(y.mean()), 4),
                      "testBaseRate": round(float(yt.mean()), 4), "trainEndsAt": rows[SPLIT - 1]["published"],
                      "modelCheck": check, "ope": ope, "pass": verdict}}
    write_loop(loop, model, events, design.names)
    return model, shipped, Zs


def write_loop(loop, model, events, features):
    os.makedirs(OUT, exist_ok=True)
    json.dump(model, open(f"{OUT}/{loop}.json", "w"))
    with open(f"{OUT}/{loop}-events.jsonl", "w") as f:
        f.write(json.dumps({"header": True, "loop": loop, "builtAt": model["builtAt"],
                            "replayRows": model.get("epochMarker", {}).get("replayRows"), "logged": len(events),
                            "features": features}) + "\n")
        for e in events[::-1]:  # newest first, as the page reads
            f.write(json.dumps(e) + "\n")
    log(f"[{loop}] wrote {OUT}/{loop}.json and {len(events)} events")
