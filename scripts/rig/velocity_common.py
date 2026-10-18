"""Readings from the velocity poller (lambda/velocity), shaped into one series per video.

The poller re-reads every short published in the last 72 hours every 15 minutes and stops at
hour 72.0 exactly, so a reading at or after hour 72 is rare; the 72-hour value is the last reading
at or after hour 71.5 (H72_FLOOR), and the log reports how many videos have a literal >= 72 reading.
Series are made monotone (running maximum) and anchored at (hour 0, 0 views): a short has no views
the moment it is posted. Interpolation is linear in hours between readings.
"""
import json

import numpy as np

from common import VELOCITY_BUCKET, get_bytes, get_json, log, s3

H72_FLOOR = 71.5


def readings():
    keys = []
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=VELOCITY_BUCKET, Prefix="velocity/polls/"):
        keys += [o["Key"] for o in page.get("Contents", []) if o["Key"].endswith(".jsonl")]
    rows = []
    for k in sorted(keys):
        rows += [json.loads(l) for l in get_bytes(k, VELOCITY_BUCKET).decode().splitlines() if l.strip()]
    log(f"velocity: {len(rows)} readings from {len(keys)} day files ({keys[0].split('/')[-1]} to {keys[-1].split('/')[-1]})")
    return rows


def baselines():
    return get_json("velocity/baselines.json", VELOCITY_BUCKET)


def series(rows):
    """{id: {"meta": first reading, "h": hours, "v": views, "l": likes, "c": comments}} sorted by hour, monotone."""
    by = {}
    for r in rows:
        by.setdefault(r["id"], []).append(r)
    out = {}
    for vid, rs in by.items():
        rs.sort(key=lambda r: (r["hour"], r["at"]))
        h = np.array([r["hour"] for r in rs], dtype=float)
        v = np.maximum.accumulate(np.array([r["views"] for r in rs], dtype=float))
        l = [r.get("likes") for r in rs]
        c = [r.get("comments") for r in rs]
        out[vid] = {
            "meta": rs[0],
            "h": h,
            "v": v,
            "l": None if any(x is None for x in l) else np.maximum.accumulate(np.array(l, dtype=float)),
            "c": None if any(x is None for x in c) else np.maximum.accumulate(np.array(c, dtype=float)),
        }
    return out


def at(h, vals, t):
    """Linear interpolation on the series anchored at (0, 0); held flat past the last reading."""
    hh = np.concatenate([[0.0], h])
    vv = np.concatenate([[0.0], vals])
    return float(np.interp(t, hh, vv))


def views72(s):
    m = s["h"] >= H72_FLOOR
    return float(s["v"][m][-1]) if m.any() else None
