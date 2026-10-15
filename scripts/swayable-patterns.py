"""Patterns in Swayable's 575 vote-choice ad tests, written to data/generated/swayable-patterns.json.

Usage: python3 scripts/swayable-patterns.py <dir holding studies.csv, regression_ates.csv and
       regression_ates_subgroup__{democrat,independent,republican}.csv from s3://hermes-638175140432/curated/swayable/>

- score: the spread of ad effects (points of vote choice vs. a placebo video), each ad's raw result
  pulled toward the average by its own noise (empirical Bayes, DerSimonian-Laird).
- race, audience: the average ad by race level and by the viewer's party.
- traits: each trait's ads against the other ads in the same study (same campaign, same audience),
  with a 90% range from resampling whole studies.
"""
import csv, json, math, random, statistics as st, sys, collections, pathlib

D = pathlib.Path(sys.argv[1])
ROOT = pathlib.Path(__file__).resolve().parent.parent
ads = json.load(open(ROOT / "data/generated/model/ads.json"))
labels = json.load(open(ROOT / "data/generated/model/reference-model.json"))["featureLabels"]
v = [x for x in ads if x["outcome"] == "votechoice"]
studies = {r["study_id"]: r for r in csv.DictReader(open(D / "studies.csv"))}

def dl(ests):
    w = [1 / s**2 for e, s in ests]
    m = sum(wi * e for wi, (e, s) in zip(w, ests)) / sum(w)
    q = sum(wi * (e - m) ** 2 for wi, (e, s) in zip(w, ests))
    c = sum(w) - sum(wi * wi for wi in w) / sum(w)
    t2 = max(0, (q - (len(ests) - 1)) / c) if c > 0 else 0
    ws = [1 / (s**2 + t2) for e, s in ests]
    return sum(wi * e for wi, (e, s) in zip(ws, ests)) / sum(ws), math.sqrt(1 / sum(ws)), t2

mu, _, t2 = dl([(x["effect"], x["se"]) for x in v])
post = sorted(mu + (x["effect"] - mu) * t2 / (t2 + x["se"] ** 2) for x in v)
pct = lambda p: round(post[int(p * (len(post) - 1))], 2)
score = {"mean": round(mu, 2), "p10": pct(0.1), "p25": pct(0.25), "p50": pct(0.5), "p75": pct(0.75), "p90": pct(0.9), "p99": pct(0.99)}

def group(key):
    g = collections.defaultdict(list)
    for x in v:
        g[key(x)].append((x["effect"], x["se"]))
    out = []
    for k, e in g.items():
        if k and len(e) >= 20:
            m, se, _ = dl(e)
            out.append({"key": k, "ads": len(e), "mean": round(m, 2), "low": round(m - 1.645 * se, 2), "high": round(m + 1.645 * se, 2)})
    return sorted(out, key=lambda r: -r["mean"])

race = group(lambda x: "2018 midterms" if x["year"] == 2018 else (studies.get(x["study"], {}).get("race_level") or None))
audience = []
for f, lab in (("regression_ates_subgroup__independent.csv", "Independents"), ("regression_ates_subgroup__democrat.csv", "Democrats"), ("regression_ates_subgroup__republican.csv", "Republicans")):
    e = [(float(r["estimate"]), float(r["std.error"])) for r in csv.DictReader(open(D / f)) if r["outcome"] == "votechoice" and r["std.error"] not in ("", "NA") and float(r["std.error"]) > 0]
    m, se, _ = dl(e)
    audience.append({"key": lab, "ads": len(e), "mean": round(m, 2), "low": round(m - 1.645 * se, 2), "high": round(m + 1.645 * se, 2)})

by = collections.defaultdict(list)
for x in v:
    by[x["study"]].append(x)
for z in by.values():
    w = [1 / x["se"] ** 2 for x in z]
    m = sum(wi * x["effect"] for wi, x in zip(w, z)) / sum(w)
    for x in z:
        x["dev"] = x["effect"] - m
multi = {s: z for s, z in by.items() if len(z) >= 2}
has = lambda x, t: (x.get(t) or 0) >= 0.5
def diff(rows, t):
    w = [x["dev"] for x in rows if has(x, t)]
    wo = [x["dev"] for x in rows if x.get(t) is not None and not has(x, t)]
    return st.mean(w) - st.mean(wo) if len(w) >= 5 and len(wo) >= 5 else None
rows = [x for z in multi.values() for x in z]
random.seed(1)
keys = list(multi)
boots = [[x for s in random.choices(keys, k=len(keys)) for x in multi[s]] for _ in range(400)]
traits = []
for t, label in labels.items():
    d = diff(rows, t)
    if d is None:
        continue
    bs = sorted(b for b in (diff(r, t) for r in boots) if b is not None)
    traits.append({"key": t, "label": label, "ads": sum(has(x, t) for x in rows), "diff": round(d, 2), "low": round(bs[int(0.05 * len(bs))], 2), "high": round(bs[int(0.95 * len(bs))], 2)})
traits.sort(key=lambda r: -r["diff"])

out = {
    "source": "Swayable replication archive (Hewitt et al., APSR 2024), vote choice",
    "units": "points of vote choice vs. a placebo video",
    "ads": len(v),
    "studies": len(by),
    "score": score,
    "race": race,
    "audience": audience,
    "traits": traits,
}
(ROOT / "data/generated/swayable-patterns.json").write_text(json.dumps(out, indent=1) + "\n")
print(json.dumps({k: out[k] for k in ("score", "race", "audience")}, indent=1))
