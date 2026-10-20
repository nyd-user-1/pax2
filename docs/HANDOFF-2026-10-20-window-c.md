# Handoff, 2026-10-20 at 08:30 UTC — window C, PLUM composition

Brief `docs/briefs/OVERNIGHT-C-PLUM-COMPOSITION.md`, all four parts done; ledger in `docs/PLUM-COMPOSITION.md`. Nothing is running and nothing is pushed. Every number here is measured.

## Spend: about $0.85 of the $3 ceiling

- Rehearsal composition-20261020-070540: one c7i.xlarge, 20 shorts in 81 s, terminated about 3 minutes after launch, about $0.01.
- Full run composition-20261020-070925 (i-0990076cd9e9d2a58): c7i.4xlarge, launched 07:09:31 and terminated by 08:20:08 UTC. It processed 5,106 of 5,106 shorts in 4,135 s with 0 errors and EXIT=0, about $0.84.
- Parts 2 to 4 ran on the Mac. The encoder-neighbor pass took 3.7 minutes of Node.

## What landed

1. **05c8251 / 431c828: the cluster map compiles again and its chips are real.**
   - The tour has its five steps and a Tour button.
   - `/api/encoder-map` serves each point's duration, cut rate, hook cuts, hook text, first word and speech rate.
   - The chips are Under 30 s, 60 s and over, the top third by cut rate, Cut in the first 2 s, Text on screen in the first 2 s, Speaks within 0.5 s, and the top third by speech rate. The headline chips stay.
   - 65f84f3 had committed the broken file, but it was never pushed.
2. **cc14959: `composition.json`.** It holds 23 named features. Media features cover 5,075 shorts, and 2,481 of 2,770 pairs are measured on both sides.
   - The 1,224 transcript-API entries carry word indices where the times should be, so they are excluded from speech timing.
   - Cuts are now local scene-score peaks rather than a fixed 0.3, which missed real cuts at 360p.
3. **6c17244: win/loss tables.** There are seven findings at q < 0.10 out of 721 tests, and only two span channels:
   - Across the catalog, breakouts make their first cut at 5.4 s against 6.3 s for their controls (2,481 pairs).
   - In cluster 8 (4 channels), breakouts run 20 s against 40 s.
   - The other five sit in single-channel clusters, and the file labels them that way. Headline traits split nowhere.
4. **98c71c0: PAX2 Composition Ranker**, published to `NYSgpt/pax2-composition-ranker` (private, bytes verified, in the PAX collection). Both variants pass Gate X (0.55):
   - Composition only reads 0.566 held out, but only 0.525 leave-one-channel-out.
   - Combined (composition plus encoder neighbors) reads 0.595 held out and 0.574 leave-one-channel-out. That ties PAX2 Classifier v1 on the same pairs; it does not beat it.

## Open

- Window A's media fleet may have added media after the box took its census. Rerunning `APPLY=1 TYPES="c7i.4xlarge" WATCHDOG_MIN=130 ./scripts/composition/launch.sh` measures only the new ids. After it: `node scripts/composition/merge.mjs`, `findings.mjs`, then both fits.
- The findings feed the detail panel later; tonight's only UI claim is the chips.
- `data/raw/composition/` is git-ignored: the raw outputs and the pulled serving index.
