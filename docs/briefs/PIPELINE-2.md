# /pipeline-2 — the factory, drawn to the standard it deserves

Build a new admin-gated page, `/pipeline-2`: one high-resolution, pan-and-zoom factory diagram of the whole PAX system on the xyflow canvas (`@xyflow/react` is installed; `src/app/flow/[id]` and `src/components/video-graph.tsx` carry the house canvas idiom). The quality bar is a Salesforce platform ERD: a legend band up top defining every node type and edge type, typed boxes, a label on **every** edge, nothing floating, nothing unexplained. The page must stand alone as a slide with no slide before or after it.

## Node types (the legend defines each, visually distinct)

- **Door** — how a video enters: Record, Upload, Button (the flask on any card), OAuth (a client connects their channel — the biggest door), Admin console (the poller's live and finished tables on /tracking; batch scrape and batch process drawn in the legend's *planned* dashed style — they are not wired yet, and the diagram never lies).
- **Stage** — Measure, Score, Review, Publish. Measure names its real tools: ffmpeg scene scores and EBU loudness, ffprobe, Tesseract OCR, on self-terminating EC2 boxes; captions via the proxy fleet and TranscriptAPI; the text embedding into the serving index.
- **Store** — S3 (`catalog-media/`, `composition/`, `uploads/`, the index), DynamoDB (the ledger), the catalog JSONs. Real service names, plain words.
- **Instrument** — the models, each chip numbered to the Models table on docs/ACCOUNTING.html (1–15, Q is 14, P is 15).
- **Service** — the paid externals actually in use (Polly, Bedrock where true), with per-unit cost where the repo records one.
- **Surface** — what the factory feeds: /chat (Q's answers), the home feed, /v pages, /tracking.

## The loops (the point of the drawing)

1. Publish puts the video on the poller; the poller's readings land in the tracking tables and the video **re-enters** as measured outcome — draw this return edge explicitly.
2. Every run's measurements join the catalog; the instruments refit from it (Machine learning).
3. Outcomes train the publish-next policy (Reinforcement learning, 15) which advises the next recording.
4. Questions asked in /chat run through Q (14) and their answers become census columns.

Loop edges are animated (xyflow animated edges), visually distinct from flow edges, named in the legend.

## Live numbers

Where a count is one cheap server read (catalog size, media held, composition measured, index size — the accounting page's arithmetic in `scripts/accounting.mjs`), the node shows the live number. No invented figures anywhere.

## Rules

- Third person; never name the model behind the product; approved vocabulary only (`src/lib/glossary.ts`); no "→" character in any label (drawn SVG arrowheads are fine).
- Admin-gated like the other admin pages. Responsive; no browser tests; no local typechecks.
- Commit by explicit path; **do not push**.

## Report

Append `## Report`: what shipped, the legend's final type list, which counts are live, and anything drawn as *planned*.
