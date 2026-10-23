# The question bank — every question the measurements can already answer, asked like a human

The suggested prompts today are not questions a person would ask, and they undersell what the platform measures. Fix both: build the full universe of free questions — answerable instantly from stored measurements, no GPU, no box — and ship them as the suggested-prompt chips. `docs/roadmap/roadmap-1.html` ("Video question bank") is the seed; its reader-voice chips set the register ("What happens in the first two seconds?"). Commit by explicit path; do not push. No local typechecks.

## 1. Inventory what can be answered for free

Walk the stores and list every measurement a question can resolve to: composition (shots, cuts, pacing, the loudness curve, every on-screen-text moment), transcripts with word timings, the serving index (nearest neighbors), velocity (views, outperformed 3x, channel medians, the 72-hour curves), the census seven with their audited accuracies (`data/generated/model/vqa-census.json`, accuracies in `docs/briefs/WINDOW-Q.md`'s Report), the codebook three once `data/generated/codebook.json` carries real codes, topic clusters and the measured lifts, the winning-modes craft axes, the Swayable lean, the publish policy's advice. The Report lists the inventory.

## 2. Write the questions

For each measurement, questions in the reader's voice — what a creator or partner would actually tap, not what the column is named. Target 40 to 80, each with: the question as shown, the columns it reads, and the answer template. Three registers, all present:

- **The video in hand**: "What happens before my first word lands?" "When should I ask viewers to act?" "What does this look like on mute?" "Show me every moment with on-screen text."
- **Against the field**: "Why might this one have outperformed?" "What do videos like this one do differently?" "What's different about my best video?"
- **What to do**: questions whose answers end in a grounded recommendation — only where the registry holds a measured lift; the citation renders with it.

The bar for every question: a human would ask it unprompted, and the answer demonstrates measurement — a number, a timestamp, a comparison with its basis. A question whose data is missing for a given video renders its unlocking action (the metrics pattern: run the flask, add captions), never an apology and never an invented answer.

## 3. Build the answering layer and bank it

One definition file (question id, phrasing, resolver, template) and one resolver lib over the existing stores — typed lookups, no model call anywhere in this brief. Precompute the expensive joins per baseline video into `data/generated/question-bank.json`; resolve the cheap ones at render. State the file's size in the Report; over 8 MB, per-video on S3 read server-side.

## 4. Ship the chips

The roadmap's placement: chips on the video page's chat side panel and in /chat when a video is attached. Render from the bank; log `chip-shown` (position, propensity, surface) and `chip-tap` exactly as `learning/chat-suggested-prompts.json` registers them, so loop 9's bandit starts learning which questions humans ask the moment chips exist.

## Rules

- Question phrasing is conversational; answer templates are scientific voice — a fact, a number, a basis. Defined terms from `src/lib/glossary.ts`; never "breakout"; no "→"; no identity or demographic inference anywhere.
- Where a census column answers, the answer carries its audited accuracy once, quietly ("read from the frames, 95 of 100 right in audit").
- GPU-answered free-text questions are out of scope here; they are pass 2, registered separately.

## Sketches (added 2026-10-22, before the Report)

Three cheap HTML sketches under `docs/sketches/`, committed with the rest:

1. `question-universe.html` — the whole bank on one browsable page: the three registers as sections, every question drawn as its chip with the columns it reads and its basis in small type beneath, and GPU-only pass-2 questions present but dashed.
2. `chips-video-panel.html` — the video page with the chat side panel open at its standing 420px, the chip row above the composer, one chip tapped and its answer rendered in the app's chat dress: the number, the timestamp, the basis.
3. `chips-chat.html` — /chat with a video attached from the plus menu, the same chips re-ranked for that context, one answered, and a small dev-corner overlay showing the `chip-shown` and `chip-tap` events the taps would log.

## Report

Append `## Report`: the inventory, the question list by register with resolver columns, the bank's size and home, the chips as shipped with their event wiring, and anything deferred with why.

## Progress

**2026-10-22, the universe for review.** 57 free questions (28 the video in hand, 21 against the field, 8 what to do) and 9 pass-2 questions, each with its columns, basis, answer template and unlocking action, in `src/lib/question-bank.ts`; drawn whole in `docs/sketches/question-universe.html` with how many of the 5,379 baseline shorts each answers today (`node --experimental-strip-types scripts/question-universe.mjs`). Strike or reword there or in the file; edits fold in before the chips ship.

Inventory, over the 5,379 baseline shorts:

| store | what a question can resolve to | covers |
|---|---|---|
| composition, per short (`data/raw/composition/raw/`) | every scene cut, OCR word count and text area each second, loudness each second, integrated level and range | 5,379 |
| composition, summary (`model/composition.json`) | 23 features: pacing, hook cuts/text/words, loudness, brightness, title traits | 5,379 (speech timing 4,714) |
| transcripts | the words; timed where the source is captions (4,135) or Whisper (579); the transcript API's 664 carry word order only | 5,378 |
| census (`model/vqa-census.json`) | captions, call to action and its second, format, setting, people screen share, third-party watermark; audit counts from `vqa-audit.json` ride with each answer; people count (0.36) and product (unvalidated) are not used | 5,379 |
| codebook (`codebook.json`, landed 20:20 today) | 28 Swayable traits, Wesleyan goal, Upworthy title patterns | 5,375 / 5,375 / 5,379 |
| serving index (`data/raw/composition/index`) | nearest neighbors, cosine on 1,024 dimensions | 5,379 |
| velocity catalog | views, likes, comments, channel median, Outlier Score, tier | 5,379 |
| 72-hour curves (`model/velocity-features.json`) | views at 1, 6, 24, 72 h | 59 |
| craft templates (`video-reads.json`) | within-channel percentiles on 24 axes | 5,379 |
| winning modes | mode-match score; one surviving mode, held-out lift 50.8% against 39.9% | 5,379 |
| topics + topic lift | 40 clusters; 14 topics with a lift measured in 5+ channels | 5,379 |
| composition findings | 2,770 within-channel pairs, overall and per cluster, 7 splits at q < 0.1 | all |
| length crossing | outperform/underperform share by length bin | all |
| census registry (`model/vqa-registry.json`) | Breakout lift per census trait; one recommendation (on-screen call to action, -7.0) | all |
| publish policy | posterior over topic x length x hour block, by family | 5,379 |
| Swayable patterns | 28 trait differences in vote choice; no trait's 90% range clears zero, so persuasion answers stay descriptive | all |

On-screen text is stored as word counts, not the words, so "what would someone know by second three with the sound off" is pass 2.
