# The policy ledger — the learning loop's changelog

The reinforcement-learning mechanism has no surface. Build it one: a page that shows every learning event as it happens — what arrived, what the model believed before and after, and which advice shifted. Brendan has pointed at the exact design to port.

## The source pattern (read these first; this is a port, not an invention)

In `/Users/brendanstanton/Code/govblock`:

- `apps/web/app/changelog/page.tsx` — the page: a docs shell, steps in the center container, their index in the right rail.
- `apps/web/components/changelog-v2-body.tsx` — the body: one step per event, the action as the step's title, the full record as a titled block beneath it; strictly newest-first in happened order; long blocks collapse past a line count; entries capped per stream and filled in batches.

Aside from PAX color, font and spacing, this is a 1:1 port of that layout. Do not redesign it.

## The mapping

| govblock | PAX |
|---|---|
| A bill's action | A learning event: a video completes its 72-hour window; a replayed row (the warm start); later, a boost or an audit landing |
| The action line as the step title | The event, dated: which video, which outcome |
| The bill text in the titled block | The belief shift: the factor values touched (topic cluster, length bucket, hour block), each weight before and after, and the advice that changed ("hour block 16–19 now leads for this family") |
| The right-rail index | Jump list by day |

## The data

`data/generated/model/martian-publish-policy.json` holds the fitted posterior and the epoch marker (replayRows = 18,307). For the page's first life, render the replay itself as history: the last N replayed rows (N capped the way the source caps per stream), each reconstructed as an event step. Events after the marker are a client's own publishes and join live when they exist. If reconstructing per-row before/after needs a small addition to `scripts/policy/fit.py` (an event log emitted during replay), make it and rerun — the fit is 8 seconds and $0.

## Where it lives

`/ml` was dropped from the sidebar and redirects to /metrics. The ledger takes that route back: `/ml` becomes this page, admin-gated, and the redirect is removed. Sidebar: Research section, labeled "Learning".

## Rules

Third person; approved vocabulary (`src/lib/glossary.ts`); no "→" character in UI; no explainer paragraph under any heading; responsive; no browser tests; no local typechecks; commit by explicit path; **do not push**.

## Report

Append `## Report`: what shipped, how the before/after was reconstructed, the cap chosen, and anything deferred with why.
