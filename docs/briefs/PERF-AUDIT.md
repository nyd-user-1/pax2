# Performance audit — page speed, load, and what each page ships

Audit only: find, measure, rank. **Change no source file.** Append everything to the Report at the bottom of this file. Commit this file alone by explicit path (`git commit -m "..." -- docs/briefs/PERF-AUDIT.md`); do not push. Brendan demos the app on 2026-10-23, so the ranking favors fixes that are safe before a demo.

## House rules

- No local builds, no dev server, no full-project `tsc` or `eslint` — the hooks block them and this 8 GB Mac can't take them. Measure the live site and read the code.
- Never quote a number you did not measure; mark estimates as estimates.
- Name the real service (Amplify, S3, DynamoDB, Bedrock, CloudFront).
- Another window may be editing the tree. Touch nothing but this file.

## Ground truth to start from

- Live: `https://pax.nysgpt.com` (Amplify app `d19l6hnxwmfb25`, branch `main`). Next.js 16.2.6 with Turbopack, every route dynamic (`ƒ`), 135 `"use client"` files.
- Build logs: `aws amplify get-job --app-id d19l6hnxwmfb25 --branch-name main --job-id <n>` → the BUILD step's `logUrl`. Build 32: `BUNDLE server=87M standalone=123M next=223M` against Amplify's 220 MB cap.
- `docs/S3-AUDIT.md` covers build size and data placement. Do not repeat it; cite it where a finding touches it.
- Sign-in pages need a session. If you can't sign in headlessly, measure the public pages and read the code for the rest; say which were measured and which were read.

## Measure

1. **Server response per route:** `curl -w` time to first byte and total, 5 runs each, cold (first hit) and warm, for every page route in the build log's route table. Name the slowest ten.
2. **Page weight:** for the main pages (home, feed, a video page `/v/<id>`, chat, studio, library, dashboard, outliers): HTML size, JS chunks requested and their total, images, fonts. Use Google's PageSpeed Insights API (`https://www.googleapis.com/pagespeedinsights/v5/runPagespeed?url=…&strategy=mobile` and `desktop`) for LCP, TBT, CLS and its opportunities; it runs on Google's machines, not this Mac.
3. **What the server does per request:** for the slowest routes, trace the code — DynamoDB calls (serial vs `Promise.all`, scans vs queries), S3 reads, Bedrock calls on the render path, JSON parsed per request instead of cached per server, missing `cache`/`revalidate` on data that changes daily.
4. **Client cost:** heavy libraries pulled into client components (xyflow, chart libraries, the AWS SDK, markdown and syntax renderers, anything over ~50 kB), `"use client"` at layout level dragging whole trees to the browser, components that could be server-only, missing `next/dynamic` on below-the-fold or modal-only UI.
5. **Images and media:** YouTube thumbnails loaded at full size, no `loading="lazy"`, no width/height (layout shift), autoplaying video.
6. **Dependencies:** the largest packages in `package.json` by installed size and whether the server or the browser uses them; unused dependencies.

## Report format (append below)

1. One table, ranked by user-visible gain per hour of work: finding · evidence (measured number or file:line) · fix · effort · risk · safe before the demo (yes/no).
2. The slowest ten routes with their measured times.
3. The five fixes you would do tonight, and the ones to leave until after the demo.

Report progress by appending a dated line under the Report heading at each finished step so the lead can follow along.

## Report

- 2026-10-23 · Step 1 done: 61 page routes timed signed-out (6 runs each, first counted as cold). Signed-in-only pages return the 58 KB shell when signed out, so their numbers time the shell, not the page; those pages were read in code.
- 2026-10-23 · Step 2: PageSpeed Insights unavailable. The keyless daily quota was exhausted (HTTP 429), and the PageSpeed API is disabled on both Google projects whose keys are in `.env.local` (403). LCP/TBT/CLS are therefore **not measured**. Page weight was measured directly instead (HTML plus every referenced JS/CSS/font/image, brotli transfer and raw sizes).
- 2026-10-23 · Step 3 done: server work traced for the slow routes. One cache-miss reload measured directly (`/channels` 6.53 s, then 0.32 s).
- 2026-10-23 · Steps 4–6 done: client chunks fetched and matched to libraries; images and response headers checked; dependencies sized from `node_modules`.

