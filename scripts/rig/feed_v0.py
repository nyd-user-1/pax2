"""PAX2 Feed Ranker, v0: which short a given reader will watch through, pretrained on KuaiRand-1K's
randomly exposed impressions, the way PAX2 Retention Regressor v0 was, until PAX2's own usage rows
(requirement 11) number in the thousands.

KuaiRand-1K from Zenodo (record 10439422); a rehearsal uses KuaiRand-Pure. Random-exposure rows only
(is_rand = 1), so no recommender chose what the user saw. Target: long_view (KuaiRand's own label for a
watch past its threshold), falling back to watch ratio at least 0.5. Each impression is a row of
  video features     ten duration buckets, upload type, the top 100 tags
  reader features    the reader's share of long views so far, how many impressions so far (log), and the
                     reader's prior long-view share on each of the video's tags (mean over its tags),
                     all computed from the reader's earlier impressions only, in time order
Two L2 logistic regressions on the same rows: video features alone, and video plus reader features.
Held out by reader, 80/20. Reports pooled AUC and within-reader AUC (mean over held-out readers with
both labels, weighted by impressions) for both, so the gain from knowing the reader is the measured
number. Writes feed-v0.json with the weights, the tag list and eight check rows for a Node reader.
"""
import glob, os, shutil, subprocess, time, urllib.request

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

from common import MODE, dump, log, r3

JOB = "feed"
NAME = "KuaiRand-Pure" if MODE == "rehearse" else "KuaiRand-1K"
SUFFIX = "pure" if MODE == "rehearse" else "1k"
URL = f"https://zenodo.org/records/10439422/files/{NAME}.tar.gz"
CAP = 10 * 1024**3
D = "/work/kuairand"
os.makedirs(D, exist_ok=True)


def skip(reason):
    log(f"feed: SKIPPED: {reason}")
    dump(JOB, "feed-v0.json", {"name": "PAX2 Feed Ranker", "skipped": reason, "source": URL})
    raise SystemExit(0)


logs = glob.glob(f"{D}/**/log_random_*_{SUFFIX}.csv", recursive=True)
basic = glob.glob(f"{D}/**/video_features_basic_{SUFFIX}.csv", recursive=True)
if not logs or not basic:
    try:
        with urllib.request.urlopen(urllib.request.Request(URL, method="HEAD"), timeout=60) as r:
            size = int(r.headers.get("Content-Length") or 0)
    except Exception as e:
        skip(f"HEAD {URL} failed: {type(e).__name__}: {e}")
    log(f"feed: {NAME} is {size / 1e9:.2f} GB")
    if size > CAP:
        skip(f"{NAME} is {size / 1e9:.1f} GB, over the 10 GB cap")
    t0 = time.time()
    tgz = f"{D}/{NAME}.tar.gz"
    if shutil.which("aria2c"):
        cmd = ["timeout", "2400", "aria2c", "-q", "-x", "16", "-s", "16", "-k", "4M", "--file-allocation=none", "--max-tries=5", "-d", D, "-o", os.path.basename(tgz), URL]
    else:
        cmd = ["curl", "-sSfL", "--retry", "3", "--max-time", "2400", "-o", tgz, URL]
    rc = subprocess.call(cmd)
    got = os.path.getsize(tgz) if os.path.exists(tgz) else 0
    if rc != 0 or got < size * 0.99:
        skip(f"download failed: exit {rc} after {time.time() - t0:.0f}s, {got} of {size} bytes")
    log(f"feed: downloaded {got / 1e9:.2f} GB in {time.time() - t0:.0f}s")
    rc = subprocess.call(["tar", "-xzf", tgz, "-C", D, "--wildcards", f"*log_random_*_{SUFFIX}.csv", f"*video_features_basic_{SUFFIX}.csv"])
    logs = glob.glob(f"{D}/**/log_random_*_{SUFFIX}.csv", recursive=True)
    basic = glob.glob(f"{D}/**/video_features_basic_{SUFFIX}.csv", recursive=True)
    if rc != 0 or not logs or not basic:
        skip(f"extract failed: tar exit {rc}, random logs {logs}, basic features {basic}")
    os.remove(tgz)

