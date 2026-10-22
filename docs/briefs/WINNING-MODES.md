# The winning modes, refit honestly

Refit the mode machinery behind docs/RESONANCE-COMPARE.html so the deterministic pre-release mode-match can serve, per docs/RESONANCE.md. Pure CPU over existing JSONs; ~$0; no GPU, no fetch.

1. **Craft axes only.** Rebuild the per-video template from craft measurables alone — composition, speech timing, length deviation, title traits, engagement profile. The outlier multiple and any classifier forecast leave the template (the leakage the evaluation flagged, docs/RESONANCE-EVAL.md).
2. **Cluster the outperformers.** K-means over the craft templates of videos that outperformed 3×, k chosen on held-out channels (try 3–8). A cluster is only a *winning mode* if its lift — the share-over-3× of its nearest-neighbor videos — re-measures above the base rate on held-out channels. Modes that don't clear it are named and dropped.
3. **The match score.** A video's mode-match = similarity to its nearest surviving winning mode, 0–100 against the baseline's distribution. Write per-video scores and the mode definitions to `data/generated/model/winning-modes.json` with the held-out lifts on the card.
4. **Publish** private to Hugging Face under the Martian naming, pass or fail, lifts on the card.

Rules: approved vocabulary; no local typechecks; commit by explicit path; do not push; the Report states every dropped mode and why.

## Report

Append `## Report`: k chosen and how, surviving modes with their held-out lifts, dropped modes, file paths.
