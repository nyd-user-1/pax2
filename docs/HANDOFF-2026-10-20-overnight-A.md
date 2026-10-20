# Handoff, overnight window A (the data chain), 2026-10-20

Written 11:45 UTC, closed 13:30 UTC; nothing of this window is running. Brief: `docs/briefs/OVERNIGHT-A-DATA-CHAIN.md`. Every number is measured unless marked estimate. Nothing is pushed.

## Closed

- **PAX2 Classifier v3 passed Gate C and serves (task 7).** v2's transcript features over 14,438 transcripts plus 32 principal components of the PAX2 Encoder embedding. On the encoder's 10 held-out channels (3,870 shorts, base rate 0.172): **0.648 AUC**, within-channel 0.630, top-decile lift 2.03x. The metadata arm on the same rows: 0.596. The Mac's second scorer agrees on every arm. Commit 0bede1f; published private to NYSgpt/pax2-classifier.
  - Why held-out channels only: the encoder trained on the label on the other 54 channels, so the pooled AUC (0.671) overstates the embedding. It is reported, never gated.
  - Gate C was registered twice, both before any full run: da7ac1e (+0.02 over the metadata arm on the held-out rows, and above 0.604) and cb7ec4d (your raised bar: above 0.604 and above the metadata arm, within at least 0.55). v3 clears both.
  - Against all four lines: v1's 0.604 gate, cleared; the metadata arm's 0.608 and the image arm's 0.611 (both pooled over all 64 channels), cleared on harder rows, though the image arm was not re-scored on the held-out rows; within-channel 0.55, cleared at 0.630. By the lead's language rule this reads as an improvement over the serving arm, with that row caveat.
  - Serving: the analyze chain's neighbors step now stores each upload's embedding (title, description, transcript, in the corpus's recipe), and the forecast reads v3 only beside a transcript and that embedding; v1 answers otherwise. Tested on sub-mvf0mfwv-fugv. Existing originals get v3 at their next score after a new analysis; nothing back-fills.
- **Task 7b failed Gate C** (0.589 held-out): window C's composition features exist only on the outlier-and-control pair set, picked by the label; on the 1,212 held-out rows that carry them composition added 0.005. Its own row in the card. No iteration: the raised bar's extra iteration is for task 7, which passed.
- **PAX2 Encoder retrain at 9,289 transcripts missed Gate E by 0.0002** (step 3): pooled 0.6018 against stock 0.5820 (+0.0198), within +0.0186; reranker 0.6096 but ships only over a passing encoder. The 094112 encoder keeps serving. Commit e057d6d.
  - Protocol: this run stands on the holdout split rebuilt 2026-10-20 07:06:11 UTC (same 10 channels, 3,870 shorts, sha 37a7d785383b); the passing 094112 run stood on the 2026-10-19 09:39 split (3,869 shorts). 89 ids moved (44 out, 45 in), so the two runs are not one series. Within each run, stock and encoder are scored on the identical holdout; the Mac rescore confirmed.
- **Captions** (step 1): transcripts.json holds 14,632 with text (was 9,368); the training set's settled rows with a transcript of 10+ words went from 3,412 (v2) to 14,438.

- **The full-corpus encoder retrain missed Gate E** (step 5, run 20261020-115427-train, 14,855 transcripts): pooled 0.5587 against stock 0.5464 (+0.0123), within +0.0088, reranker 0.5818; the Mac agrees on every arm, no held-out document in the 14,661 pairs. Same holdout ids as the 9,289-transcript run (rebuilt 11:54 UTC, corpus hash changed, ids unchanged), so the two read as one series: stock 0.582 to 0.546, encoder 0.602 to 0.559 as transcripts grew. 7,925 documents now hit the 1,200-character cap (5,107 before); transcript text crowds out title and description. A reading, not a tested cause; the next encoder run should change the corpus recipe, not add transcripts. No index, pointer or map rebuild; the 094112 encoder and Classifier v3 keep serving, and window B's conditional re-quantize does not fire.
- **Fetching stopped at 11:5x UTC** by the models window, relaying your word that 14,438 transcripts is enough; this window confirmed the boxes were shutting down before launching the retrain. Media fleet and Whisper (steps 2 and 4) were not run; census resumes any day.

## Earlier in the night (superseded)

- (At 11:45) Captions retry fleets fleet-20261020-102620 (9 boxes, 3,803 ids that failed on a bot wall or HTTP 429; 3 boxes aborted on walled lines 1, 5, 9) and fleet-20261020-113016 (5 boxes on lines 2, 8, 11, 12, 13, the 1,268 ids those three never tried; line 2 has since walled). Watchdogs end them by 13:30 UTC.
- (At 11:45) The plan was then the media fleet, Whisper and the full-corpus retrain; the fetching was stopped, the retrain ran (above).

## What changed on the AWS side (for review)

- The analyze box role (nsr-embed, inline pax2-analyze) gained `dynamodb:GetItem` on pax2-ledger, conditioned to `ORIG#*` leading keys, so the neighbors step can read an original's title and description. Before and after policy documents are in the session scratchpad; `scripts/analyze/deploy.sh` carries it.
- `s3://pax-2-638175140432/code/rig/encoder_neighbors.py` redeployed with the embedding step.

## Proxy lines (SSM /pax2/webshare/proxies, 14 lines, 0-based)

07:00 probe: 11 answered, 3, 9 and 11 walled. During the night 1, 4 (mid-run), 5, 9 and 2 walled; at 11:35 2, 8, 11, 12, 13 answered. Walls come and go per line within hours; `PROXY_LINES` on fleet.sh picks the lines.

## Spend (EC2 on-demand, from run times)

| What | Duration | Cost |
|---|---|---|
| Encoder retrain 20261020-070703-train, g5.xlarge (no g6e capacity in any zone) | 07:07 to about 08:33 | about $1.43 |
| Captions fleet 070525, 11 t3.micro | about 3 h each | about $0.35 |
| Captions retries 102620 and 113016 | 10:26 to about 11:55 and 11:30 to about 11:55, stopped | about $0.12 |
| Full-corpus retrain 20261020-115427-train, g5.xlarge | 11:55 to about 13:23 | about $1.48 |
| Classifier v3 and v3b, c7i.xlarge | about 5 min each | about $0.04 |
| Neighbors test, c7i.large | about 5 min | about $0.01 |
| **Total** | | **about $3.43 of the $8 ceiling** |

## Yours

1. Review the GetItem grant above.
2. Push when the UI windows' trees allow.
3. Composition needs media for the whole catalog before it can be read on every row (task 7b's lesson).
