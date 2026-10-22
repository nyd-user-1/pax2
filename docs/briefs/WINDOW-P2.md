# Window P, second run — the other learning loops

Extend the installed learning machinery (scripts/policy/fit.py, the Chapelle & Li learner, the registration discipline of docs/briefs/WINDOW-P.md) across the approved loops below. Budget **$3**; everything is CPU over existing JSONs. Same law as the first run: each loop's evaluation is registered in this file, timestamped, **before** that loop's fit; every number reported as it falls; limits stated plainly.

## Replay-ready loops (register, fit, evaluate — one at a time, in this order)

1. **Title style** — arms: the headline traits already measured (question mark, digit, caps run, emoji, length buckets). Reward: settled outperformed 3×. Diary: every catalog title and outcome.
2. **Thumbnail traits** — arms: bucketed v1 thumbnail features (memorability, brightness, contrast, colorfulness). Same reward. Rows limited to shorts with a thumbnail read.
3. **Posting cadence** — arms: days-since-the-channel's-last-publish, bucketed. Derive the gaps from the catalog's publish times.
4. **Channel-family investment** — arms: the six families; context: the partner's own history. Counsel per partner, not per video.
5. **Remake candidates** — not a bandit: rank catalog videos by high topic lift crossed with weak craft (the winning-modes distance), write the ranked list with each row's grounds.
6. **Paid-flight allocation** — arms: the paid videos; reward from the early-hours curves. The diary is ~341 polled curves — register it, run it, and let the intervals say how thin it is.
7. **Active learning** — no outcomes needed: from the fitted models' uncertainty, write two ranked lists — which unmeasured videos to measure next, and which measured videos to hand-audit next (Window Q's audit should draw from this list).

## Cold-start loops (no fit — define and wire the spec)

8. **For-You feed** — arms and reward (boosts, opens, watch-throughs) as a spec the app can log against; the pretrain feed ranker named as the warm start.
9. **Chat's suggested prompts** — arms: the prompt chips; reward: taps.
10. **Recommendation ordering** — arms: the registry's dimensions; reward: a creator acting on the advice.
11. **Studio style** — arms straight from the style record every Studio take carries (voice, pace, typeface, hook card, sound bed); replay the few published styled takes if any exist, else cold-start spec.

Each cold-start loop ships one spec JSON (arms, context, reward event, where the app logs it) under `data/generated/model/learning/`.

## Shared outputs

- Per fitted loop: `data/generated/model/learning/<loop>.json` (weights, epoch marker) and `<loop>-events.jsonl` — per-row event logs in the same shape the /reinforcement-learning page reads, so the ledger covers every loop.
- One private Hugging Face repo, `NYSgpt/martian-learning-loops`, one folder per loop, the card carrying every registration verbatim and every verdict, pass or fail.

## Rules

Approved vocabulary; no local typechecks; commit by explicit path; **do not push**; no product surface in this brief; no silent fails — the Report states, per loop, registered vs ran.

## Report

Append `## Report`, one section per loop in run order: registration first (timestamped, pre-fit), then the numbers, then the verdict by the registered rule.
