"""Shared plumbing for the PAX2 rig jobs: S3 paths, the rehearsal switches, logging, and the
leave-one-channel-out logistic regression that PAX2 Classifier and PAX2 Velocity Classifier share.

Environment (set by run-all.sh):
  BUCKET       s3 bucket, default pax-2-638175140432
  RIG_PREFIX   where outputs go, "model/" for the full run, "model/rehearsal/" for a rehearsal
  RIG_LIMIT    keep every Nth training row (rehearsal only); 1 for the full run
  RIG_MODE     "full" or "rehearse"
"""
import io, json, os, sys, time

import boto3
import numpy as np

BUCKET = os.environ.get("BUCKET", "pax-2-638175140432")
VELOCITY_BUCKET = "pax-2-velocity-638175140432"
PREFIX = os.environ.get("RIG_PREFIX", "model/")
LIMIT = int(os.environ.get("RIG_LIMIT", "1"))
MODE = os.environ.get("RIG_MODE", "full")
WORK = "/work"
CODE = os.path.dirname(os.path.abspath(__file__))

s3 = boto3.client("s3", region_name="us-east-1")


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def out_dir(job):
    d = f"{WORK}/out/{job}"
    os.makedirs(d, exist_ok=True)
    return d


def get_bytes(key, bucket=BUCKET):
    return s3.get_object(Bucket=bucket, Key=key)["Body"].read()


def get_json(key, bucket=BUCKET):
    return json.loads(get_bytes(key, bucket))


def exists(key, bucket=BUCKET):
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except Exception:
        return False


def training_rows(limit=None):
    """The training set uploaded by the launcher; every Nth row in a rehearsal unless limit says otherwise."""
    rows = [json.loads(l) for l in get_bytes("model/training-set.jsonl").decode().splitlines() if l.strip()]
    return rows[:: (limit or LIMIT)]


def families():
    """GROUP_FAMILY exported from src/lib/video-features.ts by scripts/rig/export-fixtures.mjs (rule 15)."""
    with open(os.path.join(CODE, "families.json")) as f:
        return json.load(f)


def dump(job, name, obj):
    with open(f"{out_dir(job)}/{name}", "w") as f:
        json.dump(obj, f, indent=1, allow_nan=False)


# ---------- L2 logistic regression, Newton's method, numpy only ----------


def fit(Zt, yt, lam=2.0, iters=25):
    n, p = Zt.shape
    A = np.column_stack([np.ones(n), Zt])
    pen = np.full(p + 1, lam)
    pen[0] = 0.0
    b = np.zeros(p + 1)
    for _ in range(iters):
        mu = 1 / (1 + np.exp(-(A @ b)))
        W = mu * (1 - mu) + 1e-9
        g = A.T @ (mu - yt) + pen * b
        H = (A * W[:, None]).T @ A + np.diag(pen) + np.eye(p + 1) * 1e-9
        step = np.linalg.solve(H, g)
        b -= step
        if np.max(np.abs(step)) < 1e-8:
            break
    return b


def predict(b, Zt):
    return 1 / (1 + np.exp(-(np.column_stack([np.ones(len(Zt)), Zt]) @ b)))


def auc(yt, p):
    yt = np.asarray(yt, dtype=float)
    p = np.asarray(p, dtype=float)
    if len(yt) == 0 or yt.sum() == 0 or yt.sum() == len(yt):
        return None
    order = np.argsort(p, kind="mergesort")
    ranks = np.empty(len(p))
    sp = p[order]
    i = 0
    while i < len(sp):
        j = i
        while j + 1 < len(sp) and sp[j + 1] == sp[i]:
            j += 1
        ranks[order[i : j + 1]] = (i + j) / 2 + 1
        i = j + 1
    npos = yt.sum()
    nneg = len(yt) - npos
    return float((ranks[yt == 1].sum() - npos * (npos + 1) / 2) / (npos * nneg))


def r3(v):
    return None if v is None else round(float(v), 3)


def standardize(X, defs):
    cont = np.array([d["kind"] == "continuous" for d in defs])
    mean = np.where(cont, X.mean(0), 0.0)
    sdv = X.std(0)
    sd = np.where(cont, np.where(sdv > 1e-9, sdv, 1.0), 1.0)
    return (X - mean) / sd, mean, sd


def loco(Z, y, ch, lam=2.0):
    oof = np.zeros(len(y))
    for c in np.unique(ch):
        tr = ch != c
        if y[tr].sum() == 0 or y[tr].sum() == tr.sum():
            oof[~tr] = y[tr].mean()
            continue
        oof[~tr] = predict(fit(Z[tr], y[tr], lam), Z[~tr])
    return oof


def within_channel_auc(y, p, ch, names, min_n=20, min_each=3):
    """AUC inside each channel with enough of both outcomes, weighted by its count."""
    num = den = 0.0
    parts = []
    for c in np.unique(ch):
        m = ch == c
        if m.sum() < min_n or y[m].sum() < min_each or (m.sum() - y[m].sum()) < min_each:
            continue
        a = auc(y[m], p[m])
        parts.append({"channel": names[c], "n": int(m.sum()), "auc": r3(a)})
        num += a * m.sum()
        den += m.sum()
    return (num / den if den else None), parts


def decile_table(y, p):
    order = np.argsort(-p, kind="mergesort")
    out = []
    for d in range(10):
        idx = order[int(d * len(p) / 10) : int((d + 1) * len(p) / 10)]
        if len(idx) == 0:
            continue
        out.append({"decile": d + 1, "n": int(len(idx)), "predicted": r3(p[idx].mean()), "observed": r3(y[idx].mean())})
    return out
