"""Loop 5, remake candidates: registered in docs/briefs/WINDOW-P2.md before this list."""
import json, sys
sys.path.insert(0, "scripts/policy")
import numpy as np
from learn import SEED, OUT, auc, settled_catalog

cat, fam_of, cluster = settled_catalog()
tl = json.load(open("data/generated/model/topic-lift.json"))
wm = json.load(open("data/generated/model/winning-modes.json"))
mode = next(m["name"] for m in wm["full"]["modes"] if m["survived"])
hot = {t["id"]: t for t in tl["topics"] if t["low"] > 0}
rows = [v for v in cat if v["tier"] != "unsettled" and v["id"] in wm["scores"] and cluster.get(v["id"]) in hot]
out = []
for v in rows:
    t = hot[cluster[v["id"]]]
    m = wm["scores"][v["id"]]
    out.append({"id": v["id"], "title": v["title"], "channel": v["channel"], "channelId": v["channelId"], "family": fam_of.get(v["channelId"]),
                "published": v["published"], "score": round(t["lift"] * (100 - m) / 100, 3),
                "grounds": {"topic": t["name"], "topicId": t["id"], "topicLift": t["lift"], "topicLift90": [t["low"], t["high"]],
                            "modeMatch": m, "mode": mode, "ratio": v["ratio"], "outperformed3x": v["ratio"] >= 3}})
out.sort(key=lambda r: (-r["score"], r["grounds"]["ratio"]))
for i, r in enumerate(out):
    r["rank"] = i + 1
match = np.array([r["grounds"]["modeMatch"] for r in out], dtype=float)
y = np.array([r["grounds"]["outperformed3x"] for r in out], dtype=float)
ch = np.array([r["channelId"] for r in out])
point = auc(match, y)
rng = np.random.default_rng(SEED)
uch = sorted(set(ch))
idx = {c: np.where(ch == c)[0] for c in uch}
bs = []
for _ in range(1000):
    s = np.concatenate([idx[c] for c in rng.choice(uch, size=len(uch), replace=True)])
    if 0 < y[s].sum() < len(s):
        bs.append(auc(match[s], y[s]))
lo, hi = np.percentile(bs, [2.5, 97.5])
supported = bool(lo > 0.5)
top = out[:200]
summary = {"eligible": len(out), "channels": len(uch), "topics": {str(k): {"name": t["name"], "lift": t["lift"], "lift90": [t["low"], t["high"]], "eligible": int(sum(r["grounds"]["topicId"] == k for r in out))} for k, t in hot.items()},
           "outperformedShare": round(float(y.mean()), 4), "matchAuc": round(point, 4), "matchAuc95": [round(float(lo), 4), round(float(hi), 4)], "bootstrapsKept": len(bs),
           "supported": supported, "top200OutperformedShare": round(float(np.mean([r["grounds"]["outperformed3x"] for r in top])), 4),
           "top200MedianRatio": float(np.median([r["grounds"]["ratio"] for r in top]))}
print(json.dumps(summary, indent=1))
json.dump({"loop": "remake-candidates", "registration": "docs/briefs/WINDOW-P2.md loop 5", "mode": mode, "summary": summary,
           "verdict": "supported" if supported else "unsupported", "rows": out}, open(f"{OUT}/remake-candidates.json", "w"))
for r in out[:10]:
    print(r["rank"], r["score"], r["grounds"]["topic"], r["grounds"]["modeMatch"], r["grounds"]["ratio"], r["channel"], r["title"][:60])
