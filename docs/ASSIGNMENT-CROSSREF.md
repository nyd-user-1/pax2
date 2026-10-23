# Parallax candidate project against the repo

Source: "PAX: From Content and Data to Partner Intelligence" (Parallax, 5 pages), kept at `data/raw/reports/parallax-candidate-project-2026.pdf` (git-ignored, not in `public/`). Read 2026-10-23 against `main` at the time. Status words: **Built** (works, on screen), **Built, off screen** (code exists, no route renders it), **Partial**, **Missing**.

## Where the work stands, in one paragraph

The assignment's loop was built in October around synthetic "takes": paid exports load once and never double-count, the reference scale freezes on the first dataset, every score, finding and decision is stored with its formula version and snapshot, PAX's reading keeps observed, interpretation and hypothesis apart, next steps carry what prompted them, what is uncertain and what would measure them, and a partner can approve, revise, save or mark a step made, or record a prediction before later results arrive. All of that runs on the stand-in rounds (`data/standin`, `src/lib/review.ts` DATASETS: "round-1", "round-2", source "stand-in"). The one real paid export, `data/raw/voter-freedom-paid.csv` (120 rows, 20 creatives, 16 videos), is scored by `src/lib/paid-resonance.ts` but is not shown and not in the loop.

## Part one: build the Resonance score

| Requirement | Status | Where | Gap |
|---|---|---|---|
| Define the 0–100 score, what higher means, relative to what | Built, in code | `src/lib/resonance.ts` header; `paid-resonance.ts` (reference = the paid batch) | The repo's public "Resonance" is now a different number: the pre-release probability of outperforming 3× (docs/RESONANCE.md, glossary, video-page gauge). The assignment's is observed paid performance and says outright it is not a forecast. The paid score's glossary entries (Engage, Interest, Act) were deleted 2026-10-23 (f7f2da1). |
| Inputs, comparable scale, weights; design choices apart from what is learned | Built, off screen | `FORMULA_V1` (weights 25/40/35 marked design, prior strengths, logit z against the frozen reference); `src/components/scoring/formula.tsx` table of design vs data choices | `formula.tsx` has no importer since `/scoring/method` began redirecting to `/metrics` (2026-10-22). |
| Trace one complete example from raw records to the score | Partial | `score()` returns every component; take page's Resonance and Formula folds | No real-data trace on screen. |
| Account for spend, exposure, reporting windows, duration, delivery conditions | Partial | Rates only, shrunk toward the reference by evidence (budget cannot buy the score); Hold is length-adjusted | Reporting windows are not adjusted: 15 creatives report on 2026-09-28 and 5 on 2026-10-05, summed as if alike. Delivery mix is not adjusted: every creative's rows split by audience (General, Republican, Independent) and age (under 35, 35+), and they are summed without weighting for mix. |
| Counts and rates defined; missing information shown; limited evidence visible | Built, in code | `minImpressions` 1,000, `limitedImpressions` 15,000; `paid-resonance.ts` documents the export's gaps (no reach, shares, saves; starts stand in for 3-second plays; average watch estimated from the retention points) | Not rendered for the real batch. |
| Content as context; AI-assessed characteristics kept apart from platform measurements | Built | `src/lib/pax2.ts` system rules ("AI-assessed … say 'the video review notes'") | |
| Reproducible score and breakdown per piece; unscorable records flagged | Built, off screen | `paidResonance(ytId)` | `src/components/short-view.tsx:254` computes it and nothing renders it. |
| Show how the result moves when an input moves, and whether assumptions matter | Built, off screen | `WhatIf` (`src/components/what-if.tsx`), `WEIGHT_PRESETS` with Spearman rank agreement, in `formula.tsx` | Same orphaned page. |
| Show what it adds beyond one plain measure | Built, off screen | `formula.tsx` "What it adds beyond one number" | Same. |

## Part two: bring the score to life through PAX

| Requirement | Status | Where | Gap |
|---|---|---|---|
| Open a piece, or compare related versions, with asset, score, results and reporting context together | Partial | Take page `/v/<take>` (synthetic takes); Versions card for originals | The real export holds 4 ad edits of uploaded videos (`cut: "edit"`); nothing sets an edit beside its exact cut. Real Voter Freedom video pages carry no paid score. |
| Content observations from the actual video, traceable to the moment | Partial | Transcript timeline on the take page; findings cite `line:N` and `seen:hook` refs; question-bank answers carry timestamps | Findings do not cite seconds. |
| Explain the score: takeaway, components, formula, source records; math apart from why | Built | `pax2.ts` narrative (takeaway, scoreMeaning) and rules | Runs on takes only. |
| Observed result, interpretation, hypothesis kept apart; uncertainty readable | Built | `pax2.ts` `Cited.kind` | |
| A specific next version or test: what changes, what prompted it, what is uncertain, what would measure it; next measurement when evidence is thin | Built | `pax2.ts` rules and `insufficient`; `decide()` fields | |
| Approve, revise or save; tied to content, score version and evidence; proposed apart from made | Built | `decide()` statuses approved, revised, saved, made, with snapshot and formula; `/evals` labels "Approved, not yet made" | Entry points are admin pages (`/evals`, `/dashboard`), not a partner view. |
| Step 6, yours to define | Candidates exist | Recorded predictions before results (`callIt`); "Every round, same scale" | Not named as the step-6 answer anywhere. |

## Part three: close the loop

| Requirement | Status | Where | Gap |
|---|---|---|---|
| Score, formula version, supporting records, finding and decision saved together; loading the same data twice counts nothing twice | Built | `review.ts`: `LOAD#` by file hash and `SNAP#` by window via `putOnce`; `SCORE#` keyed formula and reference; `FINDING#`, `STEP#`, `CALL#` (DynamoDB `pax2-ledger`) | |
| Same formula and reference on the later dataset; show what changes; keep the earlier record | Built on stand-ins | Reference frozen from the first dataset; take page "Every round, same scale" | The real export has no second snapshot of the same creatives (the two report dates cover different creatives), so this cannot yet be shown on real records. |
| A formula revision is a new version, not a performance change; "the score changed" apart from "the evidence supports a different conclusion" | Partial | Version stored on every record; `priorChecks` in `pax2.ts` | Only `resonance-1` exists; no screen shows a version change beside a performance change. |
| Predictions recorded before the results that judge them | Built | `callIt` / `recordForecast` with baseline snapshot | |
| An edit helped only when the record shows it made and evaluated | Partial | Status "made"; `/evals` note that a later score does not by itself show an edit helped | No made-edit-to-later-snapshot evaluation. |
| Surface the earlier finding and its limits in the next related review | Built | `read()` passes prior findings and decisions; `priorChecks` | |
| The six-step demo on the supplied records | Partial | Steps run on stand-ins from admin pages | Missing on the real export: steps 1, 2 and 5 (raw data, formula walk-through, later results). |

## Unanswered by the codebase

1. The loop has never run on real records. Wire `voter-freedom-paid.csv` into `loadExport` as the platform dataset, so the real creatives get scores, findings, decisions and predictions.
2. Two numbers are called Resonance. The assignment's is the observed paid score (Resonance 1, `src/lib/resonance.ts`), the one removed from the glossary this morning.
3. The formula page is unreachable: the design-vs-learned table, What-if, weight sensitivity and "what it adds beyond one number".
4. No later results exist for the same pieces, so the revisit step needs a second export from the partner.
5. Reporting windows and audience/age delivery mix are not adjusted.
6. Edits are not compared with their exact cuts.
7. Content observations are not tied to seconds.
8. There is no partner-facing entry to the loop.
