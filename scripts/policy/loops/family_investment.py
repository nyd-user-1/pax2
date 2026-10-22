"""Loop 4, channel-family investment: registered in docs/briefs/WINDOW-P2.md before this fit."""
import json, sys
from collections import Counter
sys.path.insert(0, "scripts/policy")
import numpy as np
from learn import SEED, Design, run_factor_loop, settled_catalog

cat, fam_of, cluster = settled_catalog()
rows = [v for v in cat if v["tier"] != "unsettled" and v["channelId"] in fam_of and v["id"] in cluster]
rows.sort(key=lambda v: (v["published"], v["id"]))
for r in rows:
    r["family"] = fam_of[r["channelId"]]
FAMILIES = sorted(set(fam_of.values()))
K = 40
design = Design("topic", list(range(K)), [], [("family", FAMILIES)])
ctx = np.array([cluster[r["id"]] for r in rows])
Z = np.zeros((len(rows), 0))
A = np.array([[FAMILIES.index(r["family"])] for r in rows])
y = np.array([1.0 if r["ratio"] >= 3 else 0.0 for r in rows])
model, shipped, _ = run_factor_loop("family-investment", rows, ctx, Z, A, y, [f"topic{c}" for c in ctx], design,
                                    extra_event=lambda i: {"topic": int(ctx[i])})

channels = json.load(open("data/velocity/channels.json"))
partners = [c for c in channels if c["group"] == "reform-core"]
rng = np.random.default_rng(SEED)
draws = rng.normal(shipped.m, 1 / np.sqrt(shipped.q), size=(1000, design.D))
counsel = []
for p in partners:
    mine = [r for r in rows if r["channelId"] == p["id"]]
    mix = Counter(cluster[r["id"]] for r in mine)
    n = sum(mix.values())
    if not n:
        counsel.append({"partner": p["name"], "channelId": p["id"], "shorts": 0, "counsel": None, "why": "no settled shorts with a topic"})
        continue
    def value(m, f):
        tot = 0.0
        for c, k in mix.items():
            idx, val = design.feats(c, [], [f])
            tot += k / n / (1 + np.exp(-(m[..., idx] @ val)))
        return tot
    point = [float(value(shipped.m, f)) for f in range(len(FAMILIES))]
    dv = np.stack([value(draws, f) for f in range(len(FAMILIES))], axis=1)
    first = np.bincount(dv.argmax(axis=1), minlength=len(FAMILIES)) / len(draws)
    best = int(np.argmax(point))
    counsel.append({"partner": p["name"], "channelId": p["id"], "shorts": n,
                    "topicMix": {str(c): round(k / n, 3) for c, k in mix.most_common()},
                    "counsel": FAMILIES[best],
                    "families": [{"family": FAMILIES[f], "chance": round(point[f], 4), "rankedFirstShare": round(float(first[f]), 3)} for f in range(len(FAMILIES))],
                    "verdict": "PASS" if model["eval"]["pass"] else "FAIL"})
    print(p["name"], n, FAMILIES[best], [(FAMILIES[f], round(point[f], 3), round(float(first[f]), 2)) for f in range(len(FAMILIES))])
model["counsel"] = counsel
json.dump(model, open("data/generated/model/learning/family-investment.json", "w"))
