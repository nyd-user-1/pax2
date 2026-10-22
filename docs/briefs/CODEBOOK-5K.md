# Codebook 5K — Swayable, Wesleyan and Upworthy codes for every baseline video

The deliverable: every one of the 5,379 baseline videos carries real codes for the three codebook blocks on the video page — `SwayableBlock`, `WesleyanBlock`, `UpworthyBlock` (`src/components/codebook-blocks.tsx`). The `Codes` type in that file is the output contract; produce exactly what it consumes. Runs independent of Window Q's census batch — do not touch its box, its `vqa/raw/` prefixes, or its local files except to read `data/raw/vqa/set.tsv` (the set: 5,379 ids with channels) and `data/raw/vqa/headline-scores.json`.

Budget **$5, hard cap** — flag before exceeding. Commit by explicit path; do not push. No local typechecks. No identity or demographic inference; every code here is a content trait.

## The rig

One **spot** GPU box (g6.xlarge or g6.2xlarge), the house pattern — `scripts/vqa/box.sh` and `launch.sh` are the reference: self-terminating with a watchdog, code and log uploaded to `s3://pax-2-638175140432/codebook/runs/<stamp>/`, outputs one JSON per video under `codebook/raw/<tag>/<id>.json`, resume-safe by id (skip ids whose output object exists). Model: `Qwen/Qwen3-8B` through vLLM with prefix caching (text-only passes; if the box already proven by Window Q is preferred, `Qwen/Qwen3-VL-4B-Instruct` takes text prompts — pick one and state it). Inputs are transcripts, read from the same sources `scripts/accounting.mjs` counts.

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
