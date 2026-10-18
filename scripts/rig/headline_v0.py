"""B6. PAX2 Headline Ranker, v0: which of two headlines wins the click, from features a browser computes.

Upworthy Research Archive, confirmatory packages. Within each test, packages are pooled by headline
across image variants; headlines with at least 1,000 pooled impressions stay; the winner is the
highest pooled click rate and is paired against each loser. Features: the ten pattern flags of
src/lib/headline-patterns.ts (re-implemented below and asserted against that file's own output in
headline-fixture.json, rule 15), log word count, log character count (UTF-16 units, as JavaScript
counts), and binary presence of the 2,000 most frequent lowercase tokens in the training headlines.
Pairwise logistic regression on the feature difference (pair order randomized), split by test id
80/20. Reports pairwise accuracy against 50% and against the flags-only model. Writes headline-model.json.
"""
import json, math, os, re, time

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold

from common import BUCKET, CODE, dump, log, s3

JOB = "headline"
KEY = "curated/upworthy/upworthy-archive-confirmatory-packages-03.12.2020.parquet"
MIN_IMPRESSIONS = 1000
VOCAB = 2000
TOKEN = r"[a-z0-9']+"
rng = np.random.default_rng(7)

# The same tests as PATTERN_TESTS in src/lib/headline-patterns.ts. JavaScript regexes without the u
# flag treat \b, \d and case-insensitivity as ASCII, hence re.ASCII.
PATTERNS = {
    "digit": (r"\d", 0),
    "this": (r"^(this|these)\b", re.I),
    "question": (r"\?", 0),
    "you": (r"\byou(r|['’]re)?\b", re.I),
    "quote": (r"[“”\"]", 0),
    "caps": (r"\b[A-Z]{3,}\b", 0),
    "whatwhyhow": (r"^(what|why|how)\b", re.I),
    "watch": (r"\b(watch|see|listen)\b", re.I),
    "ellipsis": (r"(\.\.\.|…|—| - )", 0),
    "firstperson": (r"\b(i|i['’]m|my|me)\b", re.I),
}
JS_FLAGS = {"digit": "", "this": "i", "question": "", "you": "i", "quote": "", "caps": "", "whatwhyhow": "i", "watch": "i", "ellipsis": "", "firstperson": "i"}
COMPILED = {k: re.compile(p, f | re.ASCII) for k, (p, f) in PATTERNS.items()}
FLAG_KEYS = list(PATTERNS)


def flags(h):
    return [1.0 if COMPILED[k].search(h) else 0.0 for k in FLAG_KEYS]


def tokens(h):
    return set(re.findall(TOKEN, h.lower().replace("’", "'")))


def utf16_len(h):
    return len(h.encode("utf-16-le")) // 2


def counts(h):
    return [math.log1p(len(h.split())), math.log1p(utf16_len(h))]


# Rule 15: the regexes must agree with the TypeScript file on its own output.
fixture = json.load(open(os.path.join(CODE, "headline-fixture.json")))
bad = [(f["text"], k) for f in fixture for k in FLAG_KEYS if bool(COMPILED[k].search(f["text"])) != f["flags"][k]]
log(f"headline: fixture {len(fixture)} titles x {len(FLAG_KEYS)} flags, {len(bad)} disagreements with headline-patterns.ts")
if bad:
    log(f"headline: FIXTURE MISMATCH, first: {bad[:5]}")
    raise SystemExit(1)

s3.download_file(BUCKET, KEY, "/work/upworthy.parquet")
df = pd.read_parquet("/work/upworthy.parquet", columns=["clickability_test_id", "headline", "impressions", "clicks"])
df = df.dropna(subset=["headline"])
log(f"headline: {len(df)} packages, {df.clickability_test_id.nunique()} tests")
g = df.groupby(["clickability_test_id", "headline"], as_index=False)[["impressions", "clicks"]].sum()
g = g[g.impressions >= MIN_IMPRESSIONS].copy()
g["ctr"] = g.clicks / g.impressions
pairs, skipped_ties = [], 0
for tid, t in g.groupby("clickability_test_id"):
    if len(t) < 2:
        continue
    t = t.sort_values("ctr", ascending=False)
    if t.ctr.iloc[0] == t.ctr.iloc[1]:
        skipped_ties += 1
        continue
    w = t.headline.iloc[0]
    for l in t.headline.iloc[1:]:
        pairs.append((tid, w, l))
tests = sorted({p[0] for p in pairs})
log(f"headline: {len(g)} pooled headlines with {MIN_IMPRESSIONS}+ impressions, {len(tests)} tests, {len(pairs)} winner-loser pairs, {skipped_ties} tied tests skipped")

perm = rng.permutation(len(tests))
test_ids = {tests[i] for i in perm[: int(len(tests) * 0.2)]}
train_pairs = [p for p in pairs if p[0] not in test_ids]
held_pairs = [p for p in pairs if p[0] in test_ids]
train_heads = sorted({h for p in train_pairs for h in p[1:]})
freq = {}
for h in train_heads:
    for tok in tokens(h):
        freq[tok] = freq.get(tok, 0) + 1
