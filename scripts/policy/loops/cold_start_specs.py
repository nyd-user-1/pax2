"""Loops 8-11, the cold-start specs (docs/briefs/WINDOW-P2.md): arms, context, reward event, and where the
app logs each, so a live loop can start from them. No fit. Lists are read from the files that define them."""
import json, re, sys, time
sys.path.insert(0, "scripts/policy")
from learn import OUT

built = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
style_ts = open("src/lib/studio-style.ts").read()
usage_ts = open("src/lib/usage.ts").read()
reader_kinds = re.search(r"READER_KINDS = \[([^\]]+)\]", usage_ts).group(1).replace('"', "").replace(" ", "").split(",")


def ids(const):
    block = re.search(rf"export const {const}[^=]*= \[(.*?)\n\]", style_ts, re.S).group(1)
    return re.findall(r'\{ id: "([^"]+)", label: "([^"]+)"', block)


feed = json.load(open("data/generated/model/feed-v0.json"))
wm = json.load(open("data/generated/model/winning-modes.json"))
LEARNER = "Bayesian logistic regression, diagonal Laplace posterior, prior N(0,1), per-row updates; act by Thompson sampling (scripts/policy/learn.py)"
COMMON_EVAL = ("Once 1,000 logged decisions exist: the standard protocol of docs/briefs/WINDOW-P2.md with the logged "
               "propensities in place of estimated ones (IPS is then unbiased), registered in the brief before the first fit.")
specs = {
    "for-you-feed": {
        "arms": {"what": "the candidate videos for each feed slot", "source": "the For you ranking's candidate set at render time"},
        "context": ["reader's watched75 share so far", "log reader impressions so far", "reader's prior share on the video's tags",
                    "video duration decile", "video upload type", "video top-100 tags"],
        "reward": {"primary": "watched75 within the session the card was shown (a watch-through)",
                   "secondary": ["boost", "open"], "kinds": ["watched75", "boost", "open"]},
        "logging": {"store": "pax2-ledger usage log (src/lib/usage.ts writeUsage, pk USAGE#<yyyy-mm-dd>)",
                    "existingKinds": [k for k in ("open", "play", "watched75", "boost") if k in reader_kinds],
                    "kindToAdd": {"impression": "one per card rendered in For you: subject = video id, meta = {slot, propensity, rankerVersion, sessionId}"},
                    "propensity": "the Thompson-sampled order's probability of placing the video in that slot, estimated from 50 posterior draws at render"},
        "warmStart": {"model": "PAX2 Feed Ranker (feed-0)", "file": "data/generated/model/feed-v0.json",
                      "how": "its weights become the prior means over the same 72 features; prior precision 1",
                      "readIt": {"dataset": feed["dataset"], "label": feed["label"], "results": feed["results"]}},
    },
    "chat-suggested-prompts": {
        "arms": {"what": "the suggested-prompt chips", "source": "the chip list Window U ships with the per-video question button; arm id = chip id",
                 "now": "no chips exist in src yet; the arms list fills when they do"},
        "context": ["where the chat opened (video page, home, metrics)", "a video in view or not", "reader tier", "chips already tapped this session"],
        "reward": {"primary": "chip tapped while shown", "kinds": ["chip-tap"]},
        "logging": {"store": "pax2-ledger usage log (src/lib/usage.ts)",
                    "kindToAdd": {"chip-shown": "subject = chip id, meta = {position, propensity, surface, videoId?}",
                                  "chip-tap": "subject = chip id, meta = {position, surface, videoId?}"},
                    "propensity": "probability the sampled ordering showed that chip in that position"},
        "warmStart": None,
    },
    "recommendation-ordering": {
        "arms": {"what": "the recommendation registry's dimensions: which off-mode craft axis is listed first",
                 "values": [{"axis": k, "label": v["label"]} for k, v in wm["axes"].items()],
                 "source": "data/generated/model/winning-modes.json axes; rendered by src/components/video-reads.tsx Recommendations"},
        "context": ["the video's percentile on each off-mode axis", "distance to the mode center", "channel family", "the creator's earlier acted-on axes"],
        "reward": {"primary": "the creator acts on the advice: their next original within 30 days moves that axis at least 10 percentile points toward the winning mode's center on its craft read",
                   "kinds": ["rec-shown", "rec-acted"]},
        "logging": {"store": "pax2-ledger usage log (src/lib/usage.ts); the next original's craft read joins by owner",
                    "kindToAdd": {"rec-shown": "subject = video id, meta = {order: [axis...], propensities, registryVersion}",
                                  "rec-acted": "written by the scorer when a later original by the same owner moves a shown axis: subject = new video id, meta = {axis, from, to, shownOn}"},
                    "propensity": "probability of each axis's position under the sampled ordering"},
        "warmStart": None,
    },
    "studio-style": {
        "arms": {"voice": [i for i, _ in ids("VOICES")],
                 "pace": ["110-129 wpm", "130-149 wpm", "150-169 wpm", "170-190 wpm", "voice-led (narrated)"],
                 "typeface": [i for i, _ in ids("FONTS")],
                 "hookCard": [False, True],
                 "soundBed": [i for i, _ in ids("MUSIC")]},
        "source": "src/lib/studio-style.ts StyleRecord (version 2), written onto every Studio take as its style",
        "context": ["channel family of the owner", "log10 owner channel median", "script length in lines", "look (color) and motion, logged as context"],
        "reward": {"primary": "the published take outperformed 3x within 72 hours (the velocity poller's read)",
                   "kinds": ["published", "watching"], "outcome": "views at 72 hours over the owner's channel median"},
        "logging": {"store": "pax2-ledger originals (src/lib/originals.ts): ORIG#<id> META carries style and styleLabel; EVENT# published carries youtubeId",
                    "propensity": "the Studio's suggested style is sampled from the posterior; the sampled style and its probability are written onto META as styleSuggested and styleSuggestedP, beside the style the owner kept"},
        "replay": "none: a read-only scan of pax2-ledger on 2026-10-22 found 0 originals carrying a style record (102 originals indexed)",
        "warmStart": None,
    },
}
for name, s in specs.items():
    out = {"loop": name, "status": "cold-start", "builtAt": built, "learner": LEARNER, **s,
           "epochMarker": {"replayRows": 0, "rule": "No replay; every update is a live decision logged as above."},
           "evaluation": COMMON_EVAL}
    json.dump(out, open(f"{OUT}/{name}.json", "w"), indent=1)
    print("wrote", f"{OUT}/{name}.json")
