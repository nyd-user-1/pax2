# Codebook 5K — Swayable, Wesleyan and Upworthy codes for every baseline video

The deliverable: every one of the 5,379 baseline videos carries real codes for the three codebook blocks on the video page — `SwayableBlock`, `WesleyanBlock`, `UpworthyBlock` (`src/components/codebook-blocks.tsx`). The `Codes` type in that file is the output contract; produce exactly what it consumes. Runs independent of Window Q's census batch — do not touch its box, its `vqa/raw/` prefixes, or its local files except to read `data/raw/vqa/set.tsv` (the set: 5,379 ids with channels) and `data/raw/vqa/headline-scores.json`.

Budget **$5, hard cap** — flag before exceeding. Commit by explicit path; do not push. No local typechecks. No identity or demographic inference; every code here is a content trait.

## The rig

One GPU box (g6.xlarge or g6.2xlarge), the house pattern. Spot first — but the spot G quota is 8 vCPUs and Window Q's census box holds it until that batch ends, so if the spot request fails, launch **on-demand g6.xlarge** (about $0.80 an hour) rather than waiting; state which you ran and its cost — `scripts/vqa/box.sh` and `launch.sh` are the reference: self-terminating with a watchdog, code and log uploaded to `s3://pax-2-638175140432/codebook/runs/<stamp>/`, outputs one JSON per video under `codebook/raw/<tag>/<id>.json`, resume-safe by id (skip ids whose output object exists). Model: `Qwen/Qwen3-8B` through vLLM with prefix caching (text-only passes; if the box already proven by Window Q is preferred, `Qwen/Qwen3-VL-4B-Instruct` takes text prompts — pick one and state it). Inputs are transcripts, read from the same sources `scripts/accounting.mjs` counts.

## Pass A — Swayable, 28 traits

The coder's definition already exists: `src/lib/evaluate.ts` (the prompt, the trait keys, the output JSON: `traits: [{key, present, quote, change}]`). Reproduce that prompt verbatim for the box, one call per video over title + transcript. The merged output per video must carry the same trait keys the record flow's coder emits, so one video coded by either path reads identically.