vocab = [t for t, _ in sorted(freq.items(), key=lambda kv: (-kv[1], kv[0]))[:VOCAB]]
vidx = {t: i for i, t in enumerate(vocab)}
NAMES = FLAG_KEYS + ["logWords", "logChars"] + [f"tok:{t}" for t in vocab]


def feats(h):
    v = np.zeros(len(NAMES))
    v[:10] = flags(h)
    v[10:12] = counts(h)
    for tok in tokens(h):
        if tok in vidx:
            v[12 + vidx[tok]] = 1.0
    return v


cache = {}
F = lambda h: cache.setdefault(h, feats(h))


def design(ps, cols):
    X, y, grp = [], [], []
    for tid, w, l in ps:
        d = F(w) - F(l)
        if rng.random() < 0.5:
            X.append(d[cols])
            y.append(1)
        else:
            X.append(-d[cols])
            y.append(0)
        grp.append(tid)
    return np.array(X), np.array(y), np.array(grp)


def accuracy(model, ps, cols):
    if not ps:
        return None
    D = np.array([(F(w) - F(l))[cols] for _, w, l in ps])
    return float((model.predict_proba(D)[:, 1] > 0.5).mean())


def train(cols, label):
    X, y, grp = design(train_pairs, cols)
    best = None
    for C in (0.01, 0.03, 0.1, 0.3, 1.0):
        accs = []
        for tr, va in GroupKFold(5).split(X, y, grp):
            m = LogisticRegression(C=C, max_iter=2000).fit(X[tr], y[tr])
            accs.append((m.predict(X[va]) == y[va]).mean())
        a = float(np.mean(accs))
        if best is None or a > best[1]:
            best = (C, a)
    m = LogisticRegression(C=best[0], max_iter=2000).fit(X, y)
    acc = accuracy(m, held_pairs, cols)
    log(f"headline: {label}: C={best[0]} cv {best[1]:.3f}, held-out pairwise accuracy {acc:.3f} on {len(held_pairs)} pairs")
    return m, best, acc


t0 = time.time()
all_cols = np.arange(len(NAMES))
flag_cols = np.arange(12)
m_full, cv_full, acc_full = train(all_cols, "flags + counts + tokens")
m_flags, cv_flags, acc_flags = train(flag_cols, "flags + counts only")

H = np.array([F(h) for h in train_heads])
means = H.mean(0)
w = m_full.coef_[0]
b = float(m_full.intercept_[0])
held_heads = sorted({h for p in held_pairs for h in p[1:]})
checks = []
for h in held_heads[:: max(1, len(held_heads) // 8)][:8]:
    checks.append({"text": h, "p": round(float(1 / (1 + math.exp(-(b + float(w @ (F(h) - means)))))), 6)})

out = {
    "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "name": "PAX2 Headline Ranker",
    "version": "headline-0",
    "source": f"s3://{BUCKET}/{KEY}",
    "method": f"pairwise L2 logistic regression on the feature difference of winner and loser (order randomized), headlines pooled across image variants within each test, {MIN_IMPRESSIONS}+ impressions; split by test id 80/20; C chosen by 5-fold grouped CV on the training tests",
    "score": "p(beats a typical rival) = sigmoid(intercept + sum_j weight_j * (feature_j - mean_j)), means over the training headlines",
    "counts": {"tests": len(tests), "pairs": len(pairs), "trainPairs": len(train_pairs), "heldOutPairs": len(held_pairs), "heldOutTests": len(test_ids), "trainHeadlines": len(train_heads)},
    "heldOutAccuracy": round(acc_full, 4),
    "baseline": 0.5,
    "flagsOnlyAccuracy": round(acc_flags, 4),
    "cv": {"full": {"C": cv_full[0], "acc": round(cv_full[1], 4)}, "flagsOnly": {"C": cv_flags[0], "acc": round(cv_flags[1], 4)}},
    "patterns": {k: {"source": PATTERNS[k][0], "flags": JS_FLAGS[k]} for k in FLAG_KEYS},
    "token": {"regex": TOKEN, "lowercase": True, "apostrophe": "’ becomes ' before matching"},
    "counts_features": {"logWords": "ln(1 + words split on whitespace)", "logChars": "ln(1 + length in UTF-16 units)"},
    "vocabulary": vocab,
    "features": NAMES,
    "weights": [round(float(v), 5) for v in w],
    "means": [round(float(v), 5) for v in means],
    "intercept": round(b, 5),
    "checks": checks,
}
dump(JOB, "headline-model.json", out)
log(f"headline: wrote headline-model.json in {time.time() - t0:.0f}s: accuracy {acc_full:.3f} vs 0.5 and flags-only {acc_flags:.3f}")
