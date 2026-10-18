# Brief 2: wire the models into the product, and the affordances for the borrowed, rented and computed ones

Written 2026-10-17 by the lead session for an executing window. No AWS spend beyond ledger writes and emails already in use. Do not spawn subagents. Do not push. Commit per part, staging by explicit pathspec only, never `git add -A` or `commit -a`; another window may be committing to this tree at the same time, and it owns `scripts/rig/`, `scripts/google-video-ads.mjs`, `scripts/training-set.mjs`, `scripts/train-var.py`, `src/lib/forecast.ts`, `src/lib/headline.ts`, `src/lib/velocity-model.ts` and everything under `data/generated/model/`. Import from those files; never edit them.

## Model names

One convention, no exceptions: the project name and the kind of model. PAX2 Classifier (the VAR model, the chance of a Hit), PAX2 Encoder, PAX2 Reranker, PAX2 Audio Encoder, PAX2 Vision Encoder (borrowed: CLIP and ResMem), PAX2 Feed Ranker, PAX2 Velocity Classifier, PAX2 Retention Regressor, PAX2 Headline Ranker, PAX2 Platform Simulator, PAX2 Trait Labeler (the language model that labels videos on Swayable's traits), PAX2GPT (a retrieval-grounded language model, rented: Claude on Bedrock behind PAX2's prompts and records; the script writer and the chat). Version delta is a computation, not a model. These names go on every card, page, file comment and commit; no nicknames.

## Read first

- `docs/briefs/RIG-RULES.md`: rules 15, 21, 24, 27, 28 and 29 apply here even without a box: one definition imported, counts re-derived, verifiers that state their span, NUL checks, pathspec staging, no unmeasured numbers.
- `AGENTS.md`, `/Users/brendanstanton/.claude/CLAUDE.md`, `docs/SPEC.md`, and the house rules section of `docs/briefs/2026-10-17-graph-and-recipes.md` (hooks, file-scoped type check).
- `src/lib/forecast.ts` (`forecast(input)` and `recommendations(input)` and the `VideoInput` type), `src/lib/video-features.ts`, `src/lib/evaluate.ts`, `src/lib/originals.ts`, `src/app/original-actions.ts`, `src/lib/mail.ts`, `src/components/original-view.tsx`, `src/components/originals-queue.tsx`, `src/app/actions.ts` (`writeScript`), `src/lib/ledger.ts`, `src/components/record/feed.tsx`, `src/app/record/page.tsx`, `src/app/ml/page.tsx`, `src/lib/recipes/memorable.ts`, `src/components/graph/recipe-nodes.tsx`, `data/velocity/channels.json`, `data/generated/home-feed.json`.

## Part A: the forecast on the Scored tab and in the email

A1. `src/lib/evaluate.ts`. After the model pass, build a `VideoInput` from the original: `title` the original's title or its first script line; `description` the script text, labeled as a stand-in for the description; `tags: []`; `durationSec` the recording's seconds; `published` now; `group` `"reform-core"`; `channelMedian` the Vote YES on 3 channel's median from `data/velocity/catalog.json`'s `channelMedian` for channel `UC-rKSUWdEqPmP-UM7yV6Ssw` (read it at module load; fall back to null). Call `forecast()` and `recommendations()`. Add to `Evaluation`: `forecast: { p, base, anchor, strength, contributions: top 6 }` and `distribution: { changes, keeps }`. Remove `upliftPct` (the best-change gain line) from the type and from `evaluate()`.

A2. `src/components/original-view.tsx`, Scored tab. Before Recommendations, a "Forecast" card: the probability as a whole percent in the display face, beside it the family base rate as "Reform channels: N%", under it one line "Trained on N shorts from M channels; ranks new videos at AUC X across channels and Y within a channel." from `strength`, and the six contributions as a small list with a signed pull. Then an "Recommendations" list: each `change` as its action with "+N pts (low to high), measured on <scope>", then the `keeps` collapsed under "Already in place". No explainer paragraph under the heading; the lines carry it.

A3. `src/app/original-actions.ts`, the findings email. Replace the sentence that promises "as much as N%" with: the three strongest distribution recommendations and the persuasion recommendations, each carrying its range in plain words ("about +0.3 points of vote choice, somewhere between +0.1 and +0.6"). Keep the two buttons.

A4. `src/app/record/camera/page.tsx` and the draft: a "Post when" field, defaulting to the next weekday at 9am Eastern, stored on the draft as `publishAt` and passed through `submitOriginal` into the original's META; A1 uses it as `published` when present. One input, no label beyond its placeholder.

