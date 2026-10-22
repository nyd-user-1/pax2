"""Loop 2, thumbnail traits: registered in docs/briefs/WINDOW-P2.md before this fit."""
import json, math, sys
sys.path.insert(0, "scripts/policy")
import numpy as np
from learn import Design, run_factor_loop, settled_catalog

cat, fam_of, _ = settled_catalog()
th = json.load(open("data/generated/model/thumb-features.json"))
rows = [v for v in cat if v["tier"] != "unsettled" and v["channelId"] in fam_of and v["id"] in th]
rows.sort(key=lambda v: (v["published"], v["id"]))
for r in rows:
    r["family"] = fam_of[r["channelId"]]
FAMILIES = sorted(set(fam_of.values()))
KEYS = [("memorability", "mem"), ("brightness", "bright"), ("contrast", "contrast"), ("colorfulness", "color")]
SPLIT = int(0.8 * len(rows))
raw = np.array([[th[r["id"]][k] for _, k in KEYS] for r in rows])
cuts = [np.percentile(raw[:SPLIT, j], [25, 50, 75]) for j in range(len(KEYS))]
A = np.array([[int(np.searchsorted(cuts[j], raw[i, j], side="right")) for j in range(len(KEYS))] for i in range(len(rows))])
print("cuts", {n: [round(float(x), 3) for x in cuts[j]] for j, (n, _) in enumerate(KEYS)})
Q = ["Q1 (lowest)", "Q2", "Q3", "Q4 (highest)"]
design = Design("family", FAMILIES, ["log10ChannelMedian"], [(n, Q) for n, _ in KEYS])
ctx = np.array([FAMILIES.index(r["family"]) for r in rows])
Z = np.array([[math.log10(max(r["channelMedian"], 1))] for r in rows])
y = np.array([1.0 if r["ratio"] >= 3 else 0.0 for r in rows])
model, _, _ = run_factor_loop("thumbnail-traits", rows, ctx, Z, A, y, [r["channelId"] for r in rows], design)
model["arms"]["cutPoints"] = {n: [round(float(x), 4) for x in cuts[j]] for j, (n, _) in enumerate(KEYS)}
json.dump(model, open("data/generated/model/learning/thumbnail-traits.json", "w"))
