# The research surfaces, consolidated — /metrics, the channel page, and every chart's one home

Brendan's rulings, 2026-10-22. One commit per numbered job; show only what exists; planned stays dashed and labeled.

1. **/metrics** — merge /evidence and /tracking into one page at `/metrics`, tabbed; the sidebar's Research section updates; /evidence and /tracking redirect.
2. **Drops** — /polling, /flow (the Flows item), /ml and /scoring/method leave the sidebar; routes redirect to /metrics. The feature-lift page is dropped. Before dropping, move the two keepers: the carry block (/evidence#carry) onto the video page directly after its evaluation, and the what-each-feature-was-worth section (scoring/method, research tab) into /metrics.
3. **The channel detail page** — new `/channels/[id]`: the patterns multi-line field and the outliers view (today's evidence?tab=patterns and ?tab=outliers), scoped to the channel. The patterns field stays volume-of-lines; it is a channel surface, never a per-video one.
4. **Chart homes** — the octagon (craft axes only, per docs/RESONANCE-EVAL.md) on the video page; the length-crossing and topic-lift charts gain per-video form on the video page (the video's length marked on the curve, its topic row highlighted) while keeping their root-page slides; the universal curve stays on the root, redrawn over real normalized poller trajectories when that data lands.
5. **Resonance appears** — the video page gains the settled pair as separate blocks of the house block family — the gauge its own block, the mode match (polygon + ingredient rows) its own, recommendations a third where they exist — per docs/RESONANCE.md: (a) the banded half-gauge (credit-score dress, Poor to Exceptional, number and band centered); pre-release score on the needle until the 72-hour window completes, then the post-release score takes the needle, the pre-release becomes a reference line on the arc, and the center circle shows the signed difference; (b) beside it the craft polygon with ingredient rows (axis, weight, band chip), per-axis signed diffs once post-release. Both render only from `data/generated/model/resonance-formula.json` and the winning-modes artifact — the surfaces build now and stay empty until the files exist. Missing components list the actions that unlock the fuller read.
6. **/library and /glossary** — assess and propose only: one short appended plan each (keep-and-upgrade or drop), no build in this brief. /graph is explicitly out of scope.

7. **Video-page tidy (Brendan, 2026-10-22):**
   - Every comments block renders exactly seven rows: comment one with three branched replies, comment two with two — the house trunk-and-elbow tree, the approved stand-in words, never the current mountain.
   - The comments block moves out from under the video to the bottom of the other column.
   - The comps block (/v …#comps): each comped video gets its thumbnail with the title beneath it; the column that today shows a dash is surfaced under the title only when it has a value, and not at all when it doesn't.
   - The tags block (/v …#tags): redesigned as tag-category headers over 2–3 thumbnails each, with a See all per category linking to that tag's section on /tags.
   - The visual-notes block: its bottom key-value list (setting, on-screen people, captions…) splits out as its own block; the two halves are stylistically disjoint today.
   - The recommendations block always renders: grounded advice where the registry holds a measured lift, descriptive reads elsewhere, and "No change recommended" for a video matching its winning mode everywhere.

## Rules

Third person; approved vocabulary; no "→" in UI; no explainer paragraphs under headings; responsive; no browser tests; no local typechecks; commit per job by explicit path; **do not push**.

## Report

Append `## Report` per job: one line each on what shipped; the /library and /glossary proposals at the end.

## Report

1. **/metrics**: one tabbed page with Live, Complete, Patterns, Outliers and Feature lift, merging /tracking and /evidence.
   - /evidence and /tracking redirect with their tab, sort and filter; the older redirects (/patterns, /outliers, /feature-lift, /velocity-tracker, /live-tracking) now land on /metrics directly.
   - The Research section shows Metrics in place of Tracking and Evidence.
   - The curve-sort and velocity menus, the revalidations and the flow step links point at /metrics.
   - The /pipeline-2 factory canvas (another window's file) still names /tracking; it reaches /metrics through the redirect.
2. **Drops**:
   - Polling, Flows, ML and Score method leave the sidebar. /polling, /flow, /flow/[id], /ml and /scoring/method redirect to /metrics; /scoring/method?tab=research lands on the new tab with its outcome.
   - The Feature lift tab and page are dropped (`lift.tsx` deleted; /feature-lift redirects to /metrics).
   - Carry block: now on the video page directly after the Resonance evaluation (`src/components/evidence/carry.tsx`), with the catalog's lift rows unchanged. A row the video in view carries wears a "This video" chip, from the same feature coding (`featureFlagsFor`).
   - What each feature was worth: now /metrics' Feature worth tab (`FeatureWorth` in `research.tsx`), with the vote choice, favorability and yes/no switch in its tools.
   - Two links pointed into the dropped pages. The script catalog's link now reads "What each feature was worth" and goes to the tab. The Resonance popover's "How the score works" link is removed, since that page is gone and the video page carries the Formula block.
3. **Channel page**: `/channels/[id]` is now a tracked channel's page.
   - The header carries the logo, subscribers, tracked count, above-3x and below-0.5x counts, the median and a YouTube link.
   - Two blocks, both scoped to the channel: the patterns field (velocity lines over every tracked short of the channel, never one video alone) and the Outliers view.
   - Each block shows an empty state when the channel has no data.
   - The channel cards on /channels and /home now open this page instead of YouTube.
   - An id that is not a tracked channel still goes to /my-channels/<id>, the route's old behavior, so connected-channel links keep working.
4. **Chart homes**: the video page gains three blocks after the carry block, each shown only when its measure exists for the video.
   - **Craft template**: the octagon over eight craft axes only (cuts, visual activity, loudness, text share, speech rate, first word, length against the channel, title words), as within-channel percentiles with the channel's middle as a dashed ring. The outcome never sits inside the shape.
   - **Resonant Length**: the length-crossing curves (outperform and underperform, within channel) with this video's length marked and its two shares read off.
   - **Resonant Topic**: the topic lift rows with 90% ranges and this video's topic row highlighted. If the topic is too small to size, a line says so.
   - The root slides are unchanged, and the universal curve stays on the root until the normalized poller trajectories are drawn.
   - Data: new `scripts/video-reads.mjs` writes `data/generated/video-reads.json` (827 KB). It holds each short's craft template, using the winning-modes script's own template code, copied, plus its topic cluster from the index map. Its templates reproduce the artifact's mode-match ordering (0.998 concordance on 400 shorts).
5. **Resonance appears**: three house blocks replace the video page's old Resonance block.
   - **Resonance**: the banded half-gauge (Poor to Exceptional, number and band centered). The bands carry the credit-score cut-points proportionally from 300–850 onto 0–100: 51, 67, 80, 91. Pre-release the pre score holds the needle. With a post score, post takes the needle, pre becomes a dashed tick on the arc, and the center circle shows the signed difference.
   - **Mode match**: the artifact's mode-match score, the surviving mode's name, the polygon (the mode's center dashed, this video solid) over the eight axes the mode leans on most, and ingredient rows: axis, weight (share of the mode's lean), video percentile, mode center, and a band chip with the signed difference (On mode within 15, Near within 30, Off beyond). Catalog shorts are all past their window, so the signed differences always show.
   - **Recommendations**: always renders (see job 7).
   - Sources: the gauge reads only `data/generated/model/resonance-formula.json`, which does not exist yet, so it renders as an empty dashed arc. The expected shape `{ scores: { id: { pre, post? } } }` is documented in `src/lib/video-reads.ts` for the fitting window. The match reads only `winning-modes.json` (score, mode) plus the per-video template from job 4.
   - Missing components list their unlocking actions: run the flask (linked) when the file is unmeasured, add captions when there is no transcript, embed when the short is not in the index.
   - **Your call:** the old block showed the paid-ads score from the v1 formula (the partner CSV videos; sample figures elsewhere). It is gone from the video page because RESONANCE.md now defines a single Resonance. The KPIs and Spend blocks still carry the paid figures, and the old block is one revert away if that number should stay visible.
7. **Video-page tidy**:
   - **Comments**: always exactly seven rows, comment one with three replies and comment two with two (`sevenRows`). Real threads are used only when they fill that shape; otherwise the approved stand-in, trimmed to it. Text stays the stand-in words. The block now sits at the foot of the right column. It is the only comments block in the app.
   - **Comps**: each comped video is a thumbnail with its title beneath. The old always-dash column now shows the video's outperformance multiple under the title, only when the catalog knows it, and nothing otherwise.
   - **Tags**: one header per tag (the ruled-off "aggrieved" skipped), over up to three other videos carrying it, as thumbnails with titles, and a See all link to the tag's section on /tags. A tag no other video carries says so.
   - **Visual Notes**: keeps the summary; the key-value half (setting, on-screen people, captions…) is its own block, Visual Characteristics.
   - **Recommendations**: always renders (built in job 5). The registry holds no measured lift yet, so today's lines are descriptive reads of each off-mode ingredient with one note saying so. A video on mode everywhere reads "No change recommended." With no craft read, it says so and lists the unlock actions.
