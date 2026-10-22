# The persuasion loop — the Swayable block totals, lists every change, and published outcomes come back

Three jobs, in order. Commit each by explicit path; do not push. No local typechecks — the remote build checks types. UI copy uses the glossary's terms (`src/lib/glossary.ts`), no new synonyms, no "→" anywhere. Every titled card is a MainBlock-family block; never hand-roll one.

## 1. The Swayable block leads with its total

`src/lib/evaluate.ts` line 85 already computes `lean`: the sum of the present traits' measured differences. It is stored on every eval and shown nowhere.

- In `SwayableBlock` (`src/components/codebook-blocks.tsx`), the first row states the total: the stored lean with its sign, its unit written as "points of <outcome> against control" where <outcome> is read from the same reference file `evaluate.ts` reads the per-trait differences from (do not hardcode the outcome name), and the count of present traits the sum covers.
- The per-trait rows below are unchanged and keep their intervals. The total shows no interval: no standard error for the sum is stored, and none is to be invented.

## 2. Every applicable change, not three

- `src/lib/evaluate.ts` line 96: remove `.slice(0, 3)`. The persuasion changes list every trait that applies — each absent trait with a positive difference as an add, each present trait with a negative difference as a drop — sorted by absolute difference, descending.
- Every surface that renders the changes renders the full list, scrolling or folding past 10 with an Expand, the same fold dress `/reinforcement-learning` uses.
- The `slice(0, 3)` at `src/app/original-actions.ts` line 35 is the distribution list, not persuasion. Leave it.

## 3. Completed 72-hour windows return to the admin

Built already — reuse, do not rebuild: `publish()` (`src/app/original-actions.ts`, line 112) adds a `watching` event carrying `youtubeId` and `published`, and appends the video to `velocity/watch.json` (`src/lib/velocity-store.ts`). The poller snapshots watched ids into `velocity/tiles.jsonl`. Evals are stored per original version; versions chain by `parent`.

Build, exactly this:

a. **The outcome record.** A server-side close-out (a script under `scripts/velocity/` plus a server action the dashboard can call) that, for every `watch.json` entry whose `published` plus 72 hours is in the past and which has no record yet, writes one record: originalId, version, youtubeId, published, closedAt; the eval as stored (the lean and the present traits — read it, never re-run the coder); the outcome from the last snapshot inside the window (name the exact `tiles.jsonl` fields you read in the Report). State the outperformed-3x arithmetic exactly as the glossary defines it; if the channel-median basis does not exist for our own channel, store the raw views and the words "no median basis" — invent nothing.

b. **The retake diff.** When the original has a `parent`, the record also carries: traits added, traits dropped, and the lean change against the parent version's stored eval.

c. **Where records live.** Each record is appended as an event on its original, `kind: "window-closed"`, the record as the body. Unreviewed records are listed in `velocity/eval-queue.json`, read and written through the existing `velocity-store.ts` functions.

d. **The dashboard block.** On `/dashboard`, admin view, a new MainBlock-family block titled "Completed windows": the queue newest first — title and version (linking to the original), published date, the eval's lean, the outcome, and for retakes the version-to-version trait diff. A Reviewed action per row and a select-all-reviewed action remove rows from the queue; the `window-closed` events stay forever.

e. **The notice.** Each time the unreviewed count reaches a new multiple of 100, write one notice to admin users through the same notices mechanism `publish()` uses, reading "100 completed windows are queued," linking to the dashboard block. One notice per multiple: the 100th row makes one, the 200th the next. It surfaces on next login the way existing notices do.

f. **Exclusions.** Only entries already in `velocity/watch.json` produce records. Test publishes never join that list; demo takes have no outcomes; no demo or invented row is ever queued or diffed.

## Report

Append `## Report`: what shipped per job, the exact `tiles.jsonl` fields read, how many records the first close-out run produced (0 is the expected and correct answer today — no real publishes exist), and anything deferred with why.
