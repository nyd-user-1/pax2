# /reinforcement-learning — the learning loop's changelog

Build a new admin-gated page, `/reinforcement-learning`: every learning event as a step in a vertical changelog — what arrived, what the model believed before and after, which advice shifted.

## Reference design (a port, not an invention)

In `/Users/brendanstanton/Code/govblock`:

- `apps/web/app/changelog/page.tsx` — the page shell: steps in the center container, a jump index in the right rail.
- `apps/web/components/changelog-v2-body.tsx` — the body: one step per event, the action as the step's title, the full record in a titled block beneath, newest first, long blocks collapsing, entries capped and batch-filled.

Aside from PAX color, font and spacing, mirror it 1:1.

## The mapping

| govblock | here |
|---|---|
| A bill's action | A learning event: a replayed row from the warm start; later, a video completing its 72-hour window |
| The action line as the step title | The event, dated: which video, which outcome |
| The bill text in the block | The belief shift: topic cluster, length bucket and hour block touched, each weight before and after, and the advice that changed |
| The right-rail index | Jump list by day |

## The data

`data/generated/model/martian-publish-policy.json` — the fitted model and the epoch marker (replayRows = 18,307). Render the replay as the page's first history: the last N rows as event steps, N matching the reference's cap. If per-row before/after needs an event log added to `scripts/policy/fit.py`, add it and rerun — the fit is 8 seconds, $0. Rows after the marker join live when they exist.

## Rules

Third person; approved vocabulary (`src/lib/glossary.ts`); no "→" character in UI; no explainer paragraph under any heading; responsive; no browser tests; no local typechecks; commit by explicit path; **do not push**.

## Report

Append `## Report`: what shipped, how before/after was reconstructed, the cap chosen, anything deferred and why.
