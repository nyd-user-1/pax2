## NYSgpt/pax2-classifier

**Card:** Scores a political short's chance of reaching 3x its channel's median before it's published: 0.648 AUC on ten channels it never saw, against 0.596 for metadata alone on the same rows.

**Post:** What a Short carries at publish — title, description, transcript, thumbnail — is enough to say something real about where it lands. pax2 Classifier scores the chance a political YouTube Short reaches at least 3x its own channel's lifetime median: 0.648 AUC on ten channels the model never saw, against 0.596 for metadata alone on the same rows, its top decile hitting at twice the base rate. The bar was registered before the run. An arm that added composition features failed that bar, and the card says so.
https://huggingface.co/NYSgpt/pax2-classifier

## NYSgpt/pax2-velocity-classifier

**Card:** At hour six, the chance a short reaches 3x its channel median by hour 72: 0.729 AUC across channels, top decile at 3.7x the base rate — on 341 curves and 33 hits, so the numbers still swing.

**Post:** Six hours after a Short goes up, its view curve already says most of what hour 72 will confirm. pax2 Velocity Classifier reads the first hours of views against the channel's median: 0.729 AUC with every channel held out in turn, top decile at 3.7x the base rate. The honest part: 341 curves, 33 hits. The previous fit read 0.877, and nine added curves moved it to 0.729 — at this size the numbers swing, and the card says by how much. The next version waits on about 1,000 settled curves.
https://huggingface.co/NYSgpt/pax2-velocity-classifier

## NYSgpt/pax2-encoder

**Card:** bge-m3 fine-tuned so a short's text sits near shorts that did as well as it did: kNN-AUC 0.608 on ten held-out channels, against 0.578 stock. The gate asked +0.02; it cleared at +0.031.

**Post:** Off-the-shelf embeddings put Shorts next to Shorts about the same thing. pax2 Encoder is bge-m3 fine-tuned so a Short sits near Shorts that did as well as it did — outcome, not just topic. On ten channels it never trained on, its 20 nearest neighbors' record predicts a new Short's own outcome at 0.608 kNN-AUC against 0.578 stock. The pre-registered gate asked +0.02; this run cleared at +0.031, after two earlier attempts on fewer transcripts missed and were recorded on the card.
https://huggingface.co/NYSgpt/pax2-encoder

## NYSgpt/pax2-reranker

**Card:** Re-scores the encoder's 50 nearest candidates. Passed its gate at +0.0011 pooled kNN-AUC — kept because it never fell below the encoder, not because it moved the number.

**Post:** Not every pass is a win worth claiming. pax2 Reranker is a cross-encoder that re-scores the encoder's candidate neighbors; its pre-registered gate asked that it not fall below the encoder, and it cleared by 0.0011 pooled kNN-AUC. Per family the picture is genuinely mixed: Reform rises from 0.562 to 0.644, Voting rights falls from 0.717 to 0.648. The card carries the whole table, including the fall.
https://huggingface.co/NYSgpt/pax2-reranker

## NYSgpt/pax2-headline-ranker

**Card:** Which of two headlines for the same story wins the click: 0.672 held-out pairwise accuracy on Upworthy's randomized tests, against 0.610 for the pattern-flag baseline. 2013–15 headlines; the transfer to 2026 shorts is untested.

**Post:** Upworthy ran the largest public randomized headline experiment there is, and its archive still teaches. pax2 Headline Ranker trains on 41,175 winner-loser pairs from 12,454 of those tests and picks the clicked headline 67.2% of the time held out, against 61.0% for a pattern-flag baseline and 50% chance. Epoch 1's weights are the saved ones — epochs 2 and 3 overfit, and the card says so. One caveat stays up front: these are 2013–2015 news headlines, and the transfer to 2026 political Shorts is untested.
https://huggingface.co/NYSgpt/pax2-headline-ranker

## NYSgpt/pax2-retention-regressor

**Card:** How much of a short gets watched, from length, upload type and tags — pretrained on KuaiRand's randomized exposures, Spearman 0.746 held out. The weights don't transfer to YouTube; the recipe does.

**Post:** A placeholder, labeled as one. pax2 Retention Regressor pretrains on KuaiRand-1K's randomly exposed impressions — 41,718 views of 7,161 videos — and ranks held-out videos' watch ratio at Spearman 0.746. The card states its own limit in the first caveat: another platform, another culture of shorts; the weights do not transfer to YouTube, the recipe does. It holds the seat until a connected channel supplies real YouTube Analytics retention.
https://huggingface.co/NYSgpt/pax2-retention-regressor

## NYSgpt/pax2-feed-ranker

**Card:** Knowing the reader lifts pooled AUC from 0.578 to 0.697 — and lowers within-reader AUC from 0.595 to 0.553. It tells readers apart, not what one reader will watch. Nothing serves it.

**Post:** A negative result, published because it's the useful kind. pax2 Feed Ranker pretrains on KuaiRand's random exposures to ask whether reader history predicts which short a given reader watches through. Reader features lift pooled AUC from 0.578 to 0.697 — and lower within-reader AUC from 0.595 to 0.553. They identify who watches through more in general; they do not yet pick the video for the person, which is the question a feed answers. That 0.553 is the number to beat when this retrains on real reader rows.
https://huggingface.co/NYSgpt/pax2-feed-ranker

## NYSgpt/pax2-persuasion-reference

**Card:** 146 randomized ad studies, 28 coded traits: no trait recipe predicts an ad's effect in a study it wasn't fit on (leave-one-study-out R² of −0.021 to 0.003). Single traits carry measured differences. A reference; it scores nothing.

