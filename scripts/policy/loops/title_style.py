"""Loop 1, title style: registered in docs/briefs/WINDOW-P2.md before this fit."""
import math, re, sys
sys.path.insert(0, "scripts/policy")
import numpy as np
from learn import Design, run_factor_loop, settled_catalog

cat, fam_of, _ = settled_catalog()
rows = [v for v in cat if v["tier"] != "unsettled" and v["channelId"] in fam_of]
rows.sort(key=lambda v: (v["published"], v["id"]))
FAMILIES = sorted(set(fam_of.values()))
EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿]")
words = lambda t: [w for w in re.sub(r"#\w+", "", t).split() if w]


def arms(t):
    ws = words(t)
    n = len(ws)
    return [int("?" in t), int(bool(re.search(r"\d", t))), int(any(re.fullmatch(r"[A-Z]{4,}[!?.,]*", w) for w in ws)),
            int(bool(EMOJI.search(t))), 0 if n <= 6 else (1 if n <= 14 else 2)]


for r in rows:
    r["family"] = fam_of[r["channelId"]]
design = Design("family", FAMILIES, ["log10ChannelMedian"],
                [("question", ["no", "yes"]), ("digit", ["no", "yes"]), ("caps", ["no", "yes"]),
                 ("emoji", ["no", "yes"]), ("length", ["<=6 words", "7-14 words", ">=15 words"])])
ctx = np.array([FAMILIES.index(r["family"]) for r in rows])
Z = np.array([[math.log10(max(r["channelMedian"], 1))] for r in rows])
A = np.array([arms(r["title"]) for r in rows])
y = np.array([1.0 if r["ratio"] >= 3 else 0.0 for r in rows])
print("prevalence", dict(zip(["question", "digit", "caps", "emoji"], A[:, :4].mean(axis=0).round(4))), np.bincount(A[:, 4]))
run_factor_loop("title-style", rows, ctx, Z, A, y, [r["channelId"] for r in rows], design)
