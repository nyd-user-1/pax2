# Roadmap — fetch, question machine, policy, surfaces

Proposed by the models window 2026-10-22, approved in principle by Brendan; not yet launched. Any
window can run it; the monitor role passes to whoever holds it. Decision owner: Brendan.

## Window F — fetch and extract (the fuel)

The proxy fleet pulls the ~12,100 catalog videos without media (measured rate: 1,827 in ~25 minutes
on 10 healthy Webshare lines; lines 5, 11, 12 walled, 8 degraded). Then extraction fleets run
composition over the new media (`scripts/composition/launch.sh`), merge
(`scripts/composition/merge.mjs`), and run the stock VideoPrism base embed pass (MM-A's pipeline,
run 20261021-040633-full) so every video has media, composition and a visual embedding — the
embedding is for the format-label job only, not outcome prediction (it failed those gates;
docs/briefs/MULTIMODAL-SURVEY.md). Owns `catalog-media/`, `composition.json`, embeddings.
Budget $25.

## Window Q — question machine (the product core)

Tasks 1–7 of docs/VQA-QUESTIONS.html ("What makes it real"): stand up Qwen/Qwen3-VL-8B-Instruct on
one GPU box, verify on 20 hand-checked videos; fix the question schema (each census FLAG variable a
fixed question with a typed answer); batch-answer the media on hand, extending as F lands more;
hand-audit 100 videos so every column carries a measured accuracy; merge columns into the census;
measure each new column's lift with the feature-lift formula; write the recommendation registry
(variable, grounds, citation — the video page's recommendation pattern generalized). Budget $15.

## Window P — policy (the reinforcement-learning install)

Offline contextual bandit over topic, length and publish-hour arms; reward = outperformed 3x within
72 hours; warm-started by replaying the catalog's 19,036 logged action-outcome pairs; an epoch
marker separates replay from the client's own publishes; off-policy evaluation registered before
the run; published private to HF under the Martian naming, pass or fail on the card. Budget $2.

## Window U — surfaces and infrastructure

First: the stopped typecheck box (c7i.large, ~$2/month disk, ~1¢ a check) so pushes stop reaching
Amplify unchecked — two builds max for the whole program. Then: the per-video question button
opening the chat side panel preloaded, suggested-prompt chips, the question-answering route with
per-tier limits, and the 179 fold-in (data/raw/yt-shorts.json's remainder into the feed index, the
file and its import sites retired). No GPU.

## Monitor protocol

Commit, EC2 and S3 watchers on a 10-minute cadence. Each window heartbeats by commit or message
every 30 minutes; silence past 45 gets pinged; failures rerouted; flags ruled or escalated to
Brendan. Seams by path ownership, staged explicitly, nothing shared across windows except read-only.
Pushes only on Brendan's word. Total cap $45, flags before any overage.
