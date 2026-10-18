// The Specs tab of /project-management: for each of the eleven models PAX2 trains
// or plans to train, the three mechanical answers Brendan asked for on 2026-10-18, read from the
// training code and the model files, never from the label: what the model predicts and its bounds, the
// loss it minimizes, and the algorithm or class that runs. PAX2GPT is not here: it is Claude on Bedrock,
// rented, not trained. Keep this in step with the trainers under scripts/rig, scripts/encoder and
// scripts/headline when they change.

export type ModelTerms = { id: string; name: string; target: string; loss: string; algorithm: string }

export const MODEL_TERMS: ModelTerms[] = [
  {
    id: "m-classifier",
    name: "PAX2 Classifier",
    target: "Breakout, 0 or 1: whether a settled short's lifetime views reach 3x its channel's median of settled shorts. v1 adds thumbnail features; v2 adds transcript features, same target.",
    loss: "Binary cross-entropy (the logistic log-loss) with an L2 penalty on the weights, lambda 2.0.",
    algorithm: "L2-regularized logistic regression fit by Newton's method in numpy (scripts/rig/common.py fit), features standardized; leave-one-channel-out for the measured strength.",
  },
  {
    id: "m-velocity",
    name: "PAX2 Velocity Classifier",
    target: "Hit at 72 hours, 0 or 1: views at hour 72 at least 3x the channel median; one model per horizon (1, 3, 6 hours) reading only the readings up to that hour.",
    loss: "Binary cross-entropy with an L2 penalty, lambda 2.0.",
    algorithm: "The same L2 logistic regression by Newton's method (scripts/rig/velocity.py over common.py), on log views and views over median at each horizon plus the pre-publish features.",
  },
  {
    id: "m-headline",
    name: "PAX2 Headline Ranker",
    target: "Which of two headlines for the same story won more clicks per impression in Upworthy's randomized tests; the model outputs one unbounded real score per headline, and the pair label is 0 or 1.",
    loss: "Pairwise logistic loss: minus log sigmoid of (winner's score minus loser's score), the Bradley-Terry form. v0: binary cross-entropy on the feature difference with an L2 penalty.",
    algorithm: "v1: bert-base-uncased with one linear unit on the pooled output, PyTorch, AdamW 2e-5, 3 epochs, batch 64 pairs (scripts/headline/train.py), served through ONNX Runtime. v0: scikit-learn LogisticRegression on ten pattern flags, two counts and 2,000 token presences.",
  },
  {
    id: "m-encoder",
    name: "PAX2 Encoder",
    target: "No scalar target. Contrastive: a short's text should sit nearer its 3 nearest same-channel, same-tier training shorts than 5 hard negatives of another tier; evaluated as kNN-AUC against the breakout label.",
    loss: "InfoNCE, the contrastive cross-entropy over each group of one anchor, positives and negatives, temperature 0.02.",
    algorithm: "BAAI/bge-m3 (XLM-RoBERTa-large, 568M parameters) fine-tuned dense-only with FlagEmbedding's encoder_only.m3, CLS pooling, 1 epoch, batch 16, learning rate 1e-5, bf16.",
  },
  {
    id: "m-reranker",
    name: "PAX2 Reranker",
    target: "For an anchor short and a candidate, whether the candidate is the same-channel, same-tier neighbor (the one positive) rather than one of 7 negatives; the model outputs one unbounded relevance score per pair.",
    loss: "Grouped cross-entropy: softmax over the 8 candidates of a group, the positive as the class.",
    algorithm: "Alibaba-NLP/gte-reranker-modernbert-base, a cross-encoder, fine-tuned with 44b's scripts/reranker/train.py, 8 groups a batch, max length 256, learning rate 2e-5, bf16, 2 epochs.",
  },
  {
    id: "m-retention",
    name: "PAX2 Retention Regressor",
    target: "Watch ratio per impression: play time divided by the video's duration, capped at 1; bounds 0 to 1; averaged per held-out video for scoring.",
    loss: "Squared error with an L2 penalty on the weights, alpha 1.0 (ridge). Solved in closed form; no training loop.",
    algorithm: "scikit-learn Ridge(alpha=1.0) on one-hot duration decile, upload type and the top 100 tags, trained on KuaiRand-1K's randomly exposed impressions (scripts/rig/retention_v0.py).",
  },
  {
    id: "m-ranker",
    name: "PAX2 Feed Ranker",
    target: "long_view, 0 or 1: KuaiRand's own label for a watch past its threshold, per randomly exposed impression; fallback watch ratio at least 0.5.",
    loss: "Binary cross-entropy with an L2 penalty, C 0.1.",
    algorithm: "scikit-learn LogisticRegression(C=0.1) on video features (duration decile, upload type, top 100 tags) and reader features from the reader's earlier impressions only (scripts/rig/feed_v0.py); video alone and video plus reader fit on the same rows.",
  },
  {
    id: "m-vision",
    name: "PAX2 Vision Encoder",
    target: "None of PAX2's own. Borrowed: CLIP ViT-B-32 embeddings of the thumbnail (512 dimensions, reduced to 8 by PCA) and ResMem's memorability score, bounds 0 to 1, both as features of PAX2 Classifier.",
    loss: "None trained here. CLIP was trained by OpenAI with a contrastive image-text loss; ResMem by its authors with squared error on human memory-game scores.",
    algorithm: "open_clip ViT-B-32 (openai weights) and ResMem, pretrained, run as-is on one frame or the thumbnail (scripts/rig/encode_images.py, scripts/rig/analyze_common.py); PCA from scikit-learn.",
  },
  {
    id: "m-labeler",
    name: "PAX2 Trait Labeler",
    target: "Today: 28 Swayable traits per video, each present or absent with a 0 to 1 presence score from the transcript. Planned: the same 28 binary targets learned from labels.",
    loss: "None today: a prompted language model, not trained. Planned: binary cross-entropy per trait, a multi-label classifier.",
    algorithm: "Today: Claude on Bedrock (us.anthropic.claude-sonnet-4-6) answering a fixed prompt (src/lib/evaluate.ts, worker/code_scripts.py). Planned: a fine-tuned text classifier once a few hundred videos carry human labels from Teach a Model.",
  },
  {
    id: "m-simulator",
    name: "PAX2 Platform Simulator",
    target: "None yet. sim-0 is descriptive: hourly view series over 72 hours, Hit at 3x the channel median and Miss at 0.5x or less, peak-growth hour; no quantity is predicted.",
    loss: "None; nothing is fitted.",
    algorithm: "Descriptive statistics in numpy over the poller's readings (scripts/rig/platform_sim.py). Planned: a fitted model of the Shorts feed's seed-and-expand behavior once about 1,000 curves and traffic-source data exist.",
  },
  {
    id: "m-cpc",
    name: "PAX2 Audio Encoder",
    target: "Not started. Planned: no scalar target; self-supervised, predicting a clip's future audio latents from its past (contrastive predictive coding).",
    loss: "Planned: InfoNCE over future latent frames against negatives from other clips.",
    algorithm: "Planned: a small convolutional encoder with an autoregressive context model in PyTorch on the catalog's audio, once the catalog's audio exists; the embeddings feed PAX2 Classifier.",
  },
]
