"""Loop 7, active learning: registered in docs/briefs/WINDOW-P2.md before these lists."""
import json, math, re, sys
from collections import defaultdict
sys.path.insert(0, "scripts/policy")
import numpy as np
from learn import OUT, et_hour, settled_catalog, ts

cat, fam_of, cluster = settled_catalog()
th = json.load(open("data/generated/model/thumb-features.json"))
measured = set(json.load(open("data/generated/model/winning-modes.json"))["scores"])
M = "data/generated/model"
models = {"publish-policy": json.load(open(f"{M}/martian-publish-policy.json"))}
for k in ("title-style", "thumbnail-traits", "posting-cadence", "family-investment"):
    models[k] = json.load(open(f"{OUT}/{k}.json"))
index = {k: {n: j for j, n in enumerate(m["features"])} for k, m in models.items()}

by_ch = defaultdict(list)
for v in cat:
    by_ch[v["channelId"]].append(v)
gap = {}
for vs in by_ch.values():
    vs.sort(key=lambda v: (v["published"], v["id"]))
    for a, b in zip(vs, vs[1:]):
        gap[b["id"]] = (ts(b["published"]) - ts(a["published"])) / 86400
EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿]")
words = lambda t: [w for w in re.sub(r"#\w+", "", t).split() if w]
LEN = [(0, 30, "<=30s"), (31, 60, "31-60s"), (61, 90, "61-90s"), (91, 10**9, ">=91s")]
HB = ["0-3", "4-7", "8-11", "12-15", "16-19", "20-23"]


def std(model, name, x):
    c = model["context"]["continuous"][name]
    return (x - c["mean"]) / c["sd"]


def generic(key, ctxname, c, cont, arms):
    m = models[key]
    f = [("bias", 1.0), (f"{ctxname}={c}", 1.0)] + [(n, std(m, n, x)) for n, x in cont]
    for n, v in arms.items():
        f += [(f"{n}={v}", 1.0), (f"{ctxname}={c}|{n}={v}", 1.0)]
    return f


