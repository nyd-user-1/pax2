# The research surfaces, consolidated — /metrics, the channel page, and every chart's one home

Brendan's rulings, 2026-10-22. One commit per numbered job; show only what exists; planned stays dashed and labeled.

1. **/metrics** — merge /evidence and /tracking into one page at `/metrics`, tabbed; the sidebar's Research section updates; /evidence and /tracking redirect.
2. **Drops** — /polling, /flow (the Flows item), /ml and /scoring/method leave the sidebar; routes redirect to /metrics. The feature-lift page is dropped. Before dropping, move the two keepers: the carry block (/evidence#carry) onto the video page directly after its evaluation, and the what-each-feature-was-worth section (scoring/method, research tab) into /metrics.
3. **The channel detail page** — new `/channels/[id]`: the patterns multi-line field and the outliers view (today's evidence?tab=patterns and ?tab=outliers), scoped to the channel. The patterns field stays volume-of-lines; it is a channel surface, never a per-video one.
4. **Chart homes** — the octagon (craft axes only, per docs/RESONANCE-EVAL.md) on the video page; the length-crossing and topic-lift charts gain per-video form on the video page (the video's length marked on the curve, its topic row highlighted) while keeping their root-page slides; the universal curve stays on the root, redrawn over real normalized poller trajectories when that data lands.
5. **Resonance appears** — the video page gains the settled pair, per docs/RESONANCE.md: (a) the banded half-gauge (credit-score dress, Poor to Exceptional, number and band centered); pre-release score on the needle until the 72-hour window completes, then the post-release score takes the needle, the pre-release becomes a reference line on the arc, and the center circle shows the signed difference; (b) beside it the craft polygon with ingredient rows (axis, weight, band chip), per-axis signed diffs once post-release. Both render only from `data/generated/model/resonance-formula.json` and the winning-modes artifact — the surfaces build now and stay empty until the files exist. Missing components list the actions that unlock the fuller read.
6. **/library and /glossary** — assess and propose only: one short appended plan each (keep-and-upgrade or drop), no build in this brief. /graph is explicitly out of scope.

## Rules

Third person; approved vocabulary; no "→" in UI; no explainer paragraphs under headings; responsive; no browser tests; no local typechecks; commit per job by explicit path; **do not push**.

## Report

Append `## Report` per job: one line each on what shipped; the /library and /glossary proposals at the end.