### Method and limits

- Measured from this Mac against `https://pax.nysgpt.com`, signed out, 2026-10-23 between 23:05 and 00:10 ET, on build 32. Each route got 6 requests with a cache-busting query; the first is reported as "first", the median of the other 5 as "warm".
- I could not force a cold Amplify compute instance. The two genuinely cold hits I observed were the session's first requests: `/` at **9.25 s** TTFB and `/home` at **6.80 s**.
- Signed-in-only pages (dashboard, metrics, studio, library, outliers and others) return the 58 KB shell when signed out. Their server work was read in code, not timed. No demo password is stored, and I did not alter a Cognito user to get a session.
- LCP, TBT and CLS were **not measured**: PageSpeed Insights refused the calls (HTTP 429 keyless, 403 on both project keys). Page weight below is measured: HTML plus every JS/CSS/font/image file the HTML references, downloaded with brotli.
- "est." marks an estimate. Every other number was measured.

### 1. Findings, ranked by user-visible gain per hour

| # | Finding | Evidence | Fix | Effort | Risk | Safe before demo |
|---|---|---|---|---|---|---|
| 1 | The patterns data behind `/home`, `/channels`, `/channels/[id]`, `/graph` and `/metrics?tab=patterns` is rebuilt from **63.6 MiB of S3 poll files (16 daily JSONL objects)** whenever its 10-minute per-instance cache lapses. The visitor who hits the lapse waits for the whole download and parse. Concurrent misses each start their own download. | `src/lib/velocity-analytics.ts:61-63`. Measured: `/channels` **6.53 s** at the miss, then 0.32 s and 0.21 s; `/home` **6.80 s** on first hit. | Serve the last result immediately and refresh in the background (stale-while-revalidate); keep the in-flight promise so only one refresh runs; raise the TTL to 30–60 min (the poller writes every 15 min). Later: have the poller Lambda write a precomputed `patterns.json`. | 30 min | Low: data at most one refresh old | yes |
| 2 | `/metrics` opens on the Live tab, which downloads the last 7 days of poll files (**~24 MB** in S3 today) on **every** visit, with no cache. | `src/components/tracking/live.tsx:74` (`recentPolls(7)` uncached). Byte count measured from `aws s3 ls`; latency not measured (signed-in), est. 2–4 s per visit. | Use the same 5-minute cached, de-duplicated read that `allCards()` already uses (`src/app/velocity-actions.ts:41`), shared from `velocity-store.ts`. | 20 min | Low | yes |
| 3 | Cold instances: the first request on a fresh Amplify compute instance pays Lambda start plus loading `feed-index.json` (6.9 MiB from S3) and the other per-server data files. | `/` **9.25 s**, `/home` **6.80 s** on the session's first hits; the same routes warm: 0.26 s and 0.51 s. | Before the demo, open `/`, `/home`, `/channels`, `/metrics` and one `/v/<id>` about 2 minutes ahead. Amplify may run more than one instance, so this lowers the odds but doesn't guarantee a warm one. | 5 min | None | yes |
| 4 | Every page loads **~240 KB compressed (≈800 KB raw)** of JS it rarely needs. The shell's discussion panel imports the chat, which pulls in Remotion's player (`chat/enhance-flow.tsx:10`, 79 KB br) and react-markdown + remark-gfm (72 KB br). `LoadCurtain` in the root layout imports motion (43 KB br) and GSAP via `StrokeText` (46 KB br), yet it renders only on `/`. | The baseline shell page (`/outliers` signed out) loads **519 KB br / 1.72 MB raw** of JS in 28 files. Those six chunks are on `/home`, `/` and `/v` alike. There is **no `next/dynamic` anywhere in `src`**. | `next/dynamic` for the panel's `Chat` (load when the panel opens), for `EnhanceFlow`'s `Player`, and for `LoadCurtain` only when the path is `/`. | 1.5–2 h | Medium: panel open latency, hydration differences | no |
| 5 | The video page waits on three network calls one after another: `currentUser`, then DynamoDB `boostCounts`, then the YouTube comments API (5 s timeout), then the S3 `codebook` (2.5 MiB, cached per server). | `src/components/short-view.tsx:193, 237, 274, 510`. Warm `/v` median 0.31 s; first hit 1.17 s. | Start all four at the top of the component and `await Promise.all`. | 30 min | Low | yes |
| 6 | Static files in `public/` are served with `cache-control: max-age=5`, so repeat visits re-download them. `/home` renders 51 distinct channel logos eagerly (no `loading="lazy"`); they are 240×240 JPEGs up to 40 KB, displayed at 32 px. | Header measured on `/logos/channels/UCbPojIVZdVhfBTRwj64j0Cw.jpg` (CloudFront miss). 69 logos = 915 KB on disk. `src/components/channels-grid.tsx:28` and the card components. | Amplify custom headers: `public, max-age=86400` for `/logos/*`, `/visuals/*`, `/flags/*`. Add `loading="lazy" width height` to logo `<img>`s. Later: resize logos to 64 px. | 30 min headers + lazy; 30 min resize | Low | headers + lazy yes; resize no |
| 7 | `/home` and `/tags` produce very large DOMs. `/tags` is 1.33 MB raw: 169 cards for **40 unique videos** (videos repeat across tag sections), **1,232 inline SVG icons (523 KB)** and 567 KB of class attributes. `/home` is 1.74 MB raw (209 thumbnails, 78 unique videos; 258 logo `<img>`s, 51 unique). | Brotli brings these to **88 KB** (`/home`), so transfer is acceptable; the cost is parse, layout and hydration on the device (not measured; PageSpeed unavailable). | Show the first N cards per tag section with a "more" control; render the `/home` blocks' contents lazily. `content-visibility: auto` on sections is cheaper but interacts with the `/tags#tag-…` anchors. | 1–2 h | Medium | no |
| 8 | Dashboard reads are partly serial: per take, `findings`, then `steps`, then `forecasts` (11 takes); `loads()` queries one dataset at a time; a second `Promise.all` waits for the first. | `src/app/dashboard/page.tsx:39-40, 101`; `src/lib/review.ts:65-69`. Not timed (admin page). Est. 3–5 DynamoDB round trips saved, ~50–150 ms. | `Promise.all` inside the per-take map and in `loads()`; start the line-101 group together with line 39. | 20 min | Low | yes |
| 9 | Recharts adds **~544 KB raw (5 chunks)** to `/dashboard` on top of the shell. | Dashboard-only chunks fetched and fingerprinted (40–52 Recharts references in the two largest). `/dashboard` loads 673 KB br of JS against the shell's 519 KB. | `next/dynamic` for `src/components/dash/charts.tsx` below the fold. | 45 min | Low–medium | no |
| 10 | `feedIndex()` caches a **rejected** promise: if one S3 read of `feed-index.json` fails, `/` and `/videos` fail on that instance until it restarts. This is a reliability risk, not speed. | `src/lib/feed-data.ts:39-41`. `generated-store.ts:31` already clears its cache on failure. | Clear `ALL` on rejection, the same pattern as `generated-store.ts`. | 10 min | Low | yes |
| 11 | `feedFacets()` rebuilds the channel and tag lists over the whole index on every `/`, `/videos` and `/home` request. | `src/lib/feed-data.ts:44-50`. | Memoize next to `ALL`. | 10 min | Low | yes, but gain small |
| 12 | `/` holds a full-screen curtain for 1.6 s and then sweeps it off over about 0.8 s, so the front page cannot show its content earlier than ~2.4 s after hydration. | `src/components/load-curtain.tsx` (`HOLD = 1600`, `SWEEP = 0.6`, `TRAIL = 0.18`). | This is a design decision; I'm noting the cost, not proposing a change. | — | — | — |
| 13 | `zod` is installed (8 MB) but never imported; no runtime cost. Thumbnails use `hqdefault.jpg` (11 KB for one sampled video) where `mqdefault.jpg` (6 KB) may suffice; they are already lazy. Card `<img>`s have no width/height but are sized by CSS boxes, so layout shift is probably small (CLS not measured). | `package.json`; `curl -I` on one i.ytimg.com video. | Remove `zod`; test `mqdefault` after the demo. | 15 min | Low | no (no value tonight) |

