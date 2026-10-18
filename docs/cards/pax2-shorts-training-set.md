---
license: other
pretty_name: PAX2 Shorts Training Set
language:
- en
tags:
- youtube-shorts
- political-communication
- virality
size_categories:
- 10K<n<100K
---

# PAX2 Shorts Training Set

The corpus PAX2 Encoder and PAX2 Reranker train and are benchmarked on: 18,455 settled YouTube Shorts from 64 political channels, one document per short, each labeled by how it did against its own channel.

## Files

| File | Rows | What |
|---|---:|---|
| `corpus.jsonl` | 18,455 | `id`, `channelId`, `family`, `tier`, `breakout`, `group`, `text` |
| `holdout.json` | 10 channels, 3,869 ids | the held-out channels, the rule that picked them, and the corpus hash |
| `training-set.manifest.json` | | the Model Training Library's manifest: sources, label rule, counts, features |

`text` is the title, then the description (its first 600 characters), then the transcript for the 35 shorts PAX2 has analyzed, each non-empty part on its own line, cut at 1,200 characters (`scripts/encoder/corpus.mjs`, the only definition).

## Labels

`tier` is `breakout` when lifetime views are at least 3x the channel's median of settled shorts (seven days or older), `killed` at 0.5x or less, `baseline` between. `breakout` is 1 for the first tier. 2,739 breakouts (14.8%), 12,060 baseline, 3,656 killed.

| Family | Channels | Shorts |
|---|---:|---:|
| Partisan media | 8 | 9,942 |
| Candidates & officials | 20 | 4,950 |
| Nonpartisan media | 11 | 1,453 |
| Reform | 15 | 1,196 |
| Voting rights | 7 | 816 |
| UK | 3 | 98 |

Published 2025-04-15 to 2026-10-08; counts from the YouTube Data API v3 catalog fetched 2026-10-15.

## Held-out channels

Within each family the channel ids are sorted by their last hexadecimal-looking character (ties by the full id), and the top eighth, ceil(n / 8) channels and at least one, is held out: The Democrats, Gavin Newsom, Mallory McMorrow, The Capitol Feed, The Free Press, Brian Tyler Cohen, No Labels, Voter Freedom, openDemocracy, End Citizens United. 3,869 shorts, 654 breakouts. No held-out short appears in any training pair, as a positive or a negative.

## Caveats

- The labels are observational. A breakout is a short that did well against its channel, not one shown to cause anything; distribution, timing and the platform's own testing are folded in.
- The target is channel-relative. A breakout on a small channel can have fewer views than a baseline short on a large one.
- Paid-ad rows: the training set can carry Google political video ads as rows without a label. None resolved to a YouTube id on 2026-10-17, so this release has none.
- Private, because `text` is YouTube titles, descriptions and transcripts written by the channels, not by PAX2.