## Part B: the Writer grounded in what travels

B1. `src/app/actions.ts`, `writeScript`. Add to the prompt, after the reference text: the five highest-ratio shorts from the reform-core channels in `data/generated/home-feed.json` as "the titles of the ten reform-channel shorts with the highest iWAR", and the top three distribution `recommendations().changes` for a video of the base script's length posted at the default time, phrased as constraints ("keep it under 35 seconds", "open with the ask"). The model is told these are observed patterns, not rules.

## Part C: PAX2 Trait Labeler measured, on /labeling

The forty campaign shorts in `data/generated/model/organic-codes.json` are the only videos with transcripts, so they are the only ones the model has coded on Swayable's traits. Humans label the same forty through the Consensus machinery that already exists for the Scripts page (`src/lib/consensus.ts`, `recordVote`, `votes`, `src/components/consensus-vote.tsx`), on a page of its own.

C1. `/labeling`, signed-in users, in the sidebar's Work in progress list after Evals. One video at a time: the player, the transcript, and the Swayable traits from `reference-model.json`'s `featureLabels` as statements, voted agree (present), disagree (absent) or pass (unsure) with `ConsensusVote`, the Scripts page's own three buttons. Votes write through `recordVote` with conversation `traits-<videoId>` and `tid` the trait's index in `featureLabels`; the voter is the signed-in email. Next and previous move through the forty; a progress count shows how many videos the voter has finished. Signed out, the page shows the sign-in gate the queues use.

C2. `scripts/consensus-agreement.mjs`. Reads every `traits-*` conversation from the ledger. Per trait: the human majority at threshold half of non-pass votes against the model's code at 0.5; agreement rate and Cohen's kappa; with two or more voters, inter-coder agreement per trait as well. Writes `data/generated/model/consensus-agreement.json` with per-trait rows, the mean kappa, the voter count and the video count, or `{ "pending": true }` when no votes exist. The ML page's Models block shows the mean kappa beside PAX2 Trait Labeler once it exists.

## Part D: usage events and the cold-start feed

D1. The platform usage log, requirement 11: what readers do on PAX2, written to the ledger. `src/app/usage-actions.ts`. `logUsage(kind, subject, meta?)` writes `pk USAGE#<yyyy-mm-dd>`, `sk <iso>#<4 random chars>`, with `kind`, `subject`, `meta`, `who` (the signed-in email or the anonymous id the client sends), through `putOnce`. Kinds: `open`, `play`, `watched75`, `search`, `filter`, `sort`, `boost`, `bookmark`, `share`, `queue`. `usageSince(days)` reads the day partitions back.

D2. `src/components/usage-beacon.tsx`. A client hook `useUsage()` returning `log(kind, subject, meta)`; the anonymous id lives in `localStorage` under `pax2-reader`. Wire it: the video drawer and page on open; the player on first play and at 75% of duration where the player exposes time; the feed's search on submit, filter and sort on change; the Boost, bookmark, share and queue controls, which also stop being inert: Boost and bookmark toggle a local state and log; share copies the video's link and logs; queue logs. One call each, never on render.

D3. `src/lib/feed-rank.ts`. `rankFeed(videos, events)`: a pure function scoring each video by recency decay (half-life 14 days), log of the ratio to its channel median, and log1p of its opens plus plays in the last 7 days from the events; returns the videos in score order with the three parts on each row. The landing feed, signed in, gets a "For you" sort chip that applies it; the default sort stays as it is.

D4. `/dashboard`: a "Readers" block: counts by kind over the last 7 days and the ten most opened videos, from `usageSince(7)`. Sample-data chip when there are no events.

## Part E: versions and the version delta

E1. `src/lib/originals.ts`: `chainOf(id)`: every version from the root to the newest, following `parent` and `replacedBy`.

E2. `src/components/original-view.tsx`: a "Versions" card on every tab when the chain has more than one entry: one row per version with its number, stage, persuasion lean, forecast probability when present, and, once polled, views and ratio at 72 hours from the readings. The current version is marked. `src/components/originals-queue.tsx` stops hiding a replaced parent: the row shows the chain's head with "v2 of 2" style text and links to the chain.

E3. `src/lib/version-delta.ts`. `pairDelta(a, b)`: for two versions with 72-hour readings, the ratio difference and the log ratio; `pairsSummary(pairs)`: the mean paired difference with a bootstrap 90% range over pairs. Shown on the Versions card as "Version delta" when the chain has at least one polled pair, otherwise one line "No measured pair yet."