**Post:** What doesn't predict is worth publishing too. Built from the replication archive of "How Experiments Help Campaigns Persuade Voters" (APSR 2024): across 146 randomized political ad studies, a model on 28 coded traits reads leave-one-study-out R² between −0.021 and 0.003. An ad's coded traits do not predict its persuasive effect out of study — the paper reaches the same conclusion. Single traits still carry measured differences: a plain-folks appeal sits +0.79 points on vote choice (95% interval 0.32 to 1.25). pax2 cites those differences beside a video's findings and scores nothing with the model.
https://huggingface.co/NYSgpt/pax2-persuasion-reference

## NYSgpt/pax2-semantic-id-model

**Card:** PLUM-style semantic IDs over 18,455 shorts. Failed its pre-registered gate on both allowed attempts, 0.558 and 0.571 against a 0.578 bar: the cells carry less than the continuous neighbors do.

**Post:** Failed, recorded, published. Following PLUM's recipe (arXiv 2510.07784), 18,455 political Shorts were quantized into three-level semantic IDs, and each held-out short scored by its cell's record. The pre-registered bar: beat stock embeddings at 0.5775. Attempt one read 0.5584; the one allowed retry, with shrinkage, 0.5708. On the same shorts the encoder's continuous 20 nearest neighbors read 0.608 — at this corpus size, cells lose what neighbors keep. The quantizer itself is sound (0.862 normalized mutual information against the catalog's own clustering), and every table ships.
https://huggingface.co/NYSgpt/pax2-semantic-id-model

## NYSgpt/pax2-resonance-encoder

**Card:** Audience behavior trained into the embedding through a co-occurrence term: same-channel pair ranking 0.582 against the serving encoder's 0.562, ahead on six of seven held-out channels; gives back 0.003 of semantic kNN-AUC for it.

**Post:** The biggest ablation win in YouTube's PLUM paper was a co-occurrence term, so pax2 tested it at its own scale. pax2 Resonance Encoder adds 2,091 behavioral groups — same-channel co-outliers and measured co-surges — to the encoder's contrastive training. On held-out channels it ranks same-channel pairs at 0.582 against the serving encoder's 0.562 (bootstrap 95% interval +0.012 to +0.031, ahead on six of seven channels), and pays 0.003 of pooled semantic kNN-AUC for it. The trade is on the card, stated plainly.
https://huggingface.co/NYSgpt/pax2-resonance-encoder

## NYSgpt/pax2-resonance-encoder-full

**Card:** Passed both gates and was not selected: its publish-week proxy pairs raise the semantic score to 0.615 and lower the behavioral one to 0.578. The proxy teaches topic-in-week, not audience behavior.

**Post:** Two arms, one rule fixed before the run: the higher behavioral score gets selected. This arm added 1,552 publish-week co-surge groups — a proxy, since a settled ratio says a short crossed its channel's median, not when. It passed both gates and lost the selection: semantic kNN-AUC up to 0.615, pair ranking down to 0.578 against the sibling's 0.582. The proxy teaches topic-in-week more than audience behavior. Published because the contrast is the finding.
https://huggingface.co/NYSgpt/pax2-resonance-encoder-full

## NYSgpt/pax2-composition-ranker

**Card:** Orders same-channel pairs from how each short is made — cuts, loudness, on-screen text, speech, title. 0.566 alone, 0.595 with encoder neighbors: a tie with the serving classifier, not a beat. Every weight is named.

**Post:** Every weight in this model is a sentence an editor can act on. pax2 Composition Ranker orders same-channel pairs — which of two Shorts reached 3x the channel median — from named, measured features: the Shorts that cleared that bar cut first at 5.4 seconds against the controls' 6.3. Alone it reads 0.566 held-out pair accuracy, and its interval crosses the 0.55 bar; with the encoder's neighbor readings, 0.595 — a tie with the serving classifier, not a beat. Its value is legibility: speech rate up, time to first word down, time to first cut down.
https://huggingface.co/NYSgpt/pax2-composition-ranker

## NYSgpt/pax2-shorts-training-set

**Card:** 18,455 settled political YouTube Shorts from 64 channels, one document per short, each labeled against its own channel's median. The corpus every pax2 text model trains and benches on.

**Post:** One corpus, one label rule, every text model stands on it. 18,455 settled political YouTube Shorts from 64 channels — title, description, transcript — each labeled by its own channel's arithmetic: at least 3x the channel's median of settled shorts, 0.5x or less, or between; 14.8% clear the top bar. Ten channels are held out by a published rule, and no held-out short appears in any training pair. The labels are observational and channel-relative, and the card says what that folds in: timing, distribution, the platform's own testing.
https://huggingface.co/datasets/NYSgpt/pax2-shorts-training-set

## NYSgpt/pax2-outlier-benchmark

**Card:** A frozen, channel-held-out test: does an encoder place a short near shorts that did as well as it did? The first two models it scored both failed their pre-registered gates, and the bar did not move.

**Post:** A benchmark earns trust by saying no. This one freezes 3,869 Shorts from 10 held-out channels and asks one question of any text encoder: do a Short's 20 nearest training neighbors share its outcome? The first two models it scored both failed their pre-registered gates — the encoder missed its +0.02 pooled bar by 0.0101, the reranker fell below on both numbers — and the bar did not move; a later run cleared it at +0.031. Every number is computed twice, on the GPU box and again on a separate implementation, agreeing to four decimals.
https://huggingface.co/datasets/NYSgpt/pax2-outlier-benchmark
