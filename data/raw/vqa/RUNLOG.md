# Window Q run log

## The set
5,379 shorts: the uniform baseline (transcript, media in S3, composition, index embedding), every one with its .mp4 (scripts/vqa/set.mjs, hash-ordered). Audio-only baseline shorts: 0.

## Verification boxes (20 videos, the first 20 in hash order), all spot
| run | box | result |
|---|---|---|
| 20261022-185648-batch20 | g6.2xlarge | died at warm-up: vLLM's FlashInfer sampler JIT needs ninja (fix: VLLM_USE_FLASHINFER_SAMPLER=0) |
| 20261022-191017-batch20 | g5.2xlarge | 20 of 20 answered, 15 unparsed: the 4B looped on people_per_frame to max_tokens (fix: list length pinned per video in the JSON schema; tag p2) |
| 20261022-192605-batch20 | g6.2xlarge | hung at engine start: prep threads alive when vLLM forked its engine; terminated by hand at 10 min (fix: load the model first) |
| 20261022-194624-batch20 | g6.2xlarge | 4B p2: 20 of 20, 0 unparsed; load 175 s, 20 videos in 24 s wall (16 s GPU) |
| 20261022-200226-batch20 | g6.2xlarge | 8B p2: KV cache did not fit at max_model_len 16384 on the 24 GB L4 |
| 20261022-201701-batch20 | g6.2xlarge | 8B p2 (max_model_len 4096, 0.95 GPU memory, 8 sequences): 20 of 20; load 249 s, 48 s wall (39 s GPU) |
| 20261022-204336-batch20 | g6.2xlarge | 4B p3 (prompt revised after the p2 check): 20 of 20; load 176 s, 25 s wall (16 s GPU) |
g6e.xlarge (the brief's first choice) had no spot capacity in any us-east-1 zone at 18:55 UTC; every box ran on the same-class L4 (g6.2xlarge) or A10G (g5.2xlarge).

## Hand check of the 20 (accuracy; data/generated/model/vqa-verify.json)
| column | 4B p2 | 8B p2 | 4B p3 |
|---|---|---|---|
| captions burned in | 0.65 | 0.60 | 0.95 |
| call to action | 1.00 | 0.95 | 1.00 |
| CTA time (±2 s) | 1.00 | 1.00 | 1.00 |
| format | 0.74 | 0.84 | 0.84 |
| setting | 0.94 | 0.88 | 1.00 |
| people, most in one frame (exact) | 0.50 | 0.50 | 0.50 |
| people screen share (±0.15) | 0.89 | 0.83 | 0.83 |
| product shown | 1.00 | 0.95 | 1.00 |
| third-party watermark | 0.63 | 0.68 | 0.79 |
8B over 4B on the same prompt: format +0.11, watermark +0.05, captions -0.05, setting -0.06, CTA -0.05, product -0.05, people 0.00 — no net gain at twice the GPU time. The batch runs the 4B on p3. p3 was revised on these 20, so its row here is optimistic; the 100-video audit on a fresh stratified sample is the measure that ships.

## Batch extrapolation (before launch)
p3 on 20: 0.8 s GPU per video at a batch of 20, frame prep ~0.45 s per video on 6 threads, overlapped with the GPU in the batch (2 chunks of 48 prefetched). Expected 0.5-0.8 s per video: 45-75 min for 5,379, plus ~5 min boot, install and load. At $0.93/h spot: $0.80-1.30. Watchdog 120 min caps the box at $1.87. Spend before the batch: $0.78 (scripts/vqa/cost.mjs).

## Registry rule, fixed at batch launch (before any lift was read)
A trait mints a recommendation only where its Breakout lift's 90% range excludes zero and its column's hand-audited accuracy is at least 0.85; everything else stays descriptive (scripts/vqa/registry.mjs).
Amended at 21:20 UTC, after a dry run of lift.mjs on the first 500 answered shorts: a trait must also be measured in 5+ channels (the floor topic-lift.mjs uses). The dry run showed "Format: b-roll" at +28.9 (25 to 35) from 2 channels, a range that only reflects how little two channels can vary. Disclosed because it was added after a partial look.

## Batch (hit: 5,379 of 5,379)
Run 20261022-205704-batch, one spot g6.2xlarge (L4), 20:58-22:13 UTC. 5,359 answered in this run plus the 20 from the p3 verification: 5,379 of 5,379 on S3 under vqa/raw/qwen3-vl-4b-p3/, 0 errors, 0 unparsed. Model load 172 s; 4,124 s of work at 78 shorts a minute, GPU-bound (3,922 s of GPU, 0.73 s a short). 69,630 frames, 8.75 M prompt tokens, 0.81 M answer tokens. Box life 74.5 min at $0.933/h: $1.18, $0.22 per 1,000 shorts, inside the $0.80-1.30 extrapolation.
At 22:00 UTC two on-demand workers sharded by index % 3 were proposed and not launched: vqa.py reads the done list once at start, so the running box would have answered every remaining short anyway; the workers would have added cost, not speed.

## Spend (scripts/vqa/cost.mjs, EC2 + EBS)
Eight boxes, $1.96 through the batch; the headline Lambda for 5,379 titles, cents.
