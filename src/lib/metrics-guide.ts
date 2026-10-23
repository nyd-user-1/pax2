import { GLOSSARY } from "@/lib/glossary"

// What chat reads to answer the Video Analytics prompts, which each teach one metric the site shows.
// Sources: docs/RESONANCE.md (Resonance, the mode match), data/generated/model/resonance-formula.json
// (the stack's held-out AUC, the scale), src/components/video-reads.tsx (the craft template, length,
// topic and the recommendations), the Codebook 5K and Window Q reports (agreement figures), and the
// glossary's current entries. The glossary's Engage, Interest, Act, Formula and old Resonance entries
// describe the retired paid score and stay out.

const FROM_GLOSSARY = ["share-3x", "lift", "neighborhood", "lab-tested", "e2", "swayable", "wesleyan", "upworthy"]

const WRITTEN = `Resonance: a prediction made before a short publishes: the probability it outperforms 3x its channel's median, from one logistic fit over three pre-publish measures (the outlier classifier's calibrated probability, the craft rank, which is the share of the channel's measured shorts it beats under the composition pair picker, and the headline percentile). Held out by channel, the fit's AUC is 0.598; the best single measure alone reaches 0.584. The gauge shows it from 0 to 100 as the prediction's percentile among the 5,379 baseline shorts, in credit-score bands: Poor below 51, Fair 51 to 66, Good 67 to 79, Very good 80 to 90, Exceptional 91 and up. Once the short completes its 72-hour window, the needle moves to the measured outcome's percentile on the same scale, the prediction stays on the arc as a dashed tick, and the center shows the signed difference between them.

Outperformed 3x: a short whose views reached at least three times its own channel's median. Measuring against the channel's own median means channel size does not decide the result: an ordinary video on a large channel does not count, and a small channel's short that triples its usual views does.

Outlier Score: a short's views divided by its channel's median, written as a multiple. 3.0x is the outperformed-3x line.

Mode match: a winning mode is a craft configuration that recurs among shorts that outperformed 3x, found by clustering their craft templates and kept only if its lift re-measures above the base rate on held-out channels. The mode match scores how closely this short's craft template matches the surviving mode. Each ingredient row gives the axis's weight in the match, the short's percentile against the mode's center, and a band: On mode, Near or Off.

Craft template: craft axes from the composition, speech, length and title measures, each this short's percentile within its own channel. The rings mark 25, 50 (the channel's middle) and 75. The outcome is never one of the axes.

Resonant Length: across the catalog, within each channel, the share of shorts that outperformed against the share that underperformed at each length; the length where the two curves cross is marked, and so is this short's length.

Resonant Topic: each content topic's lift in percentage points (its shorts' rate of outperforming 3x minus their own channels' usual rate), with its interval; this short's topic is highlighted.

Recommendations: advice counts as grounded only when the recommendation registry holds a measured lift for that variable. Until then each line is a descriptive read of which craft axes sit off the winning mode, and a short on the mode everywhere reads "No change recommended." "Measured, no verdict yet" means the measurement exists but no measured lift backs advice.

How far the codebook blocks can be trusted: Swayable's 28 traits are coded from the transcript by an open model that agrees with the reference coder on 82% of trait calls (kappa 0.61); the trait effects come from 617 political ads tested against control groups, and no single trait predicts an ad's effect in a study it was not fit on. Wesleyan's goal agrees 95% and party favored 85%; tone agrees 55% and is not shown. Upworthy's patterns read the title only.

The /metrics page: Live is the poller's table of shorts still inside their first 72 hours, read every 15 minutes, with their view curves; 72 hours is the window an outcome is settled in. Complete holds the shorts whose window has closed, with the settled outcome and the full curve. Patterns gives the share at 3x and the lift across the catalog by feature and by neighborhood. Outliers lists the shorts that outperformed 3x, ranked by Outlier Score. Feature worth gives what each coded ad feature was worth in the randomized ad tests: the difference in persuasion, in percentage points against the control group, between ads with the feature and ads without, with its interval.`

export function metricsGuide(): string {
  const terms = GLOSSARY.filter((t) => FROM_GLOSSARY.includes(t.id)).map((t) => `${t.full}: ${t.definition}`).join("\n\n")
  return `METRICS — the definitions behind every metric the site shows. Answer questions about a metric from these definitions and their numbers; where a definition is not here, say so instead of supplying one.\n\n${WRITTEN}\n\n${terms}`
}