Build size and data placement are in `docs/S3-AUDIT.md`. Finding 1's long-term fix (a precomputed file written by the poller Lambda) also belongs in that file's data-placement plan.

### 2. The ten slowest routes (signed out, build 32)

Ranked by warm median TTFB. Times are in seconds; bytes are uncompressed HTML.

| Route | First TTFB | Warm TTFB median (min–max) | Warm total | HTML bytes |
|---|---|---|---|---|
| `/home` | 0.61 | 0.51 (0.47–0.93) | 0.65 | 1,743,162 |
| `/tags` | 1.00 | 0.44 (0.40–0.55) | 1.05 | 1,329,883 |
| `/v/yt--50yfo3yqNg` | 1.17 | 0.31 (0.29–0.51) | 0.41 | 687,521 |
| `/record/library` | 0.45 | 0.29 (0.25–0.35) | 0.37 | 163,776 |
| `/record` | 0.98 | 0.27 (0.24–0.47) | 0.41 | 358,103 |
| `/scripts` | 0.31 | 0.27 (0.25–0.27) | 0.42 | 327,544 |
| `/` | 0.29 | 0.26 (0.24–0.32) | 0.34 | 408,460 |
| `/channels/UCJjSDX-jUChzOEyok9XYRJQ` | 0.23 | 0.24 (0.23–0.56) | 0.30 | 265,600 |
| `/videos` | 0.35 | 0.24 (0.23–0.30) | 0.37 | 372,955 |
| `/chat` | 0.30 | 0.22 (0.21–0.30) | 0.25 | 80,496 |

