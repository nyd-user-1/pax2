# Brief: self-serve onboarding with YouTube channel connect

You are taking over PAX2's onboarding-and-channel-connect lane. Repo: `/Users/brendanstanton/Code/pax2` (Next.js 16 App Router, Tailwind v4, Cognito auth, DynamoDB + S3 + SSM in us-east-1, deployed by Amplify app pax-2 / d19l6hnxwmfb25 on push to main). Begin work immediately — this brief is Brendan's approval; build in the order below without waiting. Never push; Brendan owns the push. Local dev servers and builds are banned by a hook; Brendan's express instruction is the only override (`BRENDAN_OK_LOCAL_BUILD=1` prefix as the audit trail). Verify with `npm run typecheck`.

## The goal

A self-serve sign-up where any end user connects their YouTube channel(s), agrees to share video analytics for analysis, and gets back a thorough analysis of every video on the channel. Brendan tests it himself: fresh sign-up, Google sign-in as brendan.stanton@gmail.com, connecting its two channel identities (@irishgw and @booksforbedtime3655) in two passes through Google's account/brand chooser. Expect Google's "unverified app" interstitial (Advanced, continue) — normal; the consent screen is published to production but unverified.

## Scope, in build order

### 1. Per-user, per-channel grant storage (the foundation)

Today `src/lib/youtube.ts` stores ONE refresh token at SSM `/pax2/youtube/refresh-token` and one channel row; a second grant would overwrite the app's own publish channel (channel PAX, UCXQimTA5x32Ne9fvyJEYK1g). Re-key: one SecureString per channel (`/pax2/youtube/refresh-token/<channelId>`), a pointer parameter naming the publish channel, and DynamoDB channel rows keyed per owner (user email) per channelId.

HARD CONSTRAINT: `channel()` and `uploadShort({key,title,description,publishAt})` in `src/lib/youtube.ts` keep their signatures, resolving to the publish channel — the approve-and-publish loop and pax2-lead-3's headless driver (`scripts/pipeline-proxy/run.ts`) depend on them and must keep working unmodified. Only `src/lib/youtube.ts` touches the token/channel stores; its complete importer list: `src/app/api/youtube/oauth/route.ts`, `src/app/original-actions.ts`, `src/components/originals-queue.tsx`, `scripts/pipeline-proxy/run.ts`. No Lambda reads tokens (the velocity poller uses a plain `YOUTUBE_API_KEY` against the public Data API — leave it alone).

The oauth route today requires an admin; change to any signed-in user (keep the `state`=email check). End-user grants request ONLY `youtube.readonly` + `yt-analytics.readonly` (no upload scope) through the EXISTING OAuth client (`PAX2_GOOGLE_CLIENT_ID`/`SECRET`, already in Amplify env and `.env.local`; scopes are per-authorization, so no new client for v1 — a separate read-only client is later verification hygiene). An end-user grant must never become the publish identity. The admin publish grant keeps today's full scopes.

### 2. The onboarding stepper

Modeled on ElevenLabs' app onboarding (clean centered steps, dot progress rail at the bottom, back chevron, Skip on optional steps), in PAX2's visual language. Entry: after account creation at /signup.