E4. `src/app/original-actions.ts`: `ownerPublish` and `review("approved")` no longer require the video to be the chain's head; both versions of a chain may be published, each adding itself to the watch list.

## Part F: the model inventory as a product surface

F1. `src/lib/recipes/memorable.ts`: rename every model card to the convention above (`m-encoder` PAX2 Encoder, `m-reranker` PAX2 Reranker, `m-classifier` PAX2 Classifier, `m-cpc` PAX2 Audio Encoder, `m-ranker` PAX2 Feed Ranker, `m-writer` PAX2GPT) and add the cards so the diagram is the single inventory. Models: `m-velocity` (PAX2 Velocity Classifier, kind other, " a short's first hours predicting its 72-hour verdict", planned), `m-retention` (PAX2 Retention Regressor, kind other, "watch ratio from content, pretrained on KuaiRand", planned), `m-vision` (PAX2 Vision Encoder, kind encoder, "CLIP embeddings and a memorability score for frames; borrowed, off the shelf", exists, where "open_clip ViT-B-32, ResMem"), `m-headline` (PAX2 Headline Ranker, kind other, "a pairwise ranker of titles and opening lines trained on Upworthy's randomized tests", planned), `m-simulator` (PAX2 Platform Simulator, kind other, "a model of the platform's seed test fit to velocity curves", planned). Steps: `m-labeler` (PAX2 Trait Labeler, kind other, "a language model that labels a video on Swayable's traits; Claude on Bedrock today", exists, where `src/lib/evaluate.ts`) and the step `s-labeling` ("humans label the same forty videos on /labeling; agreement and kappa against PAX2 Trait Labeler", planned, owner Brendan, tool `scripts/consensus-agreement.mjs`), `s-uplift` ("paired differences over version pairs", planned, tool `src/lib/version-delta.ts`). Edges: `i-velocity` to `m-velocity`, `i-public-shortvideo` to `m-retention`, `i-thumbs` to `m-vision`, `i-memorability` to `m-vision`, `m-vision` to `s-classifier-v1`, `i-upworthy` to `m-headline`, `m-headline` to `m-writer`, `i-velocity` to `m-simulator`, `i-swayable` to `m-labeler`, `m-labeler` to `s-training-set`, `s-labeling` to `m-labeler`, `s-version-delta` to `o-advice`, `i-swayable` to `s-classifier-v1`. Flip `m-writer` to PAX2GPT with "Claude on Bedrock, rented" in its note and `m-classifier` metrics to the numbers in `var-model.json` at the time of the commit.

F2. `/ml` page: a "Models" block listing every `model` card from the template: name, kind, definition, status, where, metrics. Read from the constant; no second copy of the list anywhere.

F3. In the Recipes mode's edit form, `where` and `metrics` accept a path or a Hugging Face id and render as a link when they look like one.

## Part G: Voter Freedom's videos as originals

Voter Freedom's uploads are original content made off the platform. `data/generated/voter-freedom-paid.json` already groups its 20 paid creatives into creative sets with exact and edit cuts, which are version chains; `data/raw/voter-freedom.json` holds all 95 shorts with counts.

G1. `scripts/backfill-voter-freedom.mjs`. Dry run by default. For each creative set: the exact cut is version 1, each edit cut a later version with `parent` set, in `report_date` order; uploads with no paid creative are single-version originals. Each original is created through the same ledger writes as a recording (`createOriginal`, `addEvent`), with `owner` the admin email, `consent` true, `title` the YouTube title, `text` the transcript when `features.json` holds one, `seconds` from the duration, and a `provenance: "backfilled"` field on META so the queues can show it. The YouTube id goes on a `watching` event so the Polled tab reads the readings that exist. `--apply` writes; the dry run prints the chains.

G2. Run `evaluate()` on each backfilled original so every one carries the persuasion traits, the forecast and the recommendations, and the Versions card shows the chain with the paid figures from the batch beside each cut.

G3. The queues and the video page show "Backfilled" beside the stage for these rows.

Brendan has a link to the original videos and their versions from an earlier session; it is not in this repository. Ask for it in the window before G1 if the chains in the paid batch look incomplete.

## Commits

Seven commits, one per part, subjects in this repository's prose style. File-scoped type checks before each. When done, tell Brendan in a few lines in the window what was built and what was left out.
