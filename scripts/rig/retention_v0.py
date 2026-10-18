"""B7. PAX2 Retention Regressor, v0: how much of a short a viewer watches, from its length, upload type
and tags, on KuaiRand's randomly exposed impressions (no recommender selection in those rows).

KuaiRand-1K from Zenodo (record 10439422, linked from kuairand.com); a rehearsal uses KuaiRand-Pure,
which has the same files at 194 MB. Skipped, with the reason, when the archive exceeds 10 GB or the
download fails. Random-exposure rows only (is_rand = 1), watch ratio = play_time / duration capped at
1, ridge regression on ten duration buckets, upload type and the top 100 tags, held out by video id
80/20. Reports Spearman between predicted and observed mean watch ratio per held-out video, and the
duration-to-watch-ratio curve in ten buckets. Writes retention-v0.json.
"""
import glob, os, shutil, subprocess, time, urllib.request

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge

from common import MODE, dump, log, r3

JOB = "retention"
NAME = "KuaiRand-Pure" if MODE == "rehearse" else "KuaiRand-1K"
SUFFIX = "pure" if MODE == "rehearse" else "1k"
URL = f"https://zenodo.org/records/10439422/files/{NAME}.tar.gz"
CAP = 10 * 1024**3
D = "/work/kuairand"
os.makedirs(D, exist_ok=True)


def skip(reason):
    log(f"retention: SKIPPED: {reason}")
    dump(JOB, "retention-v0.json", {"name": "PAX2 Retention Regressor", "skipped": reason, "source": URL})
    raise SystemExit(0)


try:
    with urllib.request.urlopen(urllib.request.Request(URL, method="HEAD"), timeout=60) as r:
        size = int(r.headers.get("Content-Length") or 0)
except Exception as e:
    skip(f"HEAD {URL} failed: {type(e).__name__}: {e}")
log(f"retention: {NAME} is {size / 1e9:.2f} GB")
if size > CAP:
    skip(f"{NAME} is {size / 1e9:.1f} GB, over the 10 GB cap")
t0 = time.time()
tgz = f"{D}/{NAME}.tar.gz"
# Zenodo serves about 0.2 to 1 MB/s per connection and honors ranges, so 16 connections; 40 minutes at most.
if shutil.which("aria2c"):
    cmd = ["timeout", "2400", "aria2c", "-q", "-x", "16", "-s", "16", "-k", "4M", "--file-allocation=none", "--max-tries=5", "-d", D, "-o", os.path.basename(tgz), URL]
else:
    cmd = ["curl", "-sSfL", "--retry", "3", "--max-time", "2400", "-o", tgz, URL]
rc = subprocess.call(cmd)
got = os.path.getsize(tgz) if os.path.exists(tgz) else 0
if rc != 0 or got < size * 0.99:
    skip(f"download failed: {cmd[0] if cmd[0] != 'timeout' else 'aria2c'} exit {rc} after {time.time() - t0:.0f}s, {got} of {size} bytes ({got / max(time.time() - t0, 1) / 1e6:.2f} MB/s)")
log(f"retention: downloaded {os.path.getsize(tgz) / 1e9:.2f} GB in {time.time() - t0:.0f}s")
rc = subprocess.call(["tar", "-xzf", tgz, "-C", D, "--wildcards", f"*log_random_*_{SUFFIX}.csv", f"*video_features_basic_{SUFFIX}.csv"])
logs = glob.glob(f"{D}/**/log_random_*_{SUFFIX}.csv", recursive=True)
basic = glob.glob(f"{D}/**/video_features_basic_{SUFFIX}.csv", recursive=True)
if rc != 0 or not logs or not basic:
    skip(f"extract failed: tar exit {rc}, random logs {logs}, basic features {basic}")
os.remove(tgz)

