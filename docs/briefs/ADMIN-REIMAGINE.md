# The admin surfaces, reimagined against what is actually built

Rework five pages — in this order, one commit each: `/pipeline`, `/dashboard`, `/build`, `/evals`, `/project-management`. Each currently describes an earlier, smaller system. Rebuild each to state what exists today, in the house card style `/pipeline` already wears (column cards, labeled connectors, measured costs). The one law: **show only what exists; anything planned is dashed and labeled planned.** Current reality to draw from: `scripts/accounting.mjs` (the counts), the Models tab on `docs/ACCOUNTING.html` (the 15-model ledger), `docs/briefs/WINDOW-Q.md` and `WINDOW-P.md` (in build), the fleet and box scripts under `scripts/catalog-media/` and `scripts/composition/`, and the poller's tables on /tracking.

Per page:

- **/pipeline** — today it shows one worker box and eleven rendered videos. Rebuild as the real production map: the proxy fleet (20 boxes, measured rates), the composition boxes, the captions path (fleet + TranscriptAPI), the GPU box Q will rent, each with its measured per-run cost from the run logs and script headers; inputs on the left (the four doors plus the admin console), S3 and the ledger in the middle, what each output feeds on the right.
- **/dashboard** — the campaign operation view gains the accounting tiles (catalog, transcript, media, composition, index, Lab Tested — the same halves arithmetic) and the e² four.
- **/build** — the build ledger brought current: the Amplify app, the bundle headroom story (220 MB cap, last measured 198 MB), the typecheck-box decision, the S3-backed feed index.
- **/evals** — the model ledger as the page: the 15 rows with their measured scores, Live/Staged, and each failed attempt with why — the accounting Models tab, promoted into the app with the house table primitives.
- **/project-management** — the standing programs as they are: Q and P (in build, briefs linked), the fleet runs ledger, the uniform baseline count and what falls outside it.

## Rules

- Third person; approved vocabulary (`src/lib/glossary.ts`); real service names; no "→" character in UI; no explainer paragraph under any heading.
- Admin-gated as today. Responsive; no browser tests; no local typechecks. Commit per page by explicit path; **do not push**.
- Numbers are read from the data files at render or stated with their as-of date — never typed in as prose that will rot.

## Report

Append `## Report` after each page's commit: one line on what the page now states, and anything deferred with why.