Separately measured cache-miss and cold hits, which are what a demo audience would notice: `/` **9.25 s**, `/home` **6.80 s**, `/channels` **6.53 s**. Every other route's warm median is under 0.22 s. Full table for all 61 routes: run `time.sh` again to regenerate it (it was kept in the session scratchpad, not the repo).

Page weight (measured, brotli transfer):

| Page | HTML br | JS (files, br / raw) | CSS br | Fonts | Distinct images |
|---|---|---|---|---|---|
| `/home` | 88 KB | 33, 546 KB / 1.81 MB | 35 KB | 50 KB (2) | 78 thumbnails + 51 logos |
| `/` (feed for signed-in readers) | 33 KB | 31, 564 KB / 1.87 MB | 37 KB | 50 KB | 82 `<img>` |
| `/v/<id>` | 108 KB | 31, 553 KB / 1.83 MB | 39 KB | 50 KB | 18 |
| `/chat`, `/library`, `/record/studio`, `/outliers` (shell, signed out) | 9–16 KB | 28–29, 519–526 KB / 1.72–1.74 MB | 35 KB | 50 KB | 0–2 |
| `/dashboard` (shell, signed out) | 9 KB | 33, 673 KB / 2.27 MB | 35 KB | 50 KB | 0 |

### 3. Tonight, and after the demo

Tonight (all code changes go out in **one commit and one build**; builds 30 and 31 failed, so build 32 stays the rollback):

1. **Finding 1:** stale-while-revalidate plus in-flight de-duplication on `patternsData()`. This removes the measured 6.5 s waits on `/home` and `/channels`.
2. **Finding 2:** cache `recentPolls(7)` for `/metrics`.
3. **Finding 5:** parallelize the four awaits in `ShortView`.
4. **Finding 10:** stop `feedIndex()` from caching a failed S3 read (protects `/` during the demo).
5. **Finding 3:** warm `/`, `/home`, `/channels`, `/metrics` and one `/v/<id>` two minutes before the demo, after the build is live.

Findings 8 (dashboard `Promise.all`) and the logo cache headers in 6 are also safe if there is time; both are small gains.

After the demo: finding 4 (dynamic imports out of the shell, the largest client-side gain at ~240 KB br on every page), 7 (`/tags` and `/home` DOM size), 9 (Recharts), the logo resize in 6, the poller writing a precomputed patterns file, `zod` removal, and a PageSpeed run with an API key on a project where the PageSpeed API is enabled, to get LCP/TBT/CLS.

- 2026-10-23 · PageSpeed Insights run on all page routes once a key was available (`PAGESPEED_API_KEY`, restricted to the PageSpeed API, in `.env.local`): 118 runs across 60 routes, mobile and desktop, signed out. 25 routes were sent to `/signin`, so their numbers describe the shell, the redirect and the sign-in page, not the page.

### 4. PageSpeed Insights (Lighthouse lab data, run on Google's machines)