t0 = time.time()
cols = pd.read_csv(logs[0], nrows=1).columns.tolist()
want = [c for c in ["user_id", "video_id", "time_ms", "is_rand", "play_time_ms", "duration_ms", "long_view", "is_click", "is_like"] if c in cols]
L = pd.concat([pd.read_csv(p, usecols=want) for p in logs])
n_all = len(L)
L = L[(L.is_rand == 1) & (L.duration_ms > 0)].copy()
L["ratio"] = (L.play_time_ms / L.duration_ms).clip(upper=1.0)
L["y"] = (L.long_view.astype(int) if "long_view" in L.columns else (L.ratio >= 0.5).astype(int))
label = "long_view" if "long_view" in L.columns else "watch ratio >= 0.5"
V = pd.read_csv(basic[0], usecols=["video_id", "upload_type", "tag", "video_duration"])
L = L.merge(V, on="video_id", how="left")
L = L.sort_values(["user_id", "time_ms"]).reset_index(drop=True)
L["tags"] = L.tag.fillna("").astype(str).str.split(",")
log(f"feed: {n_all} random-log rows, {len(L)} impressions with is_rand=1 and a duration, {L.user_id.nunique()} readers, {L.video_id.nunique()} videos, label {label}, positive rate {L.y.mean():.3f}")

# Reader features from the reader's past only: running counts shifted by one.
g = L.groupby("user_id")
L["seen"] = g.cumcount()
L["pos_before"] = g.y.cumsum() - L.y
L["reader_rate"] = np.where(L.seen > 0, L.pos_before / L.seen.clip(lower=1), np.nan)
L["log_seen"] = np.log1p(L.seen)
# Reader-by-tag affinity: prior long-view share on each of the video's tags, mean over tags; absent → the reader's overall rate.
tag_pos, tag_n = {}, {}
aff = np.full(len(L), np.nan)
for i, (u, ts, y) in enumerate(zip(L.user_id.to_numpy(), L.tags.to_numpy(), L.y.to_numpy())):
    vals = []
    for t in ts:
        if not t:
            continue
        k = (u, t)
        n = tag_n.get(k, 0)
        if n:
            vals.append(tag_pos.get(k, 0) / n)
    if vals:
        aff[i] = float(np.mean(vals))
    for t in ts:
        if t:
            k = (u, t)
            tag_n[k] = tag_n.get(k, 0) + 1
            tag_pos[k] = tag_pos.get(k, 0) + int(y)
L["tag_aff"] = aff
log(f"feed: reader features built in {time.time() - t0:.0f}s")

users = np.array(sorted(L.user_id.unique()))
rng = np.random.default_rng(11)
held_users = set(rng.choice(users, size=int(len(users) * 0.2), replace=False).tolist())
tr = ~L.user_id.isin(held_users)
edges = np.unique(np.quantile(L.duration_ms, np.linspace(0, 1, 11)))
L["dbin"] = np.clip(np.searchsorted(edges, L.duration_ms, side="right") - 1, 0, len(edges) - 2)
top_tags = pd.Series([t for ts in L[tr].tags for t in ts if t]).value_counts().head(100).index.tolist()
tag_idx = {t: i for i, t in enumerate(top_tags)}
uploads = L[tr].upload_type.fillna("unknown").value_counts().index.tolist()
up_idx = {u: i for i, u in enumerate(uploads)}
base_rate = float(L[tr].y.mean())
VIDEO_NAMES = [f"dur:{i}" for i in range(len(edges) - 1)] + [f"upload:{u}" for u in uploads] + [f"tag:{t}" for t in top_tags]
READER_NAMES = ["reader_rate", "reader_rate_known", "log_seen", "tag_aff", "tag_aff_known"]
NAMES = VIDEO_NAMES + READER_NAMES


