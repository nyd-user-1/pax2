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

## Report

**Shipped.** `/pipeline-2` is admin-gated: signed out, it redirects to sign-in; a non-admin gets a 404. It renders the whole factory as one fixed xyflow canvas (`src/components/factory-canvas.tsx`, page `src/app/pipeline-2/page.tsx`), full-bleed in the shell like /graph, fit to view, with pan and zoom. A legend band runs across the top, titled "The PAX2 factory". Nodes are hand-placed in columns: doors, intake stores, Measure, Score, Review, Publish, surfaces, and the services and instruments that feed the surfaces. The long return edges run as labeled rails under the main line. Every edge carries a label. No node floats free. There is no "→" in any label, and the only arrowheads are drawn markers. Nothing is draggable or selectable, so it reads as a slide. Not checked in a browser or typechecked locally, per the rules; the remote build checks the types.

**Legend: final type list.**
- Nodes: Door (solid blue; dashed = planned), Stage (blue-bordered, with its tools), Store (S3 prefixes, the DynamoDB ledger, the catalog JSON; the count is what it holds, dated when it comes from the accounting run), Instrument (numbered chip, 1–15 matching the Models table; Live or Staged), Service (amber, with unit cost where one is recorded), Surface (a page frame with its path).
- Edges: Flow (solid grey), Loop (violet, animated), Planned (dashed, static).
- Loops, each numbered on its edges:
  1. Re-entry: Publish, then `velocity/` readings, then the Admin console, then back into Measure as measured outcome.
  2. Machine learning: Measure to the catalog, then the catalog refits the instrument rack.
  3. Reinforcement learning: readings to P (15), then P to Record.
  4. Questions: Chat to Q (14), then Q to the catalog as a census column.

**Live counts.**
- Read live at render: catalog size (the feed index), shorts measured in `composition/` (the Lab Tested list), and the poller's 72-hour window plus channels followed (last `velocity/tiles.jsonl` snapshot).
- From `data/generated/accounting.json`, shown with its date: media held in `catalog-media/`, shorts embedded in the serving index, and transcripts. These come from the last `node scripts/accounting.mjs` run, because counting `catalog-media/` live is a paginated S3 listing, not one cheap read.
- Nodes with no cheap count (uploads/, the ledger) show none. No figure is invented.

**Services and unit costs.**
- Amazon EC2: about 1.5¢ an upload (c7i.large), as recorded in `lambda/analyze`.
- Amazon Polly: narration. The repo records no unit cost, so none is shown.
- Amazon Bedrock: Chat's written answers. No unit cost recorded.

**Drawn as planned.**
- The Batch scrape and Batch process doors.
- Button to Measure, for an unmeasured video: the Button door itself is drawn solid, since the flask landed in 96bbded while this was built, but running boxes on an unmeasured video is still planned there.
- Ledger to Measure: queued public videos from a connected channel. `docs/FETCH-WORKER.md` says the fetch worker is not built, so OAuth's solid edge stops at the ledger (catalog, analytics totals, retention curves).

**Flags.**
- Q (14), P (15), 8 and 13 are Staged. Their chips say so, but loops 3 and 4 still draw animated per this brief, though both run through instruments still in build.
- Feed ranker v0 (13) feeds the home feed only through the reader–channel affinity term it measured; the edge is labeled that way.
- `/pipeline-2` is not on the sidebar. The header reads "Pipeline".
- Shared file touched: one line in `src/components/shell.tsx`, the full-bleed list.
