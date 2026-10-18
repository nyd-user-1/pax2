"""B5. PAX2 Platform Simulator, v0: descriptive, not predictive. How Hits and the rest climb through
their first 72 hours, by family.

For every video with a 72-hour value (velocity_common): the series resampled hourly from 0 to 72
(linear between readings, anchored at 0 views at hour 0), the hour at which views per hour peak
(the end of the steepest hourly step, from the first reading onward), the views at that hour, and
whether the final ratio to the channel median is a Hit (3x or more) or a Miss (0.5x or less).
By family: median views at the peak-growth hour for Hits and for the rest, the share of eventual
Hits already above 1x their median at hours 6, 12 and 24, and the share of eventual Misses already
below 0.5x at the same hours. Writes platform-sim.json.
"""
import time

import numpy as np

from common import dump, families, log, r3
from velocity_common import H72_FLOOR, baselines, readings, series, views72

JOB = "platform_sim"
fam_of = families()
base = baselines()
S = series(readings())
grid = np.arange(0, 73, dtype=float)

vids = []
for vid, s in S.items():
    v72 = views72(s)
    med = (base.get(s["meta"]["channelId"]) or {}).get("median")
    if v72 is None or not med:
        continue
    curve = np.interp(grid, np.concatenate([[0.0], s["h"]]), np.concatenate([[0.0], s["v"]]))
    rate = np.diff(curve)
    start = int(np.ceil(s["h"][0]))  # before the first reading the line from 0 is a guess
    o = min(max(start - 1, 0), 71)
    peak_hour = o + int(np.argmax(rate[o:])) + 1
    ratio = v72 / med
    vids.append({"family": fam_of.get(s["meta"].get("group") or "", "Unmapped"), "peakHour": peak_hour, "peakViews": float(curve[peak_hour]), "hit": ratio >= 3, "miss": ratio <= 0.5, "r": {h: float(curve[h] / med) for h in (6, 12, 24)}, "firstHour": float(s["h"][0])})
log(f"platform_sim: {len(vids)} videos with a 72-hour value (last reading at or after {H72_FLOOR}h) and a channel median")


def summary(vs):
    hits = [v for v in vs if v["hit"]]
    rest = [v for v in vs if not v["hit"]]
    misses = [v for v in vs if v["miss"]]
    med = lambda xs: None if not xs else round(float(np.median(xs)), 1)
    share = lambda xs, f: None if not xs else r3(sum(1 for v in xs if f(v)) / len(xs))
    return {
        "videos": len(vs),
        "hits": len(hits),
        "misses": len(misses),
        "peakHour": {"hits": med([v["peakHour"] for v in hits]), "rest": med([v["peakHour"] for v in rest])},
        "viewsAtPeakHour": {"hits": med([v["peakViews"] for v in hits]), "rest": med([v["peakViews"] for v in rest])},
        "hitsAbove1x": {str(h): share(hits, lambda v, h=h: v["r"][h] > 1) for h in (6, 12, 24)},
        "missesBelowHalf": {str(h): share(misses, lambda v, h=h: v["r"][h] < 0.5) for h in (6, 12, 24)},
        "firstReadingByHour1": share(vs, lambda v: v["firstHour"] <= 1),
    }


fams = sorted({v["family"] for v in vids})
out = {
    "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "name": "PAX2 Platform Simulator",
    "version": "sim-0",
    "kind": "descriptive",
    "method": f"hourly series 0-72h, linear between readings and anchored at 0 views at hour 0; 72-hour value is the last reading at or after {H72_FLOOR}h; Hit at 3x the channel median (baselines.json), Miss at 0.5x or less; peak-growth hour is the end of the steepest hourly step from the first reading on",
    "notes": ["missesBelowHalf is 1 or near it by construction: views never fall, so a short that ends at 0.5x or less was below 0.5x at every earlier hour; it is reported because the brief asks for it, not as a finding"],
    "all": summary(vids),
    "byFamily": {f: summary([v for v in vids if v["family"] == f]) for f in fams},
}
dump(JOB, "platform-sim.json", out)
log(f"platform_sim: wrote platform-sim.json: {out['all']}")