Mobile is Lighthouse's simulated slow 4G and mid-range phone; desktop is unthrottled. Lab LCP on mobile runs well above what a laptop on office Wi-Fi sees. Use it to rank pages, not as the demo experience.

**New findings from these runs**, continuing the numbering of table 1:

| # | Finding | Evidence | Fix | Effort | Risk | Safe before demo |
|---|---|---|---|---|---|---|
| 14 | On `/home` and `/tags` the largest element on screen is the first YouTube thumbnail, and it is marked `loading="lazy"`. The browser therefore discovers and fetches it late. | `/home`: mobile LCP 5.8 s; Lighthouse attributes **~9.0 s of "resource load delay"** to that `<img>` on both mobile and desktop (simulated). `/tags`: ~2.0 s of delay. Lighthouse flags: "LCP resources should not use loading=lazy", "fetchpriority=high should be applied". | Load the first row of cards eagerly with `fetchpriority="high"`; keep `lazy` on the rest. | 15 min | Low | yes |
| 15 | The feed's pinned row renders empty on the server and fills in after hydration from `localStorage`, pushing the whole grid down. | CLS **0.44** on `/record` desktop, **0.35** on `/videos` desktop, **0.23** on `/` mobile; the shifting node is the feed grid (`div.grid … @4xl:grid-cols-3`). Cause: `src/components/record/feed.tsx:246` (`useState<string[]>([])`, set in an effect). | Start `pinned` as the server's default (the e2 ids) so the first paint already contains the row. Returning visitors with custom pins would still shift; a first-time visitor (the demo audience) would not. | 15 min | Low | yes |
| 16 | Signed-out visits to gated pages download the shell, then redirect in the browser to `/signin`, sometimes in two hops (`/patterns`, then `/metrics`, then `/signin`). | 25 routes ended at `/signin`. Lighthouse "Avoid multiple page redirects": **2.25 s** on `/dashboard` mobile. The extreme desktop TBT values (`/my-channels` 8,390 ms, `/lab/1` 6,270 ms, `/signup/welcome` 5,470 ms) are all redirect runs and do not describe those pages. | Redirect signed-out requests for gated paths in `src/proxy.ts` (no session cookie), straight to the final `/signin?next=` URL. | 1 h | Medium: sign-in flow | no (demo is signed in) |
| 17 | Even light pages have a mobile LCP floor of 3.9–4.2 s. Lighthouse's "Reduce unused JavaScript" is the top suggestion on every page (600–910 ms mobile). | `/record/studio` mobile: Remotion chunk **49 KB of 58 KB unused**, motion chunk **37 KB of 41 KB unused**. | Same as finding 4 (dynamic imports out of the shell). | — | — | no |
| 18 | `/v/<id>` shifts: CLS 0.32 mobile, 0.33 desktop. On desktop the shifting node is `main` itself; on mobile most of it (0.28) is the `<video>`'s native controls. | PageSpeed layout-shift audit. I did not isolate the desktop cause; the sign-up overlay is fixed-position and ruled out. | Investigate after the demo. | 1 h | — | no |

Add findings **14** and **15** to tonight's list: each is about 15 minutes and both are visible to a first-time visitor.

**All routes**, sorted with the real (not redirected) pages first, lowest mobile score first. LCP and TBT are rounded; CLS above 0.1 is poor.

