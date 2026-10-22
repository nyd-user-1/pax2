# The admin surfaces, reimagined against what is actually built

Rework five pages — in this order, one commit each: `/pipeline`, `/dashboard`, `/build`, `/evals`, `/project-management`. Each currently describes an earlier, smaller system. Rebuild each to state what exists today, in the house card style `/pipeline` already wears (column cards, labeled connectors, measured costs). The one law: **show only what exists; anything planned is dashed and labeled planned.** Current reality to draw from: `scripts/accounting.mjs` (the counts), the Models tab on `docs/ACCOUNTING.html` (the 15-model ledger), `docs/briefs/WINDOW-Q.md` and `WINDOW-P.md` (in build), the fleet and box scripts under `scripts/catalog-media/` and `scripts/composition/`, and the poller's tables on /tracking.

Per page:

- **/pipeline** — today it shows one worker box and eleven rendered videos. Rebuild as the real production map: the proxy fleet (20 boxes, measured rates), the composition boxes, the captions path (fleet + TranscriptAPI), the GPU box Q will rent, each with its measured per-run cost from the run logs and script headers; inputs on the left (the four doors plus the admin console), S3 and the ledger in the middle, what each output feeds on the right.
- **/dashboard** — the campaign operation view gains the accounting tiles (catalog, transcript, media, composition, index, Lab Tested — the same halves arithmetic) and the e² four.
- **/build** — the build ledger brought current: the Amplify app, the bundle headroom story (220 MB cap, last measured 198 MB), the typecheck-box decision, the S3-backed feed index.
- **/evals** — the model ledger as the page: the 15 rows with their measured scores, Live/Staged, and each failed attempt with why — the accounting Models tab, promoted into the app with the house table primitives.
- **/project-management** — the standing programs as they are: Q and P (in build, briefs linked), the fleet runs ledger, the uniform baseline count and what falls outside it.

## Sixth job, after the five pages: the flask, the scan screen, and Boost settled

- **The flask button** joins every video card beside the boost rocket: it is the Button door — it sends that video through the Lab. For a video already fully measured the run is instant.
- **The scan screen** it opens, in the record flow's dress: left column, the video in the video page's portrait player with a shimmer sweeping over it while the run is live; right column, a vertical timeline — one line, a node per step, text beside each, the node becoming a checkmark only when that stage truly completes (media in hand, cuts and pacing, loudness, on-screen text, transcript, embedding, headline read, neighbors, the read). No fake timers: an already-measured video sweeps through in seconds; a fresh one takes what the boxes take. It ends on the video's measured record.
- **Boost, settled:** the reader's public push — it counts, it moves the video up the For-You ranking for everyone, and every press is a logged reader action (the reader rows the feed ranker needs). Add the glossary definition, the visible count on the button, and a per-reader cap.

## Rules

- Third person; approved vocabulary (`src/lib/glossary.ts`); real service names; no "→" character in UI; no explainer paragraph under any heading.
- Admin-gated as today. Responsive; no browser tests; no local typechecks. Commit per page by explicit path; **do not push**.
- Numbers are read from the data files at render or stated with their as-of date — never typed in as prose that will rot.

## Report

Append `## Report` after each page's commit: one line on what the page now states, and anything deferred with why.

## Report

- **/pipeline**: the page is now the production map.
  - Left, what writes: the doors (Record and Upload, the Button as planned, Connect YouTube) and the admin console. Then pax2-worker, the proxy fleet, the composition box, the captions path (fleet captions, TranscriptAPI, Whisper), the encoder retrain box, and Q's GPU box as planned. Each box shows its service, size, measured rate and every measured run with its cost, run id and date, and links its script.
  - Middle: S3 and the pax2-ledger table in DynamoDB, with the counts read at render: catalog, media (picked and label-blind), transcripts by source, composition, index, uploads.
  - Right, what reads: Scored with its four models' Live/Staged status, Lab Tested and e², the home feed, neighbors and Chat, and model training (Live, Staged and Failed counts). The Q census columns and P's policy are drawn as planned.
  - Every connector is labeled with the prefix or table it writes or reads; planned cards and their connectors are dashed. The worker's video table stays below as "pax2-worker videos".
  - Data: `scripts/accounting.mjs` now also writes `data/generated/accounting.json` (counts, transcript sources, the ledger), which the app reads through `src/lib/accounting.ts`. The per-run costs sit in `src/lib/production.ts`, each one dated and sourced to the handoff or log that measured it. The Whisper run is marked as an estimate because nobody re-measured it.
