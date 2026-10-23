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
