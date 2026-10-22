"""Loop 6, paid-flight allocation: registered in docs/briefs/WINDOW-P2.md before this fit."""
import json, math, sys, time
from collections import defaultdict
from datetime import datetime
sys.path.insert(0, "scripts/policy")
import numpy as np
from learn import ET, EVENT_LOG, SEED, Design, Learner, log, settled_catalog, write_loop

cat, fam_of, _ = settled_catalog()
byid = {v["id"]: v for v in cat}
vf = json.load(open("data/generated/model/velocity-features.json"))["byId"]
FAMILIES = sorted(set(fam_of.values()))
rows, nofam = [], 0
for vid, r in vf.items():
    if r["views6h"] is None or r["firstHour"] is None or r["firstHour"] > 6 or r["lastHour"] < 6 or vid not in byid:
        continue
    c = byid[vid]
    med = max(c["channelMedian"], 1)
    if r["views72h"] is not None:
        yy, src = int(r["views72h"] >= 3 * med), "72h"
    elif c["tier"] != "unsettled":
        yy, src = int(c["ratio"] >= 3), "settled"
    else:
        continue
    if c["channelId"] not in fam_of:
        nofam += 1
        continue
    v1 = max(r["views1h"] or 0, 1)
    v6 = max(r["views6h"], 1)
    rows.append({**{k: c[k] for k in ("id", "title", "channel", "channelId", "published", "ratio")}, "family": fam_of[c["channelId"]],
                 "x": [math.log10(v1), math.log10(v6), math.log10(v1 / med), math.log10(v6 / med)], "y": yy, "label": src,
                 "day": datetime.fromisoformat(c["published"].replace("Z", "+00:00")).astimezone(ET).date().isoformat()})
rows.sort(key=lambda r: (r["published"], r["id"]))
X = np.array([r["x"] for r in rows])
mu, sd = X.mean(axis=0), X.std(axis=0)
Zs = (X - mu) / sd
y = np.array([r["y"] for r in rows], dtype=float)
ctx = np.array([FAMILIES.index(r["family"]) for r in rows])
log(f"diary {len(rows)} curves ({sum(r['label'] == '72h' for r in rows)} labeled at 72h, {sum(r['label'] == 'settled' for r in rows)} by settled tier), {int(y.sum())} hits, dropped without family {nofam}")
CONT = ["log10Views1h", "log10Views6h", "log10Views1hOverMedian", "log10Views6hOverMedian"]
design = Design("family", FAMILIES, CONT, [])
slates = defaultdict(list)
for i, r in enumerate(rows):
    slates[r["day"]].append(i)
days = sorted(slates)

L = Learner(design.D)
seen, scored = 0, []
for d in days:
    ids = slates[d]
    if len(ids) >= 2 and seen >= 50:
        p = [L.mean(*design.feats(ctx[i], Zs[i], [])) for i in ids]
        pick = ids[int(np.argmax(p))]
        comp = ids[int(np.argmax([X[i, 3] for i in ids]))]
        scored.append({"day": d, "n": len(ids), "policy": y[pick], "uniform": float(y[ids].mean()), "comparator": y[comp], "oracle": float(y[ids].max())})
    for i in ids:
        L.update(*design.feats(ctx[i], Zs[i], []), y[i])
    seen += len(ids)
S = {k: np.array([s[k] for s in scored]) for k in ("policy", "uniform", "comparator", "oracle")}
rng = np.random.default_rng(SEED)
B = [rng.integers(0, len(scored), len(scored)) for _ in range(1000)]
def ci(a):
    return [round(float(x), 4) for x in np.percentile([a[b].mean() for b in B], [2.5, 97.5])]
res = {"curves": len(rows), "hits": int(y.sum()), "labelFrom72h": sum(r["label"] == "72h" for r in rows), "labelFromSettled": sum(r["label"] == "settled" for r in rows),
       "droppedNoFamily": nofam, "days": len(days), "scoredSlates": len(scored), "scoredShorts": int(sum(s["n"] for s in scored)),
       "warmupShorts": int(sum(len(slates[d]) for d in days) - sum(s["n"] for s in scored if True) - sum(len(slates[d]) for d in days if len(slates[d]) < 2 and d not in {s['day'] for s in scored})),
       "policy": round(float(S["policy"].mean()), 4), "uniform": round(float(S["uniform"].mean()), 4),
       "comparator": round(float(S["comparator"].mean()), 4), "oracle": round(float(S["oracle"].mean()), 4),
       "policyMinusUniform": round(float((S["policy"] - S["uniform"]).mean()), 4), "policyMinusUniform95": ci(S["policy"] - S["uniform"]),
       "comparatorMinusUniform": round(float((S["comparator"] - S["uniform"]).mean()), 4), "comparatorMinusUniform95": ci(S["comparator"] - S["uniform"]),
       "slatesWithAnyHit": int(S["oracle"].sum())}
res["pass"] = bool(res["policyMinusUniform95"][0] > 0)
log(json.dumps(res))

shipped, events = Learner(design.D), []
N = len(rows)
for i in range(N):
    fi = design.feats(ctx[i], Zs[i], [])
    logged = i >= N - EVENT_LOG
    if logged:
        bw, bp = shipped.m[fi[0]].copy(), shipped.mean(*fi)
    shipped.update(*fi, y[i])
    if logged:
        r = rows[i]
        events.append({"n": i + 1, "id": r["id"], "title": r["title"], "channel": r["channel"], "channelId": r["channelId"], "family": r["family"],
                       "published": r["published"], "ratio": round(float(r["ratio"]), 3), "outcome": int(y[i]),
                       "arm": {"slate": r["day"], "views6hOverMedian": round(10 ** r["x"][3], 3)},
                       "predicted": [round(bp, 4), round(shipped.mean(*fi), 4)],
                       "weights": [[int(j), round(float(b), 6), round(float(shipped.m[j]), 6)] for j, b in zip(fi[0], bw)], "advice": {}})
model = {"loop": "paid-flight", "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
         "learner": "Bayesian logistic regression, diagonal Laplace posterior, prior N(0,1), per-row updates; pick the slate's highest posterior chance at hour 6 (Thompson sampling in the online epoch)",
         "context": {"family": FAMILIES, "continuous": {n: {"mean": float(mu[j]), "sd": float(sd[j])} for j, n in enumerate(CONT)}},
         "arms": "the day's new shorts, read at hour 6",
         "epochMarker": {"replayRows": N, "lastReplayedPublished": rows[-1]["published"], "lastReplayedId": rows[-1]["id"],
                         "rule": "Updates 1..replayRows are replay of the polled curves (reward: 3x the channel median at 72 hours, settled tier where no 72-hour value). Every update after is a client's own flight."},
         "updates": shipped.n, "features": design.names, "mean": [round(float(x), 6) for x in shipped.m], "precision": [round(float(x), 6) for x in shipped.q],
         "eval": {**res, "slates": scored}}
write_loop("paid-flight", model, events, design.names)
