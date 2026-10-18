import type { RecipeType } from "@/lib/graph-data"

// A model recipe draws how a model is made: what goes in, what is done to it, what comes out, and
// where it shows up, the way an entity-relationship diagram draws a schema. Nothing on it runs.
// Templates are constants; the builder loads a copy, and only a saved copy is ever edited.
// MEMORABLE is also PAX2's model inventory: every model card on it is listed on /ml, and nowhere
// else keeps a second list. Names follow one convention: PAX2 and the kind of model.

export type RecipeTemplateNode = { type: RecipeType; id: string; fields: Record<string, string> }
export type RecipeTemplate = { id: string; name: string; nodes: RecipeTemplateNode[]; edges: [string, string][] }

const ing = (id: string, fields: Record<string, string>): RecipeTemplateNode => ({ type: "ingredient", id, fields })
const step = (id: string, fields: Record<string, string>): RecipeTemplateNode => ({ type: "step", id, fields: { status: "planned", ...fields } })
const model = (id: string, fields: Record<string, string>): RecipeTemplateNode => ({ type: "model", id, fields: { status: "planned", ...fields } })
const out = (id: string, fields: Record<string, string>): RecipeTemplateNode => ({ type: "output", id, fields: { status: "planned", ...fields } })

export const MEMORABLE: RecipeTemplate = {
  id: "memorable",
  name: "Memorable",
  nodes: [
    ing("i-catalog", { name: "Lookback catalog", what: "18,455 settled shorts from 64 channels, each labeled breakout, baseline or killed against its channel's median.", where: "data/velocity/catalog.json, data/generated/model/training-set.jsonl", size: "18,455 rows", license: "public YouTube counts", status: "hold" }),
    ing("i-velocity", { name: "Velocity readings", what: "Views, likes and comments every 15 minutes for each short's first 72 hours.", where: "s3://pax-2-velocity-638175140432/velocity/polls/", size: "10 days, 41 MB", status: "partial", note: "The poller has been off since 2026-10-15." }),
    ing("i-meta", { name: "Video metadata", what: "Tags, category, topics, captions flag, language, duration.", where: "velocity/meta.json", status: "hold" }),
    ing("i-thumbs", { name: "Thumbnails", what: "One public image per catalog short; the first frame for a Short.", where: "i.ytimg.com/vi/<id>/hqdefault.jpg, meta.json thumbnail", size: "18,941", status: "hold", note: "Never encoded." }),
    ing("i-videos", { name: "Video files", what: "The shorts themselves.", where: "s3://pax-2-638175140432/videos/", size: "63", status: "partial", note: "Downloads work from the Mac, not from AWS." }),
    ing("i-content", { name: "Content features", what: "Transcript with word timing, pace, pauses, loudness, pitch, Pegasus notes, delivery coding.", where: "data/generated/features.json, delivery.json", size: "51", status: "partial" }),
    ing("i-paid", { name: "Paid outcomes", what: "Impressions, starts, ThruPlays, completions, clicks per creative.", where: "data/generated/voter-freedom-paid.json", size: "20 creatives", status: "partial" }),
    ing("i-analytics", { name: "Organic impressions, click-through and retention", what: "Per-video YouTube Analytics from a connected channel.", where: "none", status: "lack", note: "One OAuth grant with the yt-analytics.readonly scope per partner channel; the Endgame page already asks." }),
    ing("i-swayable", { name: "Swayable persuasion archive", what: "617 randomized ad tests with coded traits.", where: "s3://pax-2-638175140432/curated/swayable/, data/generated/model/reference-model.json", license: "CC0", status: "hold" }),
    ing("i-upworthy", { name: "Upworthy headline tests", what: "32,487 randomized headline tests with clicks.", where: "curated/upworthy/, data/generated/upworthy-top.json", license: "CC BY 4.0", status: "hold" }),
    ing("i-coppock", { name: "Coppock 2020 and the emotional-ads replication", what: "49 presidential ads in 59 experiments; emotion appeals tested.", where: "curated/coppock2020/, raw/emotional-ads/", status: "hold", note: "Converted, unused." }),
    ing("i-memorability", { name: "Memorability sets", what: "LaMem 60,000 images, Memento10k and VideoMem 10,000 clips each, scored by memory games; ResMem pretrained predictor.", where: "none", license: "academic, free", status: "lack" }),
    ing("i-persuasion-labels", { name: "Persuasion labels on PAX2 videos", what: "Survey experiments on 10 to 20% of takes.", where: "none", status: "lack" }),
    ing("i-reactions", { name: "Human reaction data", what: "Memory-game or panel reactions to PAX2 videos.", where: "none", status: "lack" }),
    ing("i-usage", { name: "Platform usage events", what: "Open, play, finish, search, boost, bookmark per reader.", where: "ledger USAGE#<day>, src/lib/usage.ts", status: "partial", note: "Requirement 11. Logging since 2026-10-17." }),
    ing("i-public-shortvideo", { name: "Public short-video interaction logs", what: "KuaiRec and KuaiRand fully observed user-video matrices with watch ratio; MicroLens raw videos with interactions.", where: "none", license: "research", status: "lack", note: "Retention-like labels from another platform, for pretraining." }),

    step("s-training-set", { name: "Assemble the training set", does: "One row per settled short with raw inputs, pre-publish features, outcome and content where present.", tool: "scripts/training-set.mjs", status: "done", owner: "PAX2" }),
    step("s-encode-images", { name: "Encode thumbnails and first frames", does: "CLIP or ViT embeddings plus a ResMem memorability score per image.", tool: "laptop or the NSR rig", cost: "cents" }),
    step("s-encode-audio", { name: "Transcribe and encode audio", does: "Whisper transcripts and audio embeddings; CPC pretraining on unlabeled shorts.", tool: "NSR rig" }),
    step("s-download", { name: "Download and analyze thousands of shorts", does: "yt-dlp from the Mac, content features on the rig.", tool: "scripts/yt-download.mjs, worker/analyze_organic.py", cost: "about 4 cents a video on Pegasus, near zero with local encoders", owner: "Brendan", note: "Brendan for the download." }),
    step("s-velocity-features", { name: "Join velocity curves", does: "Views at 1, 6, 24 and 72 hours as columns.", tool: "new script over the S3 readings" }),
    step("s-classifier-v0", { name: "Train the metadata classifier", does: "L2 logistic regression, leave-one-channel-out.", tool: "scripts/train-var.py", status: "done", note: "Within-channel AUC 0.55." }),
    step("s-classifier-v1", { name: "Train the content classifier", does: "A head on image, audio and text embeddings plus metadata and early-curve features.", tool: "NSR rig" }),
    step("s-encoder", { name: "Train the contrastive encoder", does: "Scripts and transcripts into one space, positives from shared outcome tier within a channel.", tool: "/Code/nsr/scripts/train-nsr pattern, FlagEmbedding" }),
    step("s-reranker", { name: "Train the reranker", does: "Cross-encoder over the encoder's candidates.", tool: "/Code/nsr/scripts/rerank-nsr pattern" }),
    step("s-benchmark", { name: "Freeze the benchmark and gates", does: "Held-out channels and a time split; pre-registered thresholds every version must beat.", tool: "scripts/eval pattern from NSR" }),
    step("s-serve", { name: "Serve", does: "forecast() in the app today; the encoder behind a TEI box or a Hugging Face endpoint later.", tool: "src/lib/forecast.ts", status: "running" }),
    step("s-publish", { name: "Publish", does: "Dataset, models and cards to Hugging Face under NYSgpt, private.", tool: "NSR's publish rig" }),
    step("s-labeling", { name: "Label traits by hand", does: "Humans label the same forty videos on /labeling; agreement and kappa against PAX2 Trait Labeler.", tool: "scripts/consensus-agreement.mjs", owner: "Brendan" }),
    step("s-version-delta", { name: "Version delta", does: "Paired differences over version pairs: the ratio at 72 hours of each version against the one before it.", tool: "src/lib/version-delta.ts", note: "A computation, not a model." }),
    step("s-persuasion-experiment", { name: "Run the persuasion experiment", does: "A survey experiment on a fraction of takes.", tool: "Prolific or in-app", owner: "Brendan" }),

    model("m-encoder", { name: "PAX2 Encoder", kind: "encoder", definition: "A contrastive bi-encoder that embeds scripts, transcripts and frames into one vector space.", where: "s3://nsr-embed-v2/pax2/models/20261018-020459-train/encoder/, data/generated/model/encoder.json", metrics: "Held-out kNN-AUC 0.569 pooled, 0.560 within channel; stock bge-m3 0.560 and 0.557", note: "Gate E failed on 2026-10-18: pooled rose 0.010 of the 0.020 required. Not published." }),
    model("m-reranker", { name: "PAX2 Reranker", kind: "reranker", definition: "A cross-encoder that rescores candidate pairs.", where: "s3://nsr-embed-v2/pax2/models/20261018-020459-train/reranker/, data/generated/model/encoder.json", metrics: "Held-out kNN-AUC 0.560 pooled, 0.547 within channel over PAX2 Encoder top 50", note: "Gate R failed on 2026-10-18: below PAX2 Encoder on both. Not published." }),
    model("m-classifier", { name: "PAX2 Classifier", kind: "classifier", definition: "The chance of a Hit, at least 3x the channel's median, from what a video carries at publish.", status: "exists", where: "data/generated/model/var-model.json", metrics: "LOCO AUC 0.60, within-channel 0.55, top decile 1.43x" }),
    model("m-cpc", { name: "PAX2 Audio Encoder", kind: "cpc", definition: "Self-supervised representations of delivery from unlabeled shorts." }),
    model("m-vision", { name: "PAX2 Vision Encoder", kind: "encoder", definition: "CLIP embeddings and a memorability score for frames; borrowed, off the shelf.", status: "exists", where: "open_clip ViT-B-32, ResMem" }),
    model("m-velocity", { name: "PAX2 Velocity Classifier", kind: "other", definition: "A short's first hours predicting its 72-hour verdict." }),
    model("m-retention", { name: "PAX2 Retention Regressor", kind: "other", definition: "Watch ratio from content, pretrained on KuaiRand." }),
    model("m-headline", { name: "PAX2 Headline Ranker", kind: "other", definition: "A pairwise ranker of titles and opening lines trained on Upworthy's randomized tests." }),
    model("m-simulator", { name: "PAX2 Platform Simulator", kind: "other", definition: "A model of the platform's seed test fit to velocity curves." }),
    model("m-labeler", { name: "PAX2 Trait Labeler", kind: "other", definition: "A language model that labels a video on Swayable's traits; Claude on Bedrock today.", status: "exists", where: "src/lib/evaluate.ts" }),
    model("m-ranker", { name: "PAX2 Feed Ranker", kind: "ranker", definition: "Learning-to-rank over usage events." }),
    model("m-writer", { name: "PAX2GPT", kind: "writer", definition: "A retrieval-grounded language model behind PAX2's prompts and records: the script writer and the chat.", status: "exists", where: "src/app/actions.ts writeScript", note: "Claude on Bedrock, rented." }),

    out("o-forecast", { name: "Pre-flight forecast", surface: "The Scored tab on /v/<id> and the findings email" }),
    out("o-advice", { name: "Distribution advice", surface: "The Scored tab" }),
    out("o-comps", { name: "Comps by likeness", surface: "The video page's Comps block and the Similar chip on /graph" }),
    out("o-feed", { name: "Per-reader feed", surface: "/" }),
    out("o-cards", { name: "Dataset and model cards", surface: "Hugging Face, NYSgpt" }),
  ],
  edges: [
    ["i-catalog", "s-training-set"], ["i-meta", "s-training-set"], ["i-content", "s-training-set"], ["i-paid", "s-training-set"],
    ["i-thumbs", "s-encode-images"], ["i-memorability", "s-encode-images"],
    ["i-videos", "s-encode-audio"], ["i-public-shortvideo", "s-encode-audio"],
    ["i-videos", "s-download"], ["i-velocity", "s-velocity-features"],
    ["s-training-set", "s-classifier-v0"], ["s-training-set", "s-classifier-v1"],
    ["s-encode-images", "s-classifier-v1"], ["s-encode-audio", "s-classifier-v1"], ["s-velocity-features", "s-classifier-v1"], ["i-analytics", "s-classifier-v1"],
    ["s-download", "s-encode-images"], ["s-download", "s-encode-audio"],
    ["i-content", "s-encoder"], ["s-training-set", "s-encoder"], ["s-encoder", "s-reranker"],
    ["i-swayable", "m-writer"], ["i-upworthy", "m-writer"], ["i-coppock", "m-classifier"],
    ["i-persuasion-labels", "s-classifier-v1"], ["i-reactions", "s-classifier-v1"], ["i-usage", "m-ranker"],
    ["s-classifier-v0", "m-classifier"], ["s-classifier-v1", "m-classifier"], ["s-encoder", "m-encoder"], ["s-reranker", "m-reranker"], ["s-encode-audio", "m-cpc"],
    ["s-benchmark", "m-classifier"], ["s-benchmark", "m-encoder"], ["s-benchmark", "m-reranker"],
    ["m-classifier", "s-serve"], ["m-encoder", "s-serve"],
    ["s-serve", "o-forecast"], ["s-serve", "o-advice"],
    ["m-encoder", "o-comps"], ["m-reranker", "o-comps"], ["m-ranker", "o-feed"], ["m-writer", "o-forecast"],
    ["s-publish", "o-cards"], ["m-classifier", "s-publish"], ["m-encoder", "s-publish"],
    ["s-persuasion-experiment", "i-persuasion-labels"],
    ["i-velocity", "m-velocity"], ["i-public-shortvideo", "m-retention"],
    ["i-thumbs", "m-vision"], ["i-memorability", "m-vision"], ["m-vision", "s-classifier-v1"],
    ["i-upworthy", "m-headline"], ["m-headline", "m-writer"],
    ["i-velocity", "m-simulator"],
    ["i-swayable", "m-labeler"], ["m-labeler", "s-training-set"], ["s-labeling", "m-labeler"],
    ["s-version-delta", "o-advice"], ["i-swayable", "s-classifier-v1"],
  ],
}

export const TEMPLATES: RecipeTemplate[] = [MEMORABLE]
