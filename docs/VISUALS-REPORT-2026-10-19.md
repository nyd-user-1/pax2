# Generated visuals for the no-camera path: what was tested, what it costs, what it waits on

2026-10-19. The /visuals page was unpublished the same day at Brendan's order; this report carries its findings. The machinery stays: `scripts/visuals/demo.mjs` (plan, fetch, generate, start video jobs; `--collect` pulls finished clips), the manifest at `data/generated/visuals/demo.json`, the fetched stills under `public/visuals/`, and the page's last code at commit e3210e6.

## What was built and what it showed

The script cuts a library script ("Uncontested") into a five-shot b-roll list with Claude on Bedrock — each shot carrying the script line it sits under, a stock-search query, and a generation prompt — then fills two arms per shot: a stock photo and a generated image, intended to sit side by side under the renderer's Ken Burns pan. Four of five stock pulls landed. The generated arms are blocked by quota (below), so the quality comparison Brendan asked for has not happened yet; one rerun fills it once either unblock lands.

## Measured on the AWS account, 2026-10-19

- Amazon's own image and video models (Nova Canvas, Nova Reel) are **end of life** on Bedrock. The account's generation options on Bedrock today are Stability (images) and Luma Ray 2 (video), both served from us-west-2.
- Stability Image Ultra and Luma Ray 2 are **authorized** (marketplace agreement in place, entitlement available) but the applied quotas are **zero**: 0 of the default 10 requests a minute for Ultra, 0 of the default 1 concurrent job for Ray 2, 0 of the default 90 a minute for the cheaper Image Core. Not self-service adjustable; every invoke returns ThrottlingException.
- **Unblocks**: an AWS support case asking the Bedrock quotas be provisioned to defaults, or simply time if the zeros are post-subscription propagation. Either way the rerun is one command.
- A us-west-2 bucket for async video output exists now: `pax-2-video-usw2-638175140432`.

## The vendor menu, with prices as of 2026-10

| Need | Service | Price | To start |
|---|---|---|---|
| Stock photos | Pexels API | free | a free API key (signup only); `PEXELS_API_KEY` in `.env.local`, the script prefers it |
| Stock photos, keyless | Openverse | free | nothing; CC pool, quality below Pexels |
| Images on AWS | Stability Image Ultra (Bedrock) | ~$0.14/image | the quota unblock above |
| Images, cheaper | Stability Image Core (Bedrock) | ~$0.04/image | same |
| Video on AWS | Luma Ray 2 (Bedrock) | per-second, async to S3 | same |
| Video, flexible menu | fal.ai | pay-per-use, no minimum; Kling ~$0.07–0.11/s, Veo 3.1 ~$0.40/s with audio, Lite tiers from ~$0.03/s | an account + key |
| Presenter (no-camera human) | HeyGen | free tier exists | an API key |
| Presenter, strongest facial performance | Hedra | — | an API key |
| Presenter, simplest API | D-ID | trial credits | an API key |

A 60-second short with six 6-second generated clips runs roughly $2.50–4 on Kling, ~$14 on full Veo.

## The compliance line on presenters

A realistic synthetic person in political video carries YouTube's synthetic-media disclosure requirement and New York's synthetic-media rules for political communications. Showing the option is the demo; running it for a client is the client's call, with disclosure.

## Order of work when this lane reopens

1. Pexels key in, rerun the demo: stock arm at full quality, pennies.
2. Quota unblock (support case or propagation), rerun: Stability Ultra beside the stock arm — the quality comparison Brendan asked for.
3. Luma Ray 2 clips through the same manifest; compose as video layers in the Remotion renderer the Studio already uses.
4. A presenter key (HeyGen free tier first) for the third-rung proof.
5. Only after the quality is proven: merge into the Studio as one more experiment dimension with a style record per take, per the hold-aside order.
