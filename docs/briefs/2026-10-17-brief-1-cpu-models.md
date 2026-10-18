# Brief 1: the laptop-free model batch on one CPU box, and the Google ads join

Written 2026-10-17 by the lead session for an executing window. Budget for this brief: $1.00 of AWS. Nothing heavy runs on the Mac: no Python, no torch, no downloads of image sets. The Mac runs Node scripts and the AWS CLI only. Do not spawn subagents. Do not push. Commit per part, staging by explicit pathspec only, never `git add -A` or `commit -a`, because another window may be committing to this tree at the same time.

## Model names

One convention, no exceptions: the project name and the kind of model. PAX2 Classifier (the VAR model, the chance of a Hit), PAX2 Encoder, PAX2 Reranker, PAX2 Audio Encoder, PAX2 Vision Encoder (borrowed: CLIP and ResMem), PAX2 Feed Ranker, PAX2 Velocity Classifier, PAX2 Retention Regressor, PAX2 Headline Ranker, PAX2 Platform Simulator, PAX2 Trait Labeler (the language model that labels videos on Swayable's traits), PAX2GPT (a retrieval-grounded language model, rented: Claude on Bedrock behind PAX2's prompts and records; the script writer and the chat). Version delta is a computation, not a model. These names go on every card, page, file comment and commit; no nicknames.

## Read first

- `docs/briefs/RIG-RULES.md`: twenty-nine rules distilled from NSR, CSHL and 44b. Every one applies. The numbered rules are cited below where a part leans on one.
- `docs/SPEC.md`, `docs/briefs/2026-10-17-graph-and-recipes.md` (house rules section: the hooks that block full-project tsc, dev servers and eslint, and the file-scoped type check that is allowed).
- `src/lib/video-features.ts`, `scripts/training-set.mjs`, `scripts/train-var.py`, `scripts/forecast-check.mjs`, `src/lib/forecast.ts`, `data/generated/model/training-set.manifest.json`, `data/generated/model/var-model.json`: the training set and the metadata model this brief extends.
- `/Users/brendanstanton/Code/nsr/scripts/publish-nsr/launch.sh`: the self-terminating box pattern to copy: Ubuntu AMI from the public SSM parameter, user-data that does the work, uploads its log to S3 and runs `shutdown -h now` with `--instance-initiated-shutdown-behavior terminate`.
- `/Users/brendanstanton/Code/nsr/scripts/train-nsr/launch.sh`: the launcher shape, the watchdog, and the "verify the box by hand before guessing" rule. Four blind boots cost NSR half a dollar; one SSM shell found the facts.
- `lambda/velocity/index.mjs` and `src/lib/velocity-store.ts`: the readings in `s3://pax-2-velocity-638175140432/velocity/polls/<day>.jsonl` and `baselines.json`.

## Part A: the rig, `scripts/rig/`

