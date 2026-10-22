"""Loop 3, posting cadence: registered in docs/briefs/WINDOW-P2.md before this fit."""
import math, sys
from collections import defaultdict
sys.path.insert(0, "scripts/policy")
import numpy as np
from learn import Design, run_factor_loop, settled_catalog, ts

cat, fam_of, _ = settled_catalog()
by_ch = defaultdict(list)
for v in cat:
    by_ch[v["channelId"]].append(v)
gap = {}
for vs in by_ch.values():
    vs.sort(key=lambda v: (v["published"], v["id"]))
    for prev, cur in zip(vs, vs[1:]):
        gap[cur["id"]] = (ts(cur["published"]) - ts(prev["published"])) / 86400
EDGES = [1, 2, 4, 8]
BUCKETS = ["<1 day", "1-2 days", "2-4 days", "4-8 days", ">=8 days"]
rows = [v for v in cat if v["tier"] != "unsettled" and v["channelId"] in fam_of and v["id"] in gap]
rows.sort(key=lambda v: (v["published"], v["id"]))
for r in rows:
    r["family"] = fam_of[r["channelId"]]
FAMILIES = sorted(set(fam_of.values()))
A = np.array([[int(np.searchsorted(EDGES, gap[r["id"]], side="right"))] for r in rows])
print("dropped as first in channel:", sum(1 for v in cat if v["tier"] != "unsettled" and v["channelId"] in fam_of and v["id"] not in gap),
      "bucket counts", np.bincount(A[:, 0]))
design = Design("family", FAMILIES, ["log10ChannelMedian"], [("gap", BUCKETS)])
ctx = np.array([FAMILIES.index(r["family"]) for r in rows])
Z = np.array([[math.log10(max(r["channelMedian"], 1))] for r in rows])
y = np.array([1.0 if r["ratio"] >= 3 else 0.0 for r in rows])
run_factor_loop("posting-cadence", rows, ctx, Z, A, y, [r["channelId"] for r in rows], design,
                extra_event=lambda i: {"gapDays": round(gap[rows[i]["id"]], 2)})
