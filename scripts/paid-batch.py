#!/usr/bin/env python3
"""The paid batch, joined: every ad creative in data/raw/voter-freedom-paid.csv matched to its
public upload in data/raw/voter-freedom.json, with per-creative totals and the segment rows kept.
A creative whose runtime is within 2s of the public upload is an "exact" cut; otherwise it is an
"edit" that ran only as an ad, and its platform metrics must not be compared to the upload's
organic counts cut-for-cut. Writes data/generated/voter-freedom-paid.json."""
import csv, json, re
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Cuts the title matcher cannot see through: ad name -> public parent upload.
PARENTS = {"C010": "M8RZzdIooVk", "C018": "3lfeAG7U1mw"}

inv = json.loads((ROOT / "data/raw/voter-freedom.json").read_text())["videos"]
rows = list(csv.DictReader((ROOT / "data/raw/voter-freedom-paid.csv").open()))

def secs(iso):
    m = re.match(r"PT(?:(\d+)M)?(?:(\d+)S)?", iso or "")
    return int(m.group(1) or 0) * 60 + int(m.group(2) or 0) if m else 0

def norm(s):
    return re.sub(r"[^a-z0-9 ]", "", re.sub(r"\(\d+m?\d*s\)", "", s.lower())).strip()

def parent_of(cid, name):
    if cid in PARENTS:
        return next(v for v in inv if v["id"] == PARENTS[cid])
    return max(inv, key=lambda v: SequenceMatcher(None, norm(name), norm(v["title"])).ratio())

NUM = ["spend_usd", "impressions", "clicks", "video_starts", "video_completions_reported", "views_15s_thruplays_reported", "views_30s_reported"]
creatives = {}
for r in rows:
    c = creatives.setdefault(r["creative_id"], {
        "creativeId": r["creative_id"], "creativeSet": r["creative_set_id"], "name": r["creative_name"],
        "durationSeconds": int(r["duration_seconds"]), "totals": dict.fromkeys(NUM, 0), "rows": [],
    })
    for k in NUM:
        c["totals"][k] += float(r[k] or 0) if k == "spend_usd" else int(r[k] or 0)
    c["rows"].append({k: v for k, v in r.items()})

for c in creatives.values():
    v = parent_of(c["creativeId"], c["name"])
    c["videoId"] = v["id"]
    c["videoTitle"] = v["title"]
    c["videoDurationSeconds"] = secs(v["duration"])
    c["cut"] = "exact" if abs(c["videoDurationSeconds"] - c["durationSeconds"]) <= 2 else "edit"
    c["totals"]["spend_usd"] = round(c["totals"]["spend_usd"], 2)

out = {
    "source": "data/raw/voter-freedom-paid.csv joined to data/raw/voter-freedom.json",
    "channelId": "UCgIuEJP3M3zg-vt5Z1UVfdg",
    "creatives": sorted(creatives.values(), key=lambda c: c["creativeId"]),
}
(ROOT / "data/generated/voter-freedom-paid.json").write_text(json.dumps(out, indent=1) + "\n")
spend = sum(c["totals"]["spend_usd"] for c in creatives.values())
imps = sum(c["totals"]["impressions"] for c in creatives.values())
videos = {c["videoId"] for c in creatives.values()}
print(f"{len(creatives)} creatives over {len(videos)} videos | ${spend:,.2f} spend, {imps:,} impressions | edits: {sum(1 for c in creatives.values() if c['cut'] == 'edit')}")