def features(v):
    out = {}
    fam = fam_of.get(v["channelId"])
    if fam is None:
        return out
    lm = math.log10(max(v["channelMedian"], 1))
    cl = cluster.get(v["id"])
    if cl is not None:
        pp = models["publish-policy"]
        lb = next(l for lo, hi, l in LEN if lo <= v["durationSec"] <= hi)
        hb = HB[et_hour(v["published"]) // 4]
        z = (lm - pp["context"]["log10ChannelMedian"]["mean"]) / pp["context"]["log10ChannelMedian"]["sd"]
        out["publish-policy"] = [("bias", 1.0), (f"family={fam}", 1.0), ("log10ChannelMedian(z)", z), (f"topic={cl}", 1.0), (f"length={lb}", 1.0),
                                 (f"hour={hb}", 1.0), (f"family={fam}|topic={cl}", 1.0), (f"family={fam}|length={lb}", 1.0), (f"family={fam}|hour={hb}", 1.0)]
        out["family-investment"] = generic("family-investment", "topic", cl, [], {"family": fam})
    t, ws = v["title"], words(v["title"])
    yn = lambda b: "yes" if b else "no"
    out["title-style"] = generic("title-style", "family", fam, [("log10ChannelMedian", lm)], {
        "question": yn("?" in t), "digit": yn(re.search(r"\d", t)), "caps": yn(any(re.fullmatch(r"[A-Z]{4,}[!?.,]*", w) for w in ws)),
        "emoji": yn(EMOJI.search(t)), "length": "<=6 words" if len(ws) <= 6 else ("7-14 words" if len(ws) <= 14 else ">=15 words")})
    if v["id"] in th:
        cuts = models["thumbnail-traits"]["arms"]["cutPoints"]
        Q = models["thumbnail-traits"]["arms"]["memorability"]
        arms = {n: Q[int(np.searchsorted(cuts[n], th[v["id"]][k], side="right"))] for n, k in
                [("memorability", "mem"), ("brightness", "bright"), ("contrast", "contrast"), ("colorfulness", "color")]}
        out["thumbnail-traits"] = generic("thumbnail-traits", "family", fam, [("log10ChannelMedian", lm)], arms)
    if v["id"] in gap:
        g = gap[v["id"]]
        lab = models["posting-cadence"]["arms"]["gap"][int(np.searchsorted([1, 2, 4, 8], g, side="right"))]
        out["posting-cadence"] = generic("posting-cadence", "family", fam, [("log10ChannelMedian", lm)], {"gap": lab})
    return out


def score(v):
    res = {}
    for k, f in features(v).items():
        idx = np.array([index[k][n] for n, _ in f])
        val = np.array([x for _, x in f])
        m, q = np.array(models[k]["mean"])[idx], np.array(models[k]["precision"])[idx]
        res[k] = (1 / (1 + math.exp(-float(m @ val))), float((val ** 2 / q).sum()))
    return res


for k in models:  # cache arrays once
    models[k]["mean"] = np.array(models[k]["mean"])
    models[k]["precision"] = np.array(models[k]["precision"])
H = lambda p: -(p * math.log(p) + (1 - p) * math.log(1 - p))
measure, audit, uncovered = [], [], {"measure": 0, "audit": 0}
for v in cat:
    s = score(v)
    is_measured = v["id"] in measured
    if not is_measured:
        if not s:
            uncovered["measure"] += 1
            continue
        p = float(np.mean([a for a, _ in s.values()]))
        measure.append({"id": v["id"], "title": v["title"], "channel": v["channel"], "tier": v["tier"], "published": v["published"],
                        "logitVariance": round(float(np.mean([b for _, b in s.values()])), 5), "entropy": round(H(p), 5), "meanChance": round(p, 4),
                        "models": {k: {"chance": round(a, 4), "logitVariance": round(b, 5)} for k, (a, b) in s.items()}})
    elif v["tier"] != "unsettled":
        if not s:
            uncovered["audit"] += 1
            continue
        p = float(np.mean([a for a, _ in s.values()]))
        y = v["ratio"] >= 3
        audit.append({"id": v["id"], "title": v["title"], "channel": v["channel"], "published": v["published"], "ratio": v["ratio"], "outperformed3x": y,
                      "surprise": round(-math.log(p if y else 1 - p), 4), "meanChance": round(p, 4),
                      "models": {k: round(a, 4) for k, (a, _) in s.items()}})
measure.sort(key=lambda r: (-r["logitVariance"], -r["entropy"]))
audit.sort(key=lambda r: -r["surprise"])
for i, r in enumerate(measure):
    r["rank"] = i + 1
for i, r in enumerate(audit):
    r["rank"] = i + 1
summ = {"measureEligible": len(measure), "auditEligible": len(audit), "uncovered": uncovered,
        "measureTop500": {"tiers": dict(zip(*np.unique([r["tier"] for r in measure[:500]], return_counts=True))) if measure else {},
                          "logitVarianceRange": [measure[499]["logitVariance"], measure[0]["logitVariance"]],
                          "meanModelsCovering": round(float(np.mean([len(r["models"]) for r in measure[:500]])), 2)},
        "measureAllMedianLogitVariance": float(np.median([r["logitVariance"] for r in measure])),
        "auditTop500": {"outperformed": int(sum(r["outperformed3x"] for r in audit[:500])), "surpriseRange": [audit[499]["surprise"], audit[0]["surprise"]],
                        "medianRatio": float(np.median([r["ratio"] for r in audit[:500]]))},
        "auditAllMedianSurprise": float(np.median([r["surprise"] for r in audit]))}
summ["measureTop500"]["tiers"] = {str(k): int(c) for k, c in summ["measureTop500"]["tiers"].items()}
summ["complete"] = bool(measure and audit)
print(json.dumps(summ, indent=1))
json.dump({"loop": "active-learning", "registration": "docs/briefs/WINDOW-P2.md loop 7", "models": list(models), "summary": summ,
           "verdict": "complete" if summ["complete"] else "incomplete", "measureNext": measure[:500], "auditNext": audit[:500]},
          open(f"{OUT}/active-learning.json", "w"))
for r in audit[:5]:
    print("audit", r["rank"], r["surprise"], r["ratio"], r["channel"], r["title"][:60])
for r in measure[:5]:
    print("measure", r["rank"], r["logitVariance"], r["tier"], r["channel"], list(r["models"]), r["title"][:50])
