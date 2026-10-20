# Overnight window C — PLUM, Brendan's version: composition over the behavioral landscape, plus the graph UI

Brendan signed off 2026-10-20 ~03:00 Eastern. His formulation, verbatim target: "semantic meaning, corrected by what audiences actually treat as similar and filtered by video composition (structure, pace, length, topic, headline, emotion, audio, frames, hook, etc.)." Composition stays OUTSIDE the embedding as named, legible features — an embedding dimension is not actionable; "winners here hook in 1.8s, yours is 4.1s" is. Rules: `docs/LEAD-LOOP.md` — real service names, boxes self-terminate, stage by pathspec, never push, no unmeasured numbers. Spend ceiling: **$3**.

## Part 1 — compositional extraction over the pairs media (one GPU/CPU box after a rehearsal)

Input: the breakout/control pairs media in `s3://pax-2-638175140432/catalog-media/` (5,106 mp4 / 5,098 m4a now; window A adds more). New `scripts/composition/`: per video, measured features only —
- duration; scene-cut rate (ffmpeg scene scores) → pace; hook window (cuts + loudness in the first 2 s);
- speech rate where a transcript with word timings exists; loudness curve; music-vs-speech balance;
- text-overlay density (frame sampling + OCR if the box budget allows; otherwise skip and say so);
- headline traits from the title (length, question, number, caps run).
Rehearse on 20 videos first, measure cost, then size the full run against the $3 ceiling — partial coverage honestly labeled beats a blown budget. Output: `data/generated/model/composition.json` (id → features), coverage counts included.

## Part 2 — within-neighborhood win/loss tables (Mac, no spend)

Join composition onto the vector graph's clusters and the breakout/control pairs: per cluster (n≥50) and per feature, the measured split between breakouts and their same-channel controls — medians, deltas, and a plain-language line per finding ("cluster 7 breakouts cut 2.1×/s vs 1.3×/s for controls"). Output `data/generated/model/composition-findings.json`; it feeds the detail panel later, no UI claim tonight beyond Part 3.

## Part 3 — the graph UI, finishing what's half-built

`src/components/graph/cluster-map.tsx` currently references `TOUR`/`tour`/`setTour` that DO NOT EXIST yet — the file does not compile; finish it first:
- `const [tour, setTour] = React.useState<number | null>(null)`, a `TOUR: string[]` of five short steps (every dot a short, distance is similarity and the axes themselves carry no meaning; the strip ranks neighborhoods by lift over the channels' own baselines, many channels = a content finding; the color modes and the ±12 legend; click to pick and dim, click again for points; composition chips dim what doesn't match), and a "Tour" button in the header row.
- Wire the Composition mode's chips to Part 1's real features via `/api/encoder-map` (serve duration + available features per point; keep the headline-trait chips working where media features are missing).
- Copy rules: third person, no vendor or model names on the UI, no explainer paragraph under any heading, no "→" characters.

## Part 4 — the compositional PLUM model (raised at Brendan's word, ~03:25 Eastern; Mac-scale, no spend)

A fitted model, not just the table — and Brendan's bar is three gated PLUM models tonight; this is the third. Two variants, both held out by channel on the same-channel breakout/control pairs:
- **composition-only**: logistic or gradient-boosted on the measured compositional features;
- **combined**: the same features plus the embedding evidence (cosine to known outliers / the pairwise fit's inputs) — semantic meaning, corrected by behavior, filtered by composition, in one scorer.
**Gate X, pre-registered: held-out pair accuracy ≥ 0.55** for each variant. Ship every passer (the combined one is the headline); a failed gate gets ONE more measured attempt (feature mix, regularization) at the same bar — then report plainly. Passers publish private under NYSgpt into the PAX collection; every number joins the ledger.

## The docs page — Brendan's requirement, not optional

`docs/PLUM-COMPOSITION.md`: the identical before/after ledger shape as window B's (every standing metric, before value with run id, after value, delta, unchanged rows listed). Composition adds its own measured rows: feature coverage, and each win/loss finding with its cluster, n, and split. Snapshot "before" FIRST.

Commit per part with explicit paths; findings and measured costs in the morning handoff.