A1. `scripts/rig/launch-cpu.sh`. Launches one `c7i.xlarge` (4 vCPU, 8 GB) in us-east-1, Ubuntu 22.04 from the public SSM AMI parameter as `publish-nsr/launch.sh` does, 60 GB gp3, security group `nsr-embed-sg` (egress only), tag `Name=pax2-rig-cpu`, `--instance-initiated-shutdown-behavior terminate`. Instance profile: `pax2-worker` if `aws iam get-instance-profile --instance-profile-name pax2-worker` succeeds (it is the old worker box's role and already reaches the pax2 buckets and Bedrock); if it does not exist, use `nsr-embed` and add one inline policy `pax2-rig` to it granting `s3:GetObject`, `s3:PutObject`, `s3:ListBucket` on `pax-2-638175140432` and `pax-2-velocity-638175140432`. Before launching, upload `scripts/rig/*.py` and `requirements.txt` to `s3://pax-2-638175140432/code/rig/`. The user-data: a watchdog `shutdown -h +150` as the first line; `apt-get install python3-venv`; a venv; `pip install` from `requirements.txt` with the CPU torch wheel index; pull `code/rig/`; run `run-all.sh`, which runs the jobs below in order and continues past a failed job; upload `/var/log/rig.log` to `s3://pax-2-638175140432/logs/rig-<timestamp>.log` after every job and at the end; `shutdown -h now`. Print the instance id. The launcher walks a menu on `InsufficientInstanceCapacity`: `c7i.xlarge`, `c6i.xlarge`, `m7i.xlarge`, across the default VPC's subnets (rule 8). Every call carries `--region us-east-1` (rule 4). After launch the window does not end its turn: it polls `describe-instances` every 60 seconds, prints state changes, and when the box terminates pulls the log and the outputs (rule 13). Before launching, print the plan: each job's expected minutes and the box's hourly price, and the same for the next rung (rule 6).

A2. `scripts/rig/requirements.txt`: `torch` (CPU wheel), `open_clip_torch`, `resmem`, `numpy`, `pandas`, `pyarrow`, `pillow`, `boto3`, `scikit-learn`. If `resmem` fails to install, the memorability job writes nulls and says so in the log; the rest proceeds.

A3. Cost. On-demand c7i.xlarge is about $0.17 an hour. The watchdog caps the box at 150 minutes, under $0.50. Record the launch and termination times from `describe-instances` and write the measured cost into the commit message of Part D.

## Part B: the jobs, each a file in `scripts/rig/`

Every job reads its inputs from S3, writes its outputs to `s3://pax-2-638175140432/model/<name>` and logs one line per 500 rows. Inputs the Mac uploads before launch: `data/generated/model/training-set.jsonl` to `s3://pax-2-638175140432/model/training-set.jsonl`.

B1. `thumbs.py`. For every id in the training set, fetch `https://i.ytimg.com/vi/<id>/hqdefault.jpg` with 16 threads, 0.05 s pacing per thread, retry once, skip on 404. Store under `/work/thumbs/<id>.jpg`. Log the count fetched and the failures. Upload the failures list only.

B2. `encode_images.py`. CLIP ViT-B-32 from `open_clip` (pretrained `openai`), CPU, batch 64. For each thumbnail: the 512-d embedding (float16) into `thumb-embeddings.npy` with an `ids.json` beside it; brightness (mean luma), contrast (luma standard deviation), colorfulness (Hasler and Süsstrunk), and ResMem memorability. Fit PCA with 8 components on the embeddings and store the components and mean in `thumb-pca.json`. Write `thumb-features.json`: `{ "<id>": { "mem": 0.xx, "bright": x, "contrast": x, "color": x, "pca": [8 numbers] } }`. Upload all four.

B3. `train_var.py`. The existing `scripts/train-var.py` moved here and extended: it trains two models on the same rows and writes both into one `var-model.json`: `"metadata"` (today's features, unchanged) and `"image"` (today's features plus `mem`, `bright`, `contrast`, `color`, `pca0` to `pca7`). Same leave-one-channel-out, within-channel AUC, deciles, time split and parity checks for each. The gate, written into the JSON as `gates.image`: the image model passes only if both its leave-one-channel-out AUC and its within-channel AUC are at least those of the metadata model. Keep the feature definitions for the image columns in the JSON so the TypeScript side can read them.

B4. `velocity.py`. From the readings: every video with a reading at or before hour 6 and either a reading at or after hour 72 or a settled tier in the training set. Features at 1, 3 and 6 hours: views interpolated on the monotone-clamped series, log of views over the channel median from `baselines.json`, likes and comments at 6 hours when present, the hour of the first reading, plus the pre-publish `x` features from the training set when the id is in it. Target: breakout at 72 hours, views at 72 hours at least 3x the channel median, falling back to the settled tier. L2 logistic regression, leave-one-channel-out, same metrics as B3, plus the AUC at each horizon separately (1h only, 3h only, 6h only). Write `velocity-model.json` with the count of qualifying videos first; if fewer than 80 qualify, write the counts and stop, and say so in the log.

B5. `platform_sim.py`. Descriptive, not predictive. For every video with a 72-hour series: the hour at which the growth rate peaks, the views at that hour, and whether the final ratio is a breakout. Report by family: median views at the peak-growth hour for breakouts and for the rest, the share of eventual breakouts already above 1x their median at hours 6, 12 and 24, and the share of eventual kills already below 0.5x at the same hours. Write `platform-sim.json`. Nothing on screen yet.

B6. `headline_v0.py`. From `s3://pax-2-638175140432/curated/upworthy/upworthy-archive-confirmatory-packages-03.12.2020.parquet`: within each test, headlines pooled across image variants with at least 1,000 impressions; pairs of winner against each loser. Features a browser can compute: the ten pattern flags from `src/lib/headline-patterns.ts` (same regexes, re-implemented identically), word count, character count, and a bag of the 2,000 most frequent lowercase tokens as binary presence. Pairwise logistic regression on the feature difference, split by test id 80/20. Report pairwise accuracy against a 50% baseline and against the flags-only model. Write `headline-model.json`: vocabulary, weights, intercept, the held-out accuracy, and the pattern regexes as strings.

B7. `retention_v0.py`, optional, last. Download KuaiRand-1K from the links on kuairand.com; if the download needs a browser or exceeds 10 GB, write `retention-v0.json` with `{ "skipped": "<reason>" }` and move on. Otherwise: random-exposure rows only, watch ratio capped at 1, a linear model on duration buckets, upload type and the top 100 tags, held out by video id. Report Spearman between predicted and observed mean watch ratio per video, and the duration-to-watch-ratio curve in ten buckets. Write `retention-v0.json`.

B8. `run-all.sh`: runs B1 to B7 in order with `set +e`, timestamps, `EXIT=<code>` as the last line of each job's section, and the log plus outputs uploaded after each job, never only at the end (rule 14). Each job writes its outputs to `/work/out/<job>/` and skips itself when its outputs already exist in S3, so a relaunch resumes (rule 11).

## Part C: the Google ads join, Node on the Mac, no spend

C1. `scripts/google-video-ads.mjs`. Read `s3://pax-2-638175140432/athena/govblock/creatives/*.csv` (columns: `ad_id, ad_url, ad_type, advertiser_id, advertiser_name, date_range_start, date_range_end, num_of_days, impressions, spend_range_min_usd, spend_range_max_usd, age_targeting, gender_targeting, geo_targeting_included`). Keep `ad_type = VIDEO`. Dry run by default: print the census of VIDEO creatives by advertiser and a sample of five URLs; `--apply` fetches (rule 16). Cache every raw response under `data/raw/google-creatives/<ad_id>.html`, gitignored, and skip cached ids on rerun (rule 17). Pace at two requests a second, back off gradually on 429, and never read a 429's headers as the limit (rule 18). A `--max-requests` ceiling defaulting to 3,000 stops the run (rule 19). For each, GET `ad_url` with a browser user agent and look for a YouTube video id in the response: `youtube.com/embed/<11 chars>`, `"videoId":"<11 chars>"`, or `youtube.com/watch?v=`. Stop after the first 100 and report the yield. If fewer than half resolve, write what was found, say the page is rendered client-side, and stop; do not add a headless browser to this repo. If the yield holds, finish, then fetch public counts for the resolved ids from the YouTube Data API (`YOUTUBE_API_KEY` in `.env.local`, 50 ids a call), and write `data/generated/google-video-ads.json`: one row per creative with the band bounds parsed into numbers, the YouTube id, and the public views, likes, comments, title, duration and channel.

C2. `scripts/training-set.mjs` gains an optional join: when `google-video-ads.json` exists, rows whose id matches get `paid: { impressionsLow, impressionsHigh, spendLow, spendHigh, days, advertiser }`, and every resolved creative not already in the catalog is added as a row with `group: "paid-ad"`, `family: "Paid ads"`, `tier: "paid"`, `breakout: null`. These rows are excluded from the breakout trainer (it keeps settled catalog rows only) and included in the encoder corpus. Update the manifest counts.

C3. `data/library-meta.json`: the Google card's `usedIn` gains `{ "label": "Training set, paid video ads", "href": "/ml" }` once C1 yields rows.

## Part D: bring the outputs home

D1. Re-derive the counts on the Mac from the uploaded outputs with a Node one-off, thumbnails fetched, rows embedded, rows in each model's training set, and compare them with the log's claims; a mismatch is reported, not smoothed over (rule 21). NUL-check every JSON before committing it (rule 27). Pull from `s3://pax-2-638175140432/model/`: `var-model.json`, `velocity-model.json`, `platform-sim.json`, `headline-model.json`, `retention-v0.json`, `thumb-features.json`, `thumb-pca.json` into `data/generated/model/`. `thumb-embeddings.npy` and `ids.json` stay in S3; add their keys to `training-set.manifest.json` under `artifacts`.

D2. `src/lib/forecast.ts`: read the `metadata` model by default; accept optional image features and use the `image` model when they are supplied and its gate passed. `scripts/forecast-check.mjs` checks both.

D3. `src/lib/headline.ts`: applies `headline-model.json` to a title or opening line: the probability it beats a typical rival headline, and the three tokens or flags pulling hardest each way. No UI in this brief.

D4. `src/lib/velocity-model.ts`: applies `velocity-model.json` to a video's readings at a given hour; returns the probability and which horizon's model was used. No UI in this brief.

D5. Commit per part: A, B outputs with the measured box cost in the message, C, D. The commit for Part B states every gate result in its message: metadata AUC, image AUC, whether the image gate passed, Velocity model qualifying count and AUC, headline pairwise accuracy, retention status.

## When done

Tell Brendan in a few lines in the window: what ran, every measured number, what was skipped and why, and the box's cost from its run time.