- **/dashboard**:
  - A Catalog block now leads the page, read from `accounting.json` with its as-of date. It shows the catalog total plus five tiles (Transcript, Media, Composition, Index, Lab Tested), each split into held and without, the same arithmetic as the accounting page.
  - Beside it, the e² four, each with its thumbnail, title and video-page link, read from `data/generated/e2.json`.
  - The campaign operation blocks below are unchanged.
- **/build**:
  - A Deploy block now leads the page, with four cards:
    - Amplify app: pax-2 / d19l6hnxwmfb25, builds on every push to main, Node 22, runs on the compute role.
    - Bundle headroom: 198 of 220 MB with a bar, 22 MB left, the as-of date 2026-10-22, and what is kept out of the bundle.
    - Typecheck box: drawn dashed as planned (a stopped c7i.large, about $2 a month, about 1¢ a check), with why it is needed and its source brief.
    - Feed index on S3: the S3 object, the catalog count read at render, 6.9 MB outside the bundle, and how it is served.
  - Deferred: the tracker below (`data/build.json`: the tiles, to-do columns and its $10 budget) is still dated 2026-10-17. Its done/waiting/next items record your decisions, and rewriting them needs your ruling, so it was left as is.
  - The 198 MB is the brief's figure. The build log prints the BUNDLE line on every build, but nothing writes it to a file the app can read yet.
- **/evals**:
  - The model ledger now leads the page: Passed (Live/Staged as a badge, Staged dashed) and Failed (with why each failed), numbered continuously across both tables. Built from the house TableBlock and nova Table, searchable and downloadable, read from `accounting.json` with its as-of date in the block header.
  - The partner-review blocks (results on file, carried steps, calls) stay below, because the dashboard's funnel links here for that loop. The explainer paragraph under the page head is gone.
  - Rides along: the dashboard Catalog block's as-of date moved into its header tools, because the house blocks ignore `footer`.
- **/project-management**: a new Programs tab is now the default view; Requirements, Models, Specs and the Punchlist are unchanged.
  - In build: Q and P as dashed cards, each with its ledger row's purpose, kind and status, its budget and what it runs on, and its brief linked on GitHub.
  - The uniform baseline: 5,379 of 19,057 shorts hold all four pieces as of this run, read from `accounting.json`. Four counts show what keeps the rest outside (no transcript, no media, no composition, not indexed).
  - Box runs: every measured run from `src/lib/production.ts`, with its cost and a link to the handoff that recorded it.
  - `accounting.mjs` now writes the baseline count and the outside breakdown.
- **Sixth job: the flask, the scan screen, Boost.**
  - **Flask.** Every video card's foot now carries a flask button beside the boost rocket; the list rows, which have no rocket, carry the flask alone. It opens `/lab/<youtube id>`, the scan screen. Signing in is required, because one of the checks calls a Lambda.
  - **Scan screen.**
    - Laid out in the record flow's dress (StepBar, FlowPage with the title as the display h1). On the left, the video page's 9:16 portrait frame, with a shimmer sweeping it while checks run (static under reduced motion). On the right, one vertical timeline with nine nodes.
    - Each node is a real server check, asked in order (`src/app/lab-actions.ts`):
      - Media in hand: live S3 HeadObject on `catalog-media/<id>.mp4`.
      - Cuts and pacing, loudness, on-screen text, transcript, embedding: the per-short record `data/generated/lab-stages.json`, which `scripts/accounting.mjs` now writes from the composition, transcript and index sources.
      - Headline read: a live pax2-headline Lambda call on the feed index's title, which returns the percentile.
      - Neighbors: the serving index. They are read from the embedding, so this node completes exactly when the embedding does.
      - The read: Lab Tested.
    - There are no timers: a measured video sweeps through as fast as its lookups answer. It ends on a "measured" count and a link to the video's measured record.
  - **Deferred: running the boxes on a video never measured.** No per-video path exists today. The analyze Lambda only fires for uploads, and the fleet and composition boxes are batch runs. Building one means a new Lambda, a proxy fetch and box launches that spend money, which needs your go. Until then the screen draws it as planned (dashed) and leaves the unmeasured stages open with the reason. /pipeline's Button door now reads Live, with the same planned note.
  - **Boost.**
    - The count is always visible on the rocket, including 0.
    - Everyone's boosts now lift a video in the For you ranking for every reader: a new term, log of one plus the count, in `src/lib/feed-rank.ts`.
    - Each reader is capped at 10 active boosts (`src/lib/boost-cap.ts`), enforced server-side. A press past the cap changes nothing, is logged with `capped: true`, reverts on the card, and says why there.
    - The glossary definition is rewritten to state all of this, with the cap read from the same constant.
    - The cap of 10 is a judgment call; it is one number to change.
  - `scripts/usage-features.mjs` still counts every boost event, toggles-off and capped presses included. That predates this change, and capped presses carry `meta.capped` so they can be filtered out.
