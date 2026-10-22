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

## Report

**What shipped**
- **The page.** `/reinforcement-learning` is admin-gated, appears in the Admin nav, and is titled in the shell. It ports govblock's changelog in PAX dress: the steps in a centered 40rem column under a search bar, a sticky right rail ("On This Page") that jumps by day, and newest first.
- **Each step**, following the reference's four slots:
  - The channel logo in the flag chip's slot on the timeline rule.
  - The title: the date and the video, linking to its page. Opposite it, a three-tick marker (topic, length, hour) in the bill-path marker's slot, filled where the event moved the advice.
  - The channel on the sponsor line, then the arm (topic name, length bucket, hour block ET).
  - An outcome callout in the status callout's slot (green "Outperformed 3x" or slate "Did not reach 3x", with the ratio, family and date), then a rule.
  - Then the titled block `replay/<n>/<id>.txt` holding the belief shift: event number, video, channel, arm, reward, P(outperform 3x) before and after, every weight the row touched (name, before, after, change), and the advice per factor, before and after. Lines where the advice shifted are highlighted, as the reference highlights changed bill text.
  - Blocks fold past 14 lines or 900 characters, with Expand in the caption, a fade over the fold, and a copy button. Both thresholds are the reference's.
- **Live rows.** An epoch-marker line heads the list; events after the marker (a client's own publishes) will render above it once they are logged.

**How before/after was reconstructed.** It is recorded exactly, not estimated.
- `scripts/policy/fit.py` gains an event log inside the shipped replay loop, the same per-row Laplace updates that produce the published model. For each logged row it reads, before and after the update: the posterior mean of every feature the row touches (bias, family, channel median, topic, length, hour and the three family interactions), the row's own predicted chance, and the family's advice.
- The advice is the greedy posterior-mean choice per factor, found by two passes of coordinate ascent: a read-only view of what Thompson sampling centers on.
- It writes `data/generated/model/martian-publish-policy-events.json` (168 KB).
- The rerun took 7 s. It reproduced the shipped model (identical apart from its timestamp) and the evaluation file byte for byte. Both were then restored to their published bytes, so nothing on Hugging Face goes stale.

**The cap.** The reference's: twelve entries to a read, twelve more each time the end of the steps or the rail is reached. The log holds the last 240 replayed rows (twenty reads), set by `EVENT_LOG` in `fit.py`. A search runs over all 240.

**Deferred, and what the data says**
- No online events exist yet, so the page is replay only.
- Only 2 of the 240 logged rows move the advice. By the end of an 18,307-row replay the posterior is tight, so most late rows nudge the weights in the third or fourth decimal. The highlights are therefore rare, and that rarity is what the model looks like.
- Topic names come from the topic-lift table where a topic has one; the rest show their cluster number.

**Rode along** (separate commit `c7d65a6`): `resonance-formula.json` landed from another window with the fitted formula but no per-video `scores`, and the video page's gauge loader would have thrown on every video page. The lookup is now optional, and the gauge stays empty until scores land.