- **Step 1 — About you.** Name, role, town (the record flow's messenger fields), how they heard of PAX (optional).
- **Step 2 — What do you make.** Shorts/Reels, longer videos, scripts without a camera.
- **Step 3 — What do you want from PAX.** Tile grid of real functions: Record, Studio, Score my videos, Publish, Track performance, Write scripts. Store answers on the user.
- **Step 4 — Connect your YouTube channel.** The keystone. Plain copy: connecting shares the channel's video analytics for analysis; PAX returns a complete analysis of every video. Connect runs the grant; on return show the channel chip and offer "Connect another channel" (loops straight back to Google's chooser — one identity per pass is Google's rule, there is no all-channels-at-once consent). Skippable. ALSO on this step (or 4b): **Upload your videos** — a direct uploader for their files. Files land via the existing presigned-PUT path (`uploadUrl` in `src/app/actions.ts`) under `uploads/` in S3, which auto-fires the analysis chain (`lambda/analyze` on ObjectCreated `uploads/*.mp4` runs `scripts/rig/analyze_upload.py`, ~4 min/video, self-terminating c7i.large) — full content analysis with no new ML wiring. Let the user associate an uploaded file with one of their enumerated YouTube videos (match on youtubeId) so content analysis joins analytics.
- **Step 5 — Done.** Land on /app/home.

### 3. Connect-triggered ingestion (Tier 1, no video files needed)

On grant: enumerate every upload on the channel (playlistItems.list pages at ~1 unit, videos.list ~1 unit per 50 ids — effectively free); store per-video metadata; pull the private YouTube Analytics API per video — retention curves, impressions, CTR, average view duration, watch time. Analytics ingestion is greenfield: nothing in the repo reads that API yet. Store it keyed on youtubeId in a form the training-set builder can join (`scripts/velocity-features.mjs` joins on youtubeId today; the PAX2 Retention Regressor's fine-tune is explicitly waiting on this data — coordinate the stored shape with pax2-lead-3). Score each video with PAX2 Classifier v1 (`src/lib/forecast.ts`, metadata-only, needs no file), anchored to a median computed from the channel's own enumerated catalog; handle the tiny-channel case (few or zero settled videos — no median, no anchor) without nonsense numbers.

The user-facing result: their channel and videos appear in the app with performance analysis plus the metadata score immediately; content analysis appears per video as files exist (their uploads via step 4). Copy must say plainly which tier each video has.

### 4. The shape of Tier 2 (build the seam, not the fleet)

Content analysis of videos the user did NOT upload requires acquiring public video files. YouTube refuses all AWS IPs (re-measured 2026-10-19: 0 of 24 from a t3.micro), so acquisition rides residential IPs — today a fetcher on Brendan's Mac (`scripts/catalog-media/fetch-videos.sh`, ~3.5/min), later a small fleet behind dedicated residential proxies (purchase pending; Brendan delivers proxy IPs when ready). Your job now: a fetch-targets queue (youtubeId + channelId + requesting user, deduplicated) that connected channels' videos enter, and a documented worker interface the proxy fleet will consume. Do not build the fleet. Also note the sanctioned alternative for owners: YouTube Studio / Google Takeout bulk download, walked through in onboarding copy, feeding the step-4 uploader.

## Quota facts

Catalog enumeration is effectively free. `videos.insert` costs ~1,600 units (about 6 uploads/day on the project's default 10,000-unit Data API quota) — binds publish volume, irrelevant to onboarding reads. The Analytics API quota is separate. Unverified consent screen: 100 sensitive-scope grants lifetime cap — fine for testing; Google app verification becomes a real task before outside users onboard.

## House rules (non-negotiable)

- `AGENTS.md`: no explainer paragraph under any h1 or section heading; never the "→" character in UI.
- Blocks: any titled card is the MainBlock family (`src/components/blocks.tsx`) and any stack of two or more gets BlockOrder/OrderedBlock (`src/components/dash/block-order.tsx`). Never a bare surface div with a heading.
- App voice is third person; the product never says "I" and never names the model. Name real services (DynamoDB, S3, SSM, Amazon SES, Bedrock) — never house words. Model names per `docs/SPEC.md` ("PAX2 Classifier", never nicknames).
- Responsive in code; no browser testing — Brendan checks local dev himself.
- The word "concrete" is banned in all output.
- Keep work uncommitted unless Brendan says otherwise; when he directs a commit, stage by explicit pathspec and name the paths in the message.

## Boundaries — two other sessions work this repo

- **pax2-lead-3** (model/training lane): do not touch `scripts/**`, `docs/LEAD-LOOP.md`, `docs/HANDOFF-*`, `src/lib/recipes/memorable.ts`, `src/lib/project-management.ts`. It keeps requirement status lines in `docs/SPEC.md` current; draft your onboarding sections freely and message it when they land so you don't cross-edit. A detached downloader (fetch-videos.sh) runs on this Mac — leave it alone.
- **model-training** (the window that wrote this brief): has UNCOMMITTED work in the tree — `src/app/app/home/*`, `src/components/home/*`, `src/lib/studio-presets.ts`, `src/components/chat/chat.tsx`, `src/components/shell.tsx`, `src/app/record/studio/page.tsx`, `src/app/signin/page.tsx`, `src/components/pax-mark.tsx`, `src/components/original-view.tsx`, `src/components/original-admin.tsx`, `src/components/dash/card-tools.tsx`, `src/app/v/[id]/page.tsx`, `src/app/project-management/page.tsx`, `src/components/punchlist.tsx`. Do not revert, reformat, or absorb those changes. The signup/onboarding surfaces are yours; if you must touch a listed file, message model-training first.
- Coordinate over SendMessage to `pax2-lead-3` and `model-training`.

## Working style

Begin immediately and build in the order above; no plan-approval round. Interrupt Brendan only for decisions that are genuinely his (destructive actions, console clicks, scope changes). Typecheck as you go; report plainly what is done versus open. When storage (piece 1) lands, verify the publish loop still works before moving on, and message pax2-lead-3 so it can confirm its driver.
