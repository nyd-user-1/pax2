# Brief: port the NSR graph workspace to PAX2's /graph, and add the admin Model Recipe builder

Written 2026-10-17 by the lead session for an executing window. Execute the parts in order. Do not spawn subagents. Do not push. Commit per part.

## Read first

- `AGENTS.md` and `/Users/brendanstanton/.claude/CLAUDE.md`: no explainer paragraphs under headings, no "→" anywhere in the UI, app copy in the third person, never the word "Claude" in the product, no labels that restate what the layout already shows.
- `docs/SPEC.md`: what PAX2 is and where /graph sits. Requirement 10 is the one the recipe builder tracks.
- `src/components/video-graph.tsx` (470 lines): the current PAX2 canvas. Keep its data model (channels, videos, tags, topics, groups from `patternsData()`), its receipts, its join-on-select behavior, and its design tokens (`pax2-blue`, `pax2-light-blue`, `pax2-lavender`, `pax2-mist`, `shadow-e1`/`e2`, `whiteButton()`).
- `src/app/graph/page.tsx`, `src/components/shell.tsx` (the `full` branch lays /graph edge to edge), `src/lib/auth.ts` (`currentUser()` gives `{ email, admin }`), `src/lib/ledger.ts` (append-only DynamoDB: `putOnce`, `get`, `query`, `now`), `src/app/actions.ts` (`uploadUrl` is the presigned-PUT pattern), `src/app/api/chat/route.ts` (streams plain text; system prompt built from `BASE_SYSTEM_PROMPT` plus the record), `src/components/chat/chat.tsx` and `src/components/discussion-panel.tsx` (the chat surface and the shell's right slot).
- The reference implementation, read in full before writing a line: `/Users/brendanstanton/Code/nsr/src/pages/GraphPage.tsx` (1,731 lines), `/Users/brendanstanton/Code/nsr/src/components/FlowSettings.tsx`, `/Users/brendanstanton/Code/nsr/src/lib/drag-entity.ts`, `/Users/brendanstanton/Code/nsr/src/components/EntityDetail.tsx`, `/Users/brendanstanton/Code/nsr/src/components/ChatDock.tsx`, `/Users/brendanstanton/Code/nsr/api/graph.ts`, and `/Users/brendanstanton/Code/nsr/docs/HANDOFF-GRAPH-NEXT.md` for the design rationale. NSR is Vite plus React Router plus Neon; PAX2 is Next 16 App Router plus DynamoDB plus S3. Port behavior, not stack.

## House rules that are enforced by hooks on this machine

- Full-project `tsc --noEmit`, `tsc -p`, and `eslint` are blocked. Verify types file-scoped: copy the changed files into a scratch directory under `/private/tmp/claude-501/`, rewrite `@/` imports to relative paths with `sed`, copy the JSON files they import, and run `npx tsc <files> --target es2022 --module esnext --moduleResolution bundler --jsx react-jsx --strict --skipLibCheck --resolveJsonModule --esModuleInterop --outDir <scratch>/out --rootDir <scratch>`. No diagnostics and emitted files means it passed. Imports from `next/*`, `@xyflow/react`, `lucide-react`, `sonner` resolve from the repo's `node_modules` only if the scratch dir sits inside the repo; if they do not resolve, pass `--baseUrl /Users/brendanstanton/Code/pax2` and `--typeRoots /Users/brendanstanton/Code/pax2/node_modules/@types`, or symlink `node_modules` into the scratch root.
- `next dev`, `next build` and any local build are blocked. Brendan builds on Amplify from GitHub. Do not try.
- No AWS spend and no infrastructure change. The ledger table `pax2-ledger` and the bucket `pax-2-638175140432` already exist; writing rows and objects to them is in scope.

## Part A: port every NSR workspace feature missing from PAX2's /graph

Each item names the NSR behavior and the PAX2 adaptation. Where PAX2 has no backend equivalent, the data is already on the client (`GraphData`), so compute there.

A1. **Selection and dimming.** Clicking a card selects it (keep the existing join-on-select, run it on the same click). The selected card gets the accent border; every card not connected to it by an edge drops to 30% opacity; edges touching it draw in `pax2-light-blue` at width 2, others at 15% opacity. Pane click clears. NSR: `connected`, `dimmed`, `rfNodes`/`rfEdges` memos.

A2. **Detail panel on the right.** Selecting a card opens a 320px panel (hidden under `md`) with a type badge, a draggable title (A7), and a body per type. Video: title linking to `/v/yt-<id>`, channel, published date, length, views, likes, comments, ratio and tier chip, tags as chips, topics as chips, then a Provenance box: "YouTube Data API, read by the poller" with the catalog fetch date from `patternsData().start` and the readings count. Channel: group, subscribers, median, tracked count, pushed and killed counts, and a "Videos on canvas" button that expands its videos (the NSR `onCanvas` idea: nothing on /graph navigates away; a small secondary link opens `/campaigns` or `/v/` in a new tab). Tag and topic: count, and "Videos on canvas". Group: channel count and "Channels on canvas". Port `DetailBody`'s `Field` shape.

A3. **Edge panel.** Clicking an edge opens the same right panel with an "edge" badge (or "inference", A9), Source and Target rows whose labels select that node, the receipt text from the existing `receipt()`, and the closing line "Every data edge on this canvas is a record PAX2 holds. Nothing is inferred." for record edges. Remove the bottom-center receipt toast.

A4. **Center, not just seed.** Picking a rail row or a search hit replaces the canvas with that entity and immediately expands its first relation (channel: videos; tag and topic: videos; group: channels; video: channel), so a centered entity arrives with its neighborhood. Keep "Add to canvas" as the non-destructive alternative (A6).

A5. **Search combo.** On focus with fewer than two characters typed, the dropdown shows "Most tracked": the top channels by pushed count, then the top videos by ratio, then tags and topics by count, paged fifteen at a time as the list scrolls. Results carry a type badge, are draggable (A7), and center on click. The bar takes NSR's shell: an outer rounded-full border with 4px inset around the inner bar, 384px wide, 32px tall inner. Toolbar pills are 32px tall, 13px text.

A6. **Rail row menu.** Hovering a rail row shows a "⋯" at its right; the menu offers Center on canvas, Add to canvas, Ask in chat. Rail rows are draggable (A7).

A7. **One drag payload.** `src/lib/drag-entity.ts` with MIME `application/pax2-entity`, `setDragEntity`, `readDragEntity`, and `describeEntity(g)` returning a plain-text paragraph for the chat's system context from the client-side data. Canvas cards get a grip at top right (`nodrag`, hidden until hover) that starts a native drag. Drop on the canvas adds the entity at the drop point without relayout and without recentering; drop on the chat dock attaches it (A10). Entity drops are checked before file drops.

A8. **Card rows.** Video cards carry two foldable groups, tags and topics, collapsed by default, with the count on the header; unfolding lists them and clicking a row adds that tag or topic to the canvas wired to the video. Channel cards carry one group, top videos, the four highest-ratio videos. Dagre must see the true height: port `nodeHeight()` and relayout on toggle.

A9. **Similar, as an inference.** Every video card gets an "≈ similar" chip. Similarity is computed on the client as Jaccard overlap of the union of lowercased tags and topics, top 6 with overlap above zero, excluding the anchor. Edges from it are dashed (`strokeDasharray: "6 3"`), labeled with the score to two decimals, carry `data.kind = "similar"`, and their panel badge reads "inference" with the receipt: "Computed from shared tags and topics. Not a record." Structure the code so a cosine from an encoder can replace the Jaccard later without touching the canvas (one function, `similarTo(video): { id, score }[]`).

A10. **Chat dock on the canvas.** A bottom-right "Chat" pill opens a 448px by 512px dock. Reuse `Chat` from `src/components/chat/chat.tsx` in compact mode if its props allow a `systemContext` supplier; if they do not, add an optional `context?: () => string` prop and pass it through to the request body as `systemContext`. Extend `src/app/api/chat/route.ts` to accept an optional `systemContext: string` and append it to the system prompt after the record. The dock's context is the canvas inventory (up to 30 entities as "type label") plus "The reader has <key> selected." Dragging an entity onto the dock, or Ask in chat from a rail row, sets an attached-context banner above the input with an X to clear; its `describeEntity` text is prepended. A `window` event `open-entity` with `{ type, id }` centers that entity; dispatch it from any citation chip the chat renders for a video id.

A11. **Prompt steps and runs.** Right-click on the pane adds a Prompt step node (dashed border, textarea, run button). "+ Prompt" in the toolbar does the same at the viewport center. Connections may only be drawn into prompt steps; any other `onConnect` shows a toast "Draw connections into prompt steps; data edges are records, not drawings." Run executes a step after its upstream prompt steps, assembling context from wired entities (via `describeEntity`), files (A12) and previous outputs, posting to `/api/chat` with `messages: [{ role: "user", content: prompt }]` and `systemContext`, streaming the output into the node. "Run" in the toolbar runs every prompt step in dependency order. Every run writes a trace: steps with status, input context, output, milliseconds; traces live in `localStorage` under `pax2-graph-runs`, capped at 20; a History pill opens the trace panel on the right, with a run selector when there is more than one. A failed step stops the run and marks its dependants skipped (the NSR TODO, done right here).

A12. **File drop and the Library rail.** Dropping a file on the pane uploads it by presigned PUT to `canvas/<workspace>/<id>-<name>` through a new server action `canvasUploadUrl(name, type)` in `src/app/graph-actions.ts`, then adds a file node (name, size, type; text files under 300 KB have their first 4,000 characters wired as context). The rail's Workspace section gets "Library": `listCanvasFiles()` lists that prefix; clicking adds the file node. Signed-in users only; signed-out drops show a toast asking them to sign in.

A13. **Save, Views, Recipes, boot params.** A Save pill opens a dialog (name; the saver is the signed-in email). State is `{ nodes: [{ type, id, label, sub, tier, prompt, output (first 2,000 chars), fileKey, fileText, openGroups, x, y, ...recipe fields }], edges: [{ s, t, k?, score? }] }`. Persist in the ledger: `pk VIEW#<id>`, `sk V#<iso>` for each save of the same canvas id (append-only versions; the latest is the newest sk), and an index row `pk VIEWS`, `sk <id>` with `{ name, by, kind, at }`. `kind` is `"recipe"` when the state has recipe nodes, else `"view"`. Server actions: `saveCanvas({ id?, name, state })`, `listCanvases()`, `loadCanvas(id)`. The rail's Workspace section gets Views and Recipes entries listing by kind; clicking loads onto the canvas and nothing navigates away. `/graph?view=<id>` boots to a saved canvas; `/graph?center=<type>:<id>` centers an entity; with neither, boot to the channel with the most pushed videos.

A14. **Canvas settings panel.** Port `FlowSettings.tsx` whole: every row a live `<ReactFlow>` prop, persisted in `localStorage` under `pax2-graph-flow-props`, with the tooltip on hover, Reset, and the two extra sections: Dataset (seeds: the top reform-core channel, the top reform channel, the most-tracked topic, the top video, Empty canvas) and Layout (None, Dagre LR, Dagre TB; "None" places new nodes beside their edge source, stacked). A Settings pill at the toolbar's right end toggles it; while open it replaces the detail, edge and trace panels.

A15. **Undo and redo.** ⌘Z, ⌘⇧Z, ⌘Y over content snapshots (store, expand state, edges, positions), coalescing within 150 ms, capped at 50, ignored while an input or textarea has focus. The boot is not an undo step.

A16. **Keyboard delete.** `onNodesDelete` removes from the store and the edge list; Backspace is the default delete key through the settings panel.

A17. **Toasts.** Add `sonner` and mount a `Toaster` inside the graph page only. Use it for every "already on the canvas", "all loaded", save and load confirmations, and errors.

A18. **Responsive.** The rail hides under `lg`; the right panels hide under `md`; the dock caps at `calc(100% - 2rem)` wide. Brendan checks layouts in his own browser; build them responsive in code.

## Part B: the Model Recipe builder, admin only

A recipe is a diagram, not a program: it draws how a model is made, what goes in, what is done to it, what comes out, and where it shows up, the way an entity-relationship diagram draws a schema. Brendan follows the build on it and marks progress by changing a card's status. Nothing on it executes. Running a model, or a chain of them, from this diagram is a future idea; leave the data shape open to it and build none of it now. The builder is a mode of /graph that only admins see. Non-admins never see the mode switch, the recipe node tools, the Recipes rail entry, or any recipe in `listCanvases()`.

B1. **Mode switch.** `src/app/graph/page.tsx` passes `admin: boolean` from `currentUser()` into `VideoGraph`. For admins the toolbar's left end, beside the search bar, gets a two-segment pill: Networks | Recipes. Networks is today's canvas. Recipes is the same `ReactFlow` with recipe node types enabled, the record rail replaced by the recipe rail (Templates, Saved recipes), and the join-on-select behavior off.

B2. **Four recipe node types**, in `src/components/graph/recipe-nodes.tsx`, each a card 240px wide with a status chip whose color is the node's left border:

- `ingredient`: a data source. Fields: `name`, `what` (one line), `where` (path, bucket, URL or "none"), `size` (free text), `license`, `status: "hold" | "partial" | "lack"`, `note`. Colors: hold `#16a34a`, partial `#d97706`, lack `#dc2626`.
- `step`: a process. Fields: `name`, `does` (one line), `tool` (script path, service or rig), `cost` (free text), `status: "done" | "running" | "planned" | "blocked"`, `owner` ("PAX2" or "Brendan"), `note`. Colors: done green, running `pax2-light-blue`, planned slate-400, blocked red.
- `model`: an artifact. Fields: `name`, `kind: "encoder" | "reranker" | "classifier" | "cpc" | "ranker" | "writer" | "other"`, `definition` (one line, the generic meaning), `trainedOn` (free text), `status: "exists" | "planned"`, `metrics` (free text), `where` (repo path or Hugging Face id), `note`.
- `output`: a product surface. Fields: `name`, `surface` (route or artifact), `status: "live" | "planned"`, `note`.

Prompt steps, file nodes and Run from Part A are not offered in Recipes mode.

B3. **Edges in Recipes mode.** User-drawn edges are allowed between any recipe nodes. The edge panel's receipt for a drawn recipe edge reads "Drawn by <email> on <date>. A plan, not a record." Record edges never appear in Recipes mode.

B4. **Editing.** Selecting a recipe node opens the right panel as a form: one input per field above, selects for the enumerations, a textarea for `note`, and Delete. Changes apply live through `patchNode` and recolor the card. The toolbar in Recipes mode shows "+ Ingredient", "+ Step", "+ Model", "+ Output", Save, Settings.

B5. **Templates.** `src/lib/recipes/memorable.ts` exports the "Memorable" template as a typed constant: nodes with ids, fields and a dagre-friendly order, and edges. The Templates rail lists every template (one today) and clicking loads it onto the canvas as an unsaved recipe named "Memorable". Save writes it as a recipe the admin can keep editing; the template constant never changes from the UI.

B6. **The Memorable template, exactly.** Node ids are stable; use them as `id` and connect by them.

Ingredients:
- `i-catalog` Lookback catalog. what: 18,455 settled shorts from 64 channels, each labeled breakout, baseline or killed against its channel's median. where: `data/velocity/catalog.json`, `data/generated/model/training-set.jsonl`. size: 18,455 rows. license: public YouTube counts. status: hold.
- `i-velocity` Velocity readings. what: views, likes and comments every 15 minutes for each short's first 72 hours. where: `s3://pax-2-velocity-638175140432/velocity/polls/`. size: 10 days, 41 MB. status: partial. note: the poller has been off since 2026-10-15.
- `i-meta` Video metadata. what: tags, category, topics, captions flag, language, duration. where: `velocity/meta.json`. status: hold.
- `i-thumbs` Thumbnails. what: one public image per catalog short; the first frame for a Short. where: `i.ytimg.com/vi/<id>/hqdefault.jpg`, `meta.json` thumbnail. size: 18,941. status: hold. note: never encoded.
- `i-videos` Video files. what: the shorts themselves. where: `s3://pax-2-638175140432/videos/`. size: 63. status: partial. note: downloads work from the Mac, not from AWS.
- `i-content` Content features. what: transcript with word timing, pace, pauses, loudness, pitch, Pegasus notes, delivery coding. where: `data/generated/features.json`, `delivery.json`. size: 51. status: partial.
- `i-paid` Paid outcomes. what: impressions, starts, ThruPlays, completions, clicks per creative. where: `data/generated/voter-freedom-paid.json`. size: 20 creatives. status: partial.
- `i-analytics` Organic impressions, click-through and retention. what: per-video YouTube Analytics from a connected channel. where: none. status: lack. note: one OAuth grant with the yt-analytics.readonly scope per partner channel; the Endgame page already asks.
- `i-swayable` Swayable persuasion archive. what: 617 randomized ad tests with coded traits. where: `s3://pax-2-638175140432/curated/swayable/`, `data/generated/model/reference-model.json`. license: CC0. status: hold.
- `i-upworthy` Upworthy headline tests. what: 32,487 randomized headline tests with clicks. where: `curated/upworthy/`, `data/generated/upworthy-top.json`. license: CC BY 4.0. status: hold.
- `i-coppock` Coppock 2020 and the emotional-ads replication. what: 49 presidential ads in 59 experiments; emotion appeals tested. where: `curated/coppock2020/`, `raw/emotional-ads/`. status: hold. note: converted, unused.
- `i-memorability` Memorability sets. what: LaMem 60,000 images, Memento10k and VideoMem 10,000 clips each, scored by memory games; ResMem pretrained predictor. where: none. license: academic, free. status: lack.
- `i-persuasion-labels` Persuasion labels on PAX2 videos. what: survey experiments on 10 to 20% of takes. where: none. status: lack.
- `i-reactions` Human reaction data. what: memory-game or panel reactions to PAX2 videos. where: none. status: lack.
- `i-usage` Platform usage events. what: open, play, finish, search, boost, bookmark per reader. where: none. status: lack. note: requirement 11.
- `i-public-shortvideo` Public short-video interaction logs. what: KuaiRec and KuaiRand fully observed user-video matrices with watch ratio; MicroLens raw videos with interactions. where: none. license: research. status: lack. note: retention-like labels from another platform, for pretraining.

Steps:
- `s-training-set` Assemble the training set. does: one row per settled short with raw inputs, pre-publish features, outcome and content where present. tool: `scripts/training-set.mjs`. status: done. owner: PAX2.
- `s-encode-images` Encode thumbnails and first frames. does: CLIP or ViT embeddings plus a ResMem memorability score per image. tool: laptop or the NSR rig. cost: cents. status: planned.
- `s-encode-audio` Transcribe and encode audio. does: Whisper transcripts and audio embeddings; CPC pretraining on unlabeled shorts. tool: NSR rig. status: planned.
- `s-download` Download and analyze thousands of shorts. does: yt-dlp from the Mac, content features on the rig. tool: `scripts/yt-download.mjs`, `worker/analyze_organic.py`. cost: about 4 cents a video on Pegasus, near zero with local encoders. status: planned. owner: Brendan for the download.
- `s-velocity-features` Join velocity curves. does: views at 1, 6, 24 and 72 hours as columns. tool: new script over the S3 readings. status: planned.
- `s-classifier-v0` Train the metadata classifier. does: L2 logistic regression, leave-one-channel-out. tool: `scripts/train-breakout.py`. status: done. note: within-channel AUC 0.55.
- `s-classifier-v1` Train the content classifier. does: a head on image, audio and text embeddings plus metadata and early-curve features. tool: NSR rig. status: planned.
- `s-encoder` Train the contrastive encoder. does: scripts and transcripts into one space, positives from shared outcome tier within a channel. tool: `/Code/nsr/scripts/train-nsr` pattern, FlagEmbedding. status: planned.
- `s-reranker` Train the reranker. does: cross-encoder over the encoder's candidates. tool: `/Code/nsr/scripts/rerank-nsr` pattern. status: planned.
- `s-benchmark` Freeze the benchmark and gates. does: held-out channels and a time split; pre-registered thresholds every version must beat. tool: `scripts/eval` pattern from NSR. status: planned.
- `s-serve` Serve. does: `forecast()` in the app today; the encoder behind a TEI box or a Hugging Face endpoint later. tool: `src/lib/forecast.ts`. status: running.
- `s-publish` Publish. does: dataset, models and cards to Hugging Face under NYSgpt, private. tool: NSR's publish rig. status: planned.
- `s-persuasion-experiment` Run the persuasion experiment. does: a survey experiment on a fraction of takes. tool: Prolific or in-app. status: planned. owner: Brendan.

Models:
- `m-encoder` Encoder. kind: encoder. definition: a contrastive bi-encoder that embeds scripts, transcripts and frames into one vector space. status: planned.
- `m-reranker` Reranker. kind: reranker. definition: a cross-encoder that rescores candidate pairs. status: planned.
- `m-classifier` Classifier. kind: classifier. definition: a calibrated predictor of breakout and expected ratio. status: exists. where: `data/generated/model/breakout-model.json`. metrics: LOCO AUC 0.60, within-channel 0.55, top decile 1.4x.
- `m-cpc` Audio and video encoder. kind: cpc. definition: self-supervised representations of delivery from unlabeled shorts. status: planned.
- `m-ranker` Feed ranker. kind: ranker. definition: learning-to-rank over usage events. status: planned.
- `m-writer` Writer. kind: writer. definition: a retrieval-grounded language model that drafts and edits scripts. status: exists. where: `src/app/actions.ts writeScript`. note: Claude on Bedrock today.

Outputs:
- `o-forecast` Pre-flight forecast. surface: the Scored tab on `/v/<id>` and the findings email. status: planned.
- `o-advice` Distribution advice. surface: the Scored tab. status: planned.
- `o-comps` Comps by likeness. surface: the video page's Comps block and the Similar chip on /graph. status: planned.
- `o-feed` Per-reader feed. surface: `/`. status: planned.
- `o-cards` Dataset and model cards. surface: Hugging Face, NYSgpt. status: planned.

Edges, as `[source, target]`:
`i-catalog→s-training-set`, `i-meta→s-training-set`, `i-content→s-training-set`, `i-paid→s-training-set`, `i-thumbs→s-encode-images`, `i-memorability→s-encode-images`, `i-videos→s-encode-audio`, `i-public-shortvideo→s-encode-audio`, `i-videos→s-download`, `i-velocity→s-velocity-features`, `s-training-set→s-classifier-v0`, `s-training-set→s-classifier-v1`, `s-encode-images→s-classifier-v1`, `s-encode-audio→s-classifier-v1`, `s-velocity-features→s-classifier-v1`, `i-analytics→s-classifier-v1`, `s-download→s-encode-images`, `s-download→s-encode-audio`, `i-content→s-encoder`, `s-training-set→s-encoder`, `s-encoder→s-reranker`, `i-swayable→m-writer`, `i-upworthy→m-writer`, `i-coppock→m-classifier`, `i-persuasion-labels→s-classifier-v1`, `i-reactions→s-classifier-v1`, `i-usage→m-ranker`, `s-classifier-v0→m-classifier`, `s-classifier-v1→m-classifier`, `s-encoder→m-encoder`, `s-reranker→m-reranker`, `s-encode-audio→m-cpc`, `s-benchmark→m-classifier`, `s-benchmark→m-encoder`, `s-benchmark→m-reranker`, `m-classifier→s-serve`, `m-encoder→s-serve`, `s-serve→o-forecast`, `s-serve→o-advice`, `m-encoder→o-comps`, `m-reranker→o-comps`, `m-ranker→o-feed`, `m-writer→o-forecast`, `s-publish→o-cards`, `m-classifier→s-publish`, `m-encoder→s-publish`, `s-persuasion-experiment→i-persuasion-labels`.

The arrow in that list is notation for this document only. Nothing in the UI shows the character.

B7. **Persistence.** Recipes save through the same `saveCanvas` as views; `kind` resolves to `"recipe"` when the state holds any recipe node. `listCanvases()` returns recipes only to admins. Loading a recipe switches the canvas to Recipes mode.

B8. **The Recipes rail.** Two entries: Templates (the constants) and Saved recipes (from the ledger). Each row: name, node count, saver and date.

## Commits

- One commit per part at least: A1 to A9, A10 to A13, A14 to A18, B. Commit subjects in this repository's style: one sentence in prose saying what changed, no prefixes. Do not push.
- File-scoped type checks on every changed file before each commit, as described under house rules.
- When done, tell Brendan what was built and what was left out, in a few lines, in the window. No report file.