L = pd.concat([pd.read_csv(p, usecols=["video_id", "is_rand", "play_time_ms", "duration_ms"]) for p in logs])
n_all = len(L)
L = L[(L.is_rand == 1) & (L.duration_ms > 0)].copy()
L["ratio"] = (L.play_time_ms / L.duration_ms).clip(upper=1.0)
V = pd.read_csv(basic[0], usecols=["video_id", "upload_type", "tag", "video_duration"])
L = L.merge(V, on="video_id", how="left")
log(f"retention: {n_all} random-log rows, {len(L)} with is_rand=1 and a duration, {L.video_id.nunique()} videos")

edges = np.unique(np.quantile(L.duration_ms, np.linspace(0, 1, 11)))
L["dbin"] = np.clip(np.searchsorted(edges, L.duration_ms, side="right") - 1, 0, len(edges) - 2)
L["tags"] = L.tag.fillna("").astype(str).str.split(",")
vids = np.array(sorted(L.video_id.unique()))
rng = np.random.default_rng(11)
held = set(rng.choice(vids, size=int(len(vids) * 0.2), replace=False).tolist())
tr = ~L.video_id.isin(held)
top_tags = pd.Series([t for ts in L[tr].tags for t in ts if t]).value_counts().head(100).index.tolist()
uploads = L[tr].upload_type.fillna("unknown").value_counts().index.tolist()


def design(df):
    X = np.zeros((len(df), (len(edges) - 1) + len(uploads) + len(top_tags)))
    X[np.arange(len(df)), df.dbin.values] = 1
    up = {u: i for i, u in enumerate(uploads)}
    tg = {t: i for i, t in enumerate(top_tags)}
    for r, (u, ts) in enumerate(zip(df.upload_type.fillna("unknown"), df.tags)):
        if u in up:
            X[r, len(edges) - 1 + up[u]] = 1
        for t in ts:
            if t in tg:
                X[r, len(edges) - 1 + len(uploads) + tg[t]] = 1
    return X


m = Ridge(alpha=1.0).fit(design(L[tr]), L[tr].ratio.values)
H = L[~tr].copy()
H["pred"] = m.predict(design(H))
per = H.groupby("video_id").agg(obs=("ratio", "mean"), pred=("pred", "mean"), n=("ratio", "size"))
rho = per[["obs", "pred"]].corr(method="spearman").iloc[0, 1]
per5 = per[per.n >= 5]
rho5 = per5[["obs", "pred"]].corr(method="spearman").iloc[0, 1] if len(per5) > 10 else None
curve = [{"bucket": int(b + 1), "fromSec": round(float(edges[b]) / 1000, 1), "toSec": round(float(edges[b + 1]) / 1000, 1), "rows": int((L.dbin == b).sum()), "watchRatio": r3(L[L.dbin == b].ratio.mean())} for b in range(len(edges) - 1)]
log(f"retention: Spearman {rho:.3f} on {len(per)} held-out videos ({'n/a' if rho5 is None else f'{rho5:.3f}'} on {len(per5)} with 5+ views); curve {[c['watchRatio'] for c in curve]}")
dump(JOB, "retention-v0.json", {
    "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "name": "PAX2 Retention Regressor",
    "version": "retention-0",
    "source": URL,
    "dataset": NAME,
    "method": "ridge regression (alpha 1) on one-hot duration decile, upload type and top-100 tag presence; target watch ratio = play_time_ms / duration_ms capped at 1; random-exposure rows (is_rand = 1); held out by video id 80/20",
    "rows": {"randomLog": int(n_all), "used": int(len(L)), "videos": int(len(vids)), "heldOutVideos": int(len(per))},
    "spearman": r3(rho),
    "spearmanVideosWith5Views": r3(rho5),
    "heldOutVideosWith5Views": int(len(per5)),
    "meanWatchRatio": r3(L.ratio.mean()),
    "durationCurve": curve,
    "uploadTypes": uploads,
    "topTags": top_tags,
    "coef": [round(float(c), 5) for c in m.coef_],
    "intercept": round(float(m.intercept_), 5),
})