| Route | Mobile: score · LCP · TBT · CLS | Desktop: score · LCP · TBT · CLS |
|---|---|---|
| `/v/yt--50yfo3yqNg` | 53 · 6.2 s · 50 ms · 0.32 | 75 · 1.2 s · 80 ms · 0.33 |
| `/` | 56 · 5.0 s · 280 ms · 0.23 | 84 · 0.9 s · 210 ms · 0.00 |
| `/viometrics` | 56 · 6.2 s · 720 ms · 0.04 | 72 · 0.7 s · 650 ms · 0.02 |
| `/chat` | 59 · 7.0 s · 620 ms · 0.04 | 97 · 1.2 s · 30 ms · 0.02 |
| `/tags` | 60 · 5.2 s · 630 ms · 0.04 | 61 · 1.2 s · 1,990 ms · 0.02 |
| `/learn/ranker` | 64 · 4.4 s · 630 ms · 0.04 | 100 · 0.8 s · 10 ms · 0.02 |
| `/home` | 68 · 5.8 s · 90 ms · 0.04 | 57 · 1.4 s · 1,020 ms · 0.02 |
| `/signup` | 68 · 4.1 s · 710 ms · 0.00 | 77 · 0.8 s · 450 ms · 0.00 |
| `/channels` | 71 · 5.9 s · 180 ms · 0.00 | 99 · 0.9 s · 20 ms · 0.02 |
| `/recording` | 74 · 4.2 s · 430 ms · 0.04 | 100 · 0.8 s · 20 ms · 0.02 |
| `/drafts` | 74 · 6.9 s · 70 ms · 0.08 | 97 · 1.2 s · 0 ms · 0.05 |
| `/publishing` | 74 · 6.8 s · 100 ms · 0.08 | 93 · 1.2 s · 160 ms · 0.05 |
| `/scored` | 74 · 6.8 s · 90 ms · 0.08 | 92 · 1.2 s · 180 ms · 0.05 |
| `/scoring` | 75 · 6.9 s · 10 ms · 0.08 | 97 · 1.2 s · 60 ms · 0.05 |
| `/labeling` | 75 · 6.9 s · 0 ms · 0.08 | 96 · 1.3 s · 100 ms · 0.05 |
| `/videos` | 76 · 5.5 s · 40 ms · 0.04 | 79 · 1.2 s · 60 ms · 0.35 |
| `/record/start` | 76 · 7.0 s · 90 ms · 0.04 | 97 · 1.2 s · 60 ms · 0.05 |
| `/record` | 76 · 5.9 s · 60 ms · 0.00 | 76 · 1.2 s · 20 ms · 0.44 |
| `/channels/UCJjSDX-jUChzOEyok9XYRJQ` | 77 · 4.7 s · 140 ms · 0.00 | 99 · 0.9 s · 60 ms · 0.02 |
| `/glossary` | 78 · 4.5 s · 150 ms · 0.00 | 99 · 0.9 s · 50 ms · 0.02 |
| `/record/personal` | 81 · 4.2 s · 110 ms · 0.00 | 100 · 0.8 s · 60 ms · 0.02 |
| `/learn` | 81 · 4.2 s · 70 ms · 0.00 | 99 · 0.9 s · 50 ms · 0.02 |
| `/my-videos` | 83 · 4.1 s · 200 ms · 0.04 | 100 · 0.8 s · 40 ms · 0.03 |
| `/record/library` | 84 · 4.1 s · 150 ms · 0.04 | 99 · 0.9 s · 60 ms · 0.02 |
| `/scripts` | 84 · 4.4 s · 80 ms · 0.04 | 97 · 0.8 s · 130 ms · 0.02 |
| `/signin` | 85 · 4.1 s · 120 ms · 0.00 | 67 · 1.0 s · 730 ms · 0.00 |
| `/privacy` | 85 · 4.1 s · 160 ms · 0.04 | 100 · 0.8 s · 30 ms · 0.02 |
| `/library` | 86 · 4.1 s · 60 ms · 0.04 | 99 · 0.9 s · 60 ms · 0.02 |
| `/record/guide` | 86 · 3.9 s · 150 ms · 0.04 | 100 · 0.8 s · 40 ms · 0.02 |
| `/library/swayable-archive` | 86 · 4.1 s · 80 ms · 0.04 | 100 · 0.8 s · 0 ms · 0.02 |
| `/record/studio` | 87 · 4.1 s · 0 ms · 0.04 | 100 · 0.8 s · 10 ms · 0.03 |
| `/record/camera` | 87 · 3.9 s · 90 ms · 0.05 | 100 · 0.8 s · 0 ms · 0.03 |
| `/learn/classifier` | 87 · 3.9 s · 100 ms · 0.04 | 100 · 0.8 s · 50 ms · 0.03 |
| `/learn/classifier/finish` | 88 · 3.9 s · 20 ms · 0.04 | 100 · 0.8 s · 40 ms · 0.03 |
| `/record/script` | 94 · 2.7 s · 50 ms · 0.09 | 99 · 0.8 s · 40 ms · 0.05 |
| `/tracking` (sent to sign-in) | 35 · 10.1 s · 4,510 ms · 0.08 | 60 · 1.8 s · 750 ms · 0.05 |
| `/scoring/method` (sent to sign-in) | 38 · 9.9 s · 3,520 ms · 0.04 | 88 · 1.8 s · 120 ms · 0.05 |
| `/live-tracking` (sent to sign-in) | 38 · 9.9 s · 3,180 ms · 0.04 | 59 · 1.8 s · 790 ms · 0.05 |
| `/feature-lift` (sent to sign-in) | 39 · 9.9 s · 2,480 ms · 0.04 | 84 · 1.8 s · 160 ms · 0.05 |
| `/ml` (sent to sign-in) | 39 · 10.1 s · 2,620 ms · 0.04 | 60 · 1.7 s · 790 ms · 0.05 |
| `/project-management` (sent to sign-in) | 45 · 7.0 s · 1,910 ms · 0.00 | 61 · 1.5 s · 890 ms · 0.02 |
| `/patterns` (sent to sign-in) | 45 · 9.9 s · 990 ms · 0.08 | 61 · 1.8 s · 640 ms · 0.05 |
| `/evidence` (sent to sign-in) | 46 · 10.0 s · 850 ms · 0.08 | 71 · 1.8 s · 390 ms · 0.05 |
| `/build` (sent to sign-in) | 49 · 6.9 s · 1,200 ms · 0.00 | 90 · 1.3 s · 180 ms · 0.02 |
| `/flow` (sent to sign-in) | 52 · 9.8 s · 720 ms · 0.00 | 86 · 1.7 s · 160 ms · 0.05 |
| `/my-channels` (sent to sign-in) | 53 · 6.9 s · 860 ms · 0.00 | 57 · 1.3 s · 8,390 ms · 0.02 |
| `/signup/welcome` (sent to sign-in) | 56 · 6.9 s · 680 ms · 0.00 | 58 · 1.2 s · 5,470 ms · 0.00 |
| `/lab/1` (sent to sign-in) | 57 · 7.1 s · 650 ms · 0.04 | 57 · 1.4 s · 6,270 ms · 0.02 |
| `/metrics` (sent to sign-in) | 57 · 7.2 s · 600 ms · 0.04 | 93 · 1.2 s · 140 ms · 0.02 |
| `/graph` (sent to sign-in) | 61 · 7.2 s · 440 ms · 0.04 | 95 · 1.2 s · 70 ms · 0.02 |
| `/velocity-tracker` (sent to sign-in) | 64 · 9.9 s · 240 ms · 0.08 | 57 · 2.0 s · 850 ms · 0.05 |
| `/polling` (sent to sign-in) | 65 · 10.1 s · 170 ms · 0.08 | 87 · 1.7 s · 130 ms · 0.05 |
| `/evals` (sent to sign-in) | 68 · 6.9 s · 270 ms · 0.04 | 93 · 1.3 s · 120 ms · 0.02 |
| `/dashboard` (sent to sign-in) | 69 · 6.9 s · 240 ms · 0.04 | 71 · 1.2 s · 510 ms · 0.02 |
| `/reinforcement-learning` (sent to sign-in) | 70 · 6.9 s · 200 ms · 0.04 | 87 · 1.2 s · 210 ms · 0.02 |
| `/campaigns` (sent to sign-in) | 71 · 7.1 s · 180 ms · 0.04 | 89 · 1.3 s · 160 ms · 0.02 |
| `/pipeline-2` (sent to sign-in) | 72 · 7.1 s · 140 ms · 0.04 | 67 · 1.5 s · 590 ms · 0.02 |
| `/pipeline` (sent to sign-in) | 73 · 6.9 s · 80 ms · 0.04 | 62 · 1.2 s · 1,290 ms · 0.02 |
| `/outliers` (sent to sign-in) | — | 63 · 1.8 s · 600 ms · 0.05 |
| `/app/home` (sent to sign-in) | — | 63 · 1.2 s · 1,070 ms · 0.02 |

After the demo, separately: PAX2's `YOUTUBE_API_KEY` belongs to the **govblocks** Google Cloud project (`govblocks-507405`). The two products share one YouTube quota, and a key change made for govblocks would break PAX2's YouTube calls. Create a YouTube key in the `pax2` project and swap it into `.env.local` and Amplify.