def design(df):
    X = np.zeros((len(df), len(NAMES)), dtype=np.float32)
    nd = len(edges) - 1
    X[np.arange(len(df)), df.dbin.to_numpy()] = 1
    for i, u in enumerate(df.upload_type.fillna("unknown")):
        if u in up_idx:
            X[i, nd + up_idx[u]] = 1
    off = nd + len(uploads)
    for i, ts in enumerate(df.tags):
        for t in ts:
            if t in tag_idx:
                X[i, off + tag_idx[t]] = 1
    r = len(VIDEO_NAMES)
    rr = df.reader_rate.to_numpy()
    X[:, r] = np.where(np.isnan(rr), base_rate, rr)
    X[:, r + 1] = (~np.isnan(rr)).astype(np.float32)
    X[:, r + 2] = df.log_seen.to_numpy()
    ta = df.tag_aff.to_numpy()
    X[:, r + 3] = np.where(np.isnan(ta), np.where(np.isnan(rr), base_rate, rr), ta)
    X[:, r + 4] = (~np.isnan(ta)).astype(np.float32)
    return X


Xtr, ytr = design(L[tr]), L[tr].y.to_numpy()
Xte, yte = design(L[~tr]), L[~tr].y.to_numpy()
ute = L[~tr].user_id.to_numpy()
video_cols = np.arange(len(VIDEO_NAMES))
all_cols = np.arange(len(NAMES))


def within(pred):
    num, den, n = 0.0, 0, 0
    for u in np.unique(ute):
        m = ute == u
        if yte[m].min() == yte[m].max():
            continue
        num += roc_auc_score(yte[m], pred[m]) * m.sum()
        den += m.sum()
        n += 1
    return (num / den if den else None), n


results = {}
models = {}
for name, cols in [("video", video_cols), ("video+reader", all_cols)]:
    m = LogisticRegression(C=0.1, max_iter=3000).fit(Xtr[:, cols], ytr)
    p = m.predict_proba(Xte[:, cols])[:, 1]
    w, n_users = within(p)
    results[name] = {"pooledAuc": r3(roc_auc_score(yte, p)), "withinReaderAuc": None if w is None else r3(w), "readersScored": n_users}
    models[name] = m
    log(f"feed: {name}: pooled AUC {results[name]['pooledAuc']}, within reader {results[name]['withinReaderAuc']} over {n_users} held-out readers")

m = models["video+reader"]
held_rows = L[~tr]
checks = []
for i in np.linspace(0, len(held_rows) - 1, 8).astype(int):
    row = held_rows.iloc[i]
    x = Xte[i]
    checks.append({"x": {NAMES[j]: float(x[j]) for j in range(len(NAMES)) if x[j] != 0}, "p": r3(float(m.predict_proba(x[None, :])[0, 1])), "y": int(row.y)})
out = {
    "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "name": "PAX2 Feed Ranker",
    "version": "feed-0",
    "source": URL,
    "dataset": NAME,
    "label": label,
    "method": "L2 logistic regression (C 0.1) on random-exposure impressions; video features (duration decile, upload type, top-100 tags) alone, then with reader features from the reader's earlier impressions (long-view share so far, log impressions so far, prior share on the video's tags); held out by reader 80/20",
    "counts": {"impressions": int(len(L)), "train": int(tr.sum()), "heldOut": int((~tr).sum()), "readers": int(L.user_id.nunique()), "heldOutReaders": len(held_users), "videos": int(L.video_id.nunique())},
    "positiveRate": r3(float(L.y.mean())),
    "results": results,
    "readerGain": {"pooled": r3(results["video+reader"]["pooledAuc"] - results["video"]["pooledAuc"]), "withinReader": None if results["video"]["withinReaderAuc"] is None else r3(results["video+reader"]["withinReaderAuc"] - results["video"]["withinReaderAuc"])},
    "durationEdgesMs": [int(e) for e in edges],
    "uploadTypes": uploads,
    "tags": top_tags,
    "features": NAMES,
    "intercept": r3(float(m.intercept_[0])),
    "weights": [r3(float(v)) for v in m.coef_[0]],
    "baseRate": r3(base_rate),
    "checks": checks,
    "seconds": round(time.time() - t0),
}
dump(JOB, "feed-v0.json", out)
log(f"feed: wrote feed-v0.json in {time.time() - t0:.0f}s; reader gain pooled {out['readerGain']['pooled']}, within reader {out['readerGain']['withinReader']}")