**Verify before the batch, 20 videos:**
1. Run the same 20 through the existing Bedrock coder (`evaluate.ts`'s exact call, `claude-sonnet-4-6`) — about 40¢ — and report per-trait agreement of the open model against it.
2. Where `/labeling` holds hand labels for any baseline video, report agreement against those too.
3. If the open model misses badly, one retry on the next size up — state the delta and the cost before proceeding.

## Pass B — Wesleyan

Same box, same pass structure, second prompt. The schema is the glossary's (`src/lib/glossary.ts`, id `wesleyan`): the 2022 Meta coding — **goal** (persuade voters / raise money / both), **tone** (attack / contrast / promote), **party favored** (Democratic / Republican / neither). One call per video over title + transcript. Output must match the shape `WesleyanBlock` consumes. The same 20-video verification: Bedrock cross-check plus hand labels where they exist, agreement reported per column.

## Pass C — Upworthy (no GPU)

`data/raw/vqa/headline-scores.json` already scores all 5,379 titles (one scalar per id). The block needs pattern-level codes: find where `codes.upworthy` is built for originals (the Upworthy headline-pattern machinery `evaluate.ts`'s comment names), reuse that exact code locally over the titles, and carry the existing scalar alongside. Do not re-model it. Titles exist for the full catalog, so run this pass over all 19,057 — it is local and free.

## Merge and wiring

- One generated file: `data/generated/codebook.json` — id to `{swayable, wesleyan, upworthy}` in the `Codes` shape. State its size in the Report; if it exceeds 8 MB, store per-video objects on S3 and read them server-side the way `src/lib/velocity-store.ts` reads, and state that choice.
- `src/components/short-view.tsx` line 508 reads `sample?.codes` — change it to read real codes first (sample only where no real code exists), and drop the "Sample figures" footer on blocks showing real codes.
- Demo rows keep their sample codes; no invented code ever enters `codebook.json`.

## Stretch, only if budget remains after the 5,379 land

Passes A and B over every transcribed short (14,896 by the accounting run). The ~4,100 without transcripts cannot be coded from text; name them as unlocked by the captions path and stop there.

## Report

Append `## Report`: the 20-video agreement tables (per trait, per column, against Bedrock and against hand labels), batch duration and box cost, counts coded per pass, the codebook.json size and where it lives, and anything deferred with why.

## Report

All 5,378 transcribed baseline videos carry Swayable and Wesleyan codes, and all 19,057 catalog titles carry Upworthy codes, in `data/generated/codebook.json` (2.58 MB, in the repo, imported server-side by `short-view.tsx`). The 5,379th baseline video, `bmIEPFgxcCw`, has no transcript and stays uncoded. Spend: **$4.15** of the $5 cap.

**Rig.** Ran on on-demand g6.xlarge (L4 24 GB) at $0.8048/h. Spot returned MaxSpotInstanceCountExceeded: Window Q's `pax2-vqa-ask` g6.2xlarge held the 8-vCPU spot quota the whole run. Model: `Qwen/Qwen3-8B`, vLLM 0.32.0, FP8 weights quantized at load, FP8 KV cache, prefix caching, thinking off, temperature 0, maxTokens 4000 (evaluate.ts's settings). Code: `scripts/codebook/`. Prompts are built once by `prompts.mjs`, so the box and Bedrock read identical text. Outputs: `s3://pax-2-638175140432/codebook/raw/qwen3-8b-v2-{a,b}/<id>.json`; logs and code under `codebook/runs/<stamp>/`.

**Batch.** Two boxes shared one list: box 1 forward from 22:19 UTC; box 2 launched 22:42, walking it in reverse and re-reading finished ids before each chunk. Both finished by 00:20 UTC, 2 h 1 min wall. Each box ran 31–32 videos/min (~780 output tokens/s). Box 1 was terminated at the meeting point. About 380 videos were coded twice in box 2's chunk at the crossing (~$0.16).

| | cost |
|---|---|
| verification box, Qwen3-8B, 20 videos | $0.18 |
| retry box, Qwen3-14B, 20 videos | $0.32 |
| batch box 1 (110 min) | $1.50 |
| batch box 2 (98 min) | $1.34 |
| Bedrock, `claude-sonnet-4-6`: 20 × both prompts, then 20 × prompt b v2 | $0.82 |
| **total** (`node scripts/codebook/cost.mjs`) | **$4.15** |

**Counts coded.** Pass A, Swayable: 5,375 of 5,378.
- 271 replies broke the JSON (an unescaped quote in a "change" line, or `"key": "x": "present"`). Their present flags are read off the text by pattern, a fallback evaluate.ts does not have.
- 3 replies have no readable flags and stay uncoded.

Pass B, Wesleyan: goal and party on all 5,378. Tone on 4,260: the rest answered "neither", which is not one of Wesleyan's three tones, so those are left blank. Pass C, Upworthy: 19,057 titles, 12,086 of them carrying at least one pattern, with the headline score on the 5,379.

### Verification, 20 videos (`data/raw/codebook/verify-ids.txt`; `data/generated/model/codebook-verify.json`)

**Swayable** pooled over 28 traits × 20 videos, open model against Bedrock: agreement **0.82, κ 0.61**. One verification video (`mV0zO4WIWWc`) has hand labels in `/labeling`: 26 labels from one voter. Against those: open model 0.73, Bedrock 0.69.

| trait | agree | κ | present, open / Bedrock | hand: open / Bedrock |
|---|---|---|---|---|
| messenger_veteran | 0.95 | 0 | 1 / 0 | 1 / 1 |
| tone_contrast | 0.65 | -0.21 | 16 / 17 | 0 / 0 |
| production_value_high | 1 | — | 0 / 0 | 0 / 0 |
| technique_plain_folks | 0.75 | 0.49 | 11 / 12 | 0 / 0 |
| messenger_politician | 0.9 | 0.76 | 6 / 6 | 1 / 1 |
| narration_personal_story | 0.95 | 0.83 | 4 / 3 | 1 / 1 |
| explicit_vote_for | 0.95 | 0 | 1 / 0 | 1 / 1 |
| emotion_enthusiasm | 0.85 | 0.71 | 8 / 11 | 1 / 1 |
| narration_explain_facts | 0.85 | 0.63 | 13 / 16 | — |
| technique_neg_testimonial | 0.8 | 0.58 | 8 / 8 | 1 / 1 |
| emotion_hope_pride | 0.75 | 0.43 | 7 / 6 | 1 / 1 |
| fact_new_yes | 0.75 | 0.49 | 11 / 12 | 0 / 0 |
| emotion_humor | 0.95 | 0.86 | 4 / 5 | 1 / 1 |
| messenger_celebrity | 0.9 | 0 | 2 / 0 | — |
| emotion_anger | 0.85 | 0.69 | 12 / 11 | 1 / 1 |
| how_scripted | 0.3 | 0 | 20 / 6 | 1 / 1 |
| technique_pos_testimonial | 0.8 | 0 | 0 / 4 | 1 / 1 |
| policy_facts | 1 | 1 | 11 / 11 | 1 / 1 |
| tone_positive | 0.7 | 0.43 | 9 / 15 | 1 / 1 |
| tone_negative | 0.8 | 0.49 | 13 / 17 | 1 / 1 |
| style_amateur | 0.65 | 0.3 | 13 / 10 | 1 / 1 |
| fact_cite_yes | 0.9 | 0.61 | 3 / 3 | 0 / 0 |
| style_text_on_screen | 0.8 | -0.08 | 3 / 1 | 1 / 0 |
| messenger_every_people | 0.55 | 0.04 | 7 / 8 | 0 / 0 |
| narration_advocate_opinions | 0.85 | 0.32 | 17 / 18 | 1 / 1 |
| emotion_somber | 0.9 | 0.62 | 4 / 2 | 1 / 1 |
| emotion_fear | 0.85 | 0.67 | 8 / 5 | 1 / 1 |
| style_animation | 1 | — | 0 / 0 | 0 / 0 |

`how_scripted` is the clear miss: the open model marks it present on 20 of 20, where Bedrock marks 6. Across the batch it is present on 99% of videos, so on the video page it reads as a constant, not a code. `tone_contrast` (78% of the batch, κ −0.21) and `messenger_every_people` (κ 0.04) are also weak. Everything else ranges from κ 0.3 to 1.0.

**Wesleyan.** No hand labels exist for Wesleyan; `/labeling` covers only Swayable's traits. Agreement against Bedrock:

| column | first 20, v1 prompt (8B) | first 20, v1 prompt (14B retry) | first 20, v2 open vs v1 Bedrock | fresh 20, both on v2 |
|---|---|---|---|---|
| goal | 0.70 | 0.75 | 0.80 | **0.95** |
| tone | 0.45 | 0.35 | 0.40 | **0.55** |
| party | 0.60 | 0.65 | 0.65 | **0.85** |

The v1 prompt missed badly: the 8B coded the party a video attacks, not the one it favors. Examples: Brian Tyler Cohen and Pod Save America coded Republican, Daily Wire coded neither.

**Retry on the next size up (Qwen3-14B, same 20, $0.32):** Swayable +0.02 (0.84, κ 0.64), goal +0.05, party +0.05, tone −0.10, at half the speed (168 against 341 output tokens/s at 20 videos). That would roughly double the batch, past the cap. The batch stays on the 8B.

The Wesleyan misses were definitional, so the fix went into the prompt, which is this brief's own wording, not a verbatim copy:
- "persuade" covers criticizing the other side;
- tone is exactly one of three;
- party is the side favored, not the side named.

Prompt A (evaluate.ts's, verbatim) is unchanged. v2 was written after reading the first 20, so the fresh 20 (`verify2-ids.txt`, Bedrock on the identical v2 prompt, `verify-wesleyan.mjs`) is the honest measure. Tone remains weak and is not shown on the page; only goal is.

Batch shares: goal persuade 4,207 / neither 1,171; party Democratic 2,443 / Republican 1,528 / neither 1,407; tone attack 2,447 / promote 1,178 / contrast 635.

### Wiring

- **`codebook.json` shape.** `id → {swayable, wesleyan, wesleyanTone, wesleyanParty, upworthy: {patterns, score?}}`. `swayable` and `wesleyan` are the `Codes` contract unchanged. `Codes` in `codebook-blocks.tsx` gains the three new optional fields.
- **Upworthy codes.** There is no `codes.upworthy` for originals. evaluate.ts and `UpworthyBlock` both call `titlePatterns`. Pass C runs that file's own `PATTERN_TESTS`, loaded from `src/lib/headline-patterns.ts`, so no copy exists. The block still computes from the title live, so the stored patterns match what it shows.
- **`short-view.tsx`.** Reads `codebook[ytId]` first and the sample only where no real code exists. "Sample figures" now shows only on blocks drawing from the sample.
- **The one sample video, `yt-hZIoLkOpNg4`.** It is a baseline video, so it now shows its real codes in place of the invented ones. No invented code entered `codebook.json`. Demo takes have no ids in the codebook and keep theirs.

### Deferred

- **Stretch, passes A and B over the other ~9,500 transcribed shorts.** Not run: at 63 videos/min on two boxes it is ~2.5 h and ~$4, against $0.85 left. `prompts.mjs` with `SET=all` builds the prompts. Shorts without transcripts can't be coded from text; they wait on the captions path.
- **`how_scripted`.** Kept so the keys match the record flow's coder. Dropping it from the Swayable block, or recoding it with Bedrock, is a call for the owner.
- **Typecheck.** No local typecheck, per standing rule; the remote build checks types.
