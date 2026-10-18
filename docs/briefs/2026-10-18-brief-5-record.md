# Brief 5: Requirement 1, Record a video, or have one made

Written 2026-10-18 by the lead window for an executing window. Brendan has authorized the AWS spend and infrastructure in this brief and nothing beyond it: one Lambda with an ffmpeg layer and its S3 trigger, one t3.small box to build the layer if no clean build exists, and Remotion Lambda's own stack if Part B uses it. Ceiling $3 for the night. Every box self-terminates. Do not spawn subagents. Do not push. Stage by explicit pathspec; other windows commit to this tree.

## Read first

`AGENTS.md`, `/Users/brendanstanton/.claude/CLAUDE.md`, `docs/SPEC.md` (requirement 1), `docs/briefs/RIG-RULES.md` in full, `docs/HANDOFF-2026-10-18.md` (the hooks section), `src/app/actions.ts` (the presigned upload at `uploads/<workspace>/<id>.<ext>`, `submitTake`), `src/app/original-actions.ts` (`submitOriginal`, `score`), `src/lib/originals.ts` (the DynamoDB table `pax2-ledger`, `addEvent`), `src/components/original-view.tsx` (how an upload plays), `src/app/record/camera/page.tsx`, `src/app/record/studio/page.tsx`, `lambda/velocity/index.mjs` (the one Lambda that exists, as the pattern), `scripts/encoder/launch.sh` and `scripts/rig/launch-cpu.sh` (the box launcher pattern).

Names: the real service every time, DynamoDB, S3, Lambda, EC2, Bedrock. Models are "PAX2 <kind>". App copy is third person.

## What stands

Recording and upload work: the browser records webm, it goes straight to S3 by presigned URL, a record is written to the DynamoDB table, and the prediction runs on submit. Missing: nothing converts the webm, the Studio previews a Remotion animation but renders no file, and `submitTake` records a style name where a video key belongs.

## Part A: webm to mp4 on upload

A1. `lambda/transcode/index.mjs`: on an S3 `ObjectCreated` event under `uploads/` whose key ends in `.webm`, download to `/tmp`, run ffmpeg (`-c:v libx264 -preset veryfast -crf 23 -c:a aac -movflags +faststart`), upload `<same key>.mp4` beside it with `ContentType video/mp4`, and record an event on the original: `addEvent`'s shape, `{ kind: "transcoded", key, seconds, bytes }`, written with the same `putOnce` rule the app uses (copy the item shape from `src/lib/originals.ts`; the Lambda cannot import the app). Skip keys that already have an mp4. Log one JSON line per run with the exit code.

A2. The ffmpeg layer. First look for an existing layer in the account (`aws lambda list-layers --region us-east-1`). If none, build one on a t3.small box with a watchdog `shutdown -h +20` as its first line: download the static build from johnvansickle.com (amd64), zip `bin/ffmpeg` as a layer, publish it with `aws lambda publish-layer-version`, upload the zip to `s3://pax-2-638175140432/lambda/layers/`, shut down. Script it end to end in `scripts/transcode/build-layer.sh`; nothing by hand.

A3. `scripts/transcode/deploy.sh`: zip the function, create or update `pax2-transcode` (Node 22, 2048 MB, 300 s timeout, ephemeral storage 2048 MB, the execution role with S3 read and write on the bucket and DynamoDB `PutItem` on `pax2-ledger`), attach the layer, add the S3 notification for the `uploads/` prefix and `.webm` suffix. Print every resource it made. Dry run by default; `--apply` writes.

A4. Test it with one small webm uploaded to `uploads/test/` through the deploy script's `--test` flag, wait for the mp4, read the CloudWatch log, then delete both test objects. Measure the duration and bill it in the report.

A5. The video page plays the mp4 when it exists, the webm until then; the `transcoded` event shows in the original's history.

## Part B: the Studio renders a file

B1. Read the Studio page and its Remotion composition. Decide between two routes and say which in the commit: Remotion Lambda (`@remotion/lambda`, their documented deploy, renders in their Lambda, cents per render) or `@remotion/renderer` on the transcode Lambda with a Chromium layer. Prefer Remotion Lambda. If deploying it exceeds two hours of work, stop Part B, leave the Studio as it is, and say so in the report.

B2. "Use this take" renders the composition to mp4, uploads it to `uploads/<workspace>/<id>.mp4`, and submits it through `submitOriginal` like a recording, so the prediction runs on it.

## Part C: submitTake

C1. `submitTake` records the video's key in the DynamoDB table, not a style name; the style goes in a `style` field.

## Report

Commit per part, subjects in this repository's prose style, file-scoped type checks before each (copy the files to the scratchpad, rewrite `@/` imports, compile with `--outDir`; full-project `tsc` and `eslint` are blocked by hooks, and so are the local dev server and local builds). When done, tell Brendan in a few lines what was built, what it cost from measured run times, what was left out, and how you ruled anything the brief left open. Then update `docs/SPEC.md` requirement 1's status line and the `s-download`, `i-videos` and requirement 1 entries in `src/lib/recipes/memorable.ts` and `src/lib/project-management.ts` to what is true.
