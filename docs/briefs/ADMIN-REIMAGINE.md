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
