# What moves to S3 — audit of 2026-10-22

Measured against the committed tree (1,058 files, 76.4 MB) and build 32's Amplify log (`BUNDLE server=87M standalone=123M next=223M`; build 31 failed at 233.5 MB against 230.7 MB).

## 1. The whole repo is traced into the bundle (fix first)

Build 32's log carries one Turbopack warning: *"A file was traced that indicates that the whole project was traced unintentionally"*, import trace `src/app/api/library/file/route.ts`. Its `readFile(path.join(process.cwd(), local))` takes a variable path, so the tracer copies the project — `data/`, `docs/`, `scripts/`, `public/` — into the server output. Every data file counts against the cap today, including the 19.7 MB no route reads.

- **Fix:** replace the variable path with the four literal paths (a `switch` on the four allowed names), or move those four files to S3 and serve them through the same signed link the route already uses for S3 keys.
- Same pattern, not yet flagged, possibly also tracing wide: `src/lib/video-reads.ts` (`at(p)`), `src/app/reinforcement-learning/page.tsx` (`read(p)`), `src/app/api/dev-locate/route.ts` (reads source files; dev only — gate it out of production).
- **Trade-off:** none for users. **Verification:** the next build's `BUNDLE` line and the warning's absence. The size drop is not known until that build runs; I won't quote a number before it.

## 2. Data the app reads — move to the generated-store path (`src/lib/generated-store.ts`)

Already moved: `question-bank`, `codebook`, `vqa-census` (6.9 MB), and `feed-index.json` (7.2 MB, `s3://…/app/`).

| File | MB | Read by |
|---|---|---|
| model/composition.json | 4.68 | question-resolver, api/encoder-map |
| model/encoder-map.json | 4.37 | api/encoder-map, question-bank |
| model/thumb-features.json | 3.89 | path read |
| features.json | 1.07 | data-files.ts |
| course-items.json | 0.98 | static import (inlined into each route chunk that uses it) |
| video-reads.json | 0.83 | video-reads.ts, question-resolver |
| model/var-model-v3.json | 0.65 | static import |
| lab-stages.json | 0.40 | lab-actions |
| home-feed, reference-model, winning-modes, composition-findings | 0.87 together | path reads |

About 17.7 MB. The ~50 files under 0.2 MB stay as they are.

| Trade-off | Mitigation |
|---|---|
| First request on a fresh server waits on the S3 read (same region; a 4 MB object is a fraction of a second, not yet measured) | Cache per server (already in generated-store); warm the large files at server start in `instrumentation.ts` |
| Sync reads become async; callers change | Server components and route handlers await; grep each caller, one commit per file |
| Regenerated locally but never uploaded → production serves the old file | Generator scripts call `scripts/upload-generated.mjs` at their end; a pre-build step in `amplify.yml` checks every registered key exists in S3 and fails the build loudly |
| A failed read returns `null` → a blank block | Log the failure and render an explicit unavailable state, never empty |
| Files leave git → no history of data versions | Turn on S3 versioning for the bucket (currently off); storage cost is cents at these sizes |

## 3. Data only scripts read (18.8 MB) or nothing reads (0.9 MB, 44 files)

Prediction `.jsonl` files, video-resonance groups and splits, co-occurrence, learning-loop outputs. After fix 1 these leave the bundle on their own; they are repo weight only.

- Archive to `s3://pax-2-638175140432/archive/data/`, untrack, gitignore. Scripts read the local copy and pull from the archive when it is missing.
- Trade-off: a fresh clone lacks them. Mitigation: one `scripts/pull-data.mjs`.
- The 44 unread files: your deletion review, as you said.

## 4. Images and sketches in `public/` (7.6 MB)

| Folder | MB | Files |
|---|---|---|
| sketches | 4.56 | 14 |
| visuals | 1.88 | 4 |
| logos (66 channels, 10 models, 11 other) | 1.18 | 87 |

- **Sketches:** move to `~/Code/sketches` as you said, plus `docs/*.html` (6.6 MB). To keep `/library` working with no new infrastructure: upload them to `s3://…/library/sketches/` and point the Library entries at the existing `/api/library/file?key=` signed link (the `library/` prefix is already allowed).
- **Images:** Amplify already serves `public/` from its own CDN, so S3 makes them no faster; it saves about 3 MB of artifact. Serving them from S3 needs a public read path — a CloudFront distribution in front of a `public/` prefix (new standing infrastructure, needs your word, a few cents a month).
  - Trade-off: image URLs change. Mitigation: one `IMG_BASE` setting and a helper, every `<img>` goes through it; channel avatars uploaded by the ingest step land there directly.
  - I'd do it, but after 1–3.

## 5. Not in this audit

`node_modules` is most of the 123 MB standalone. Heavy dependencies and what each page loads are the performance window's job (`docs/briefs/PERF-AUDIT.md`).
