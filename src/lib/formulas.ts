// The Breakout lift's six steps and the Resonance formula as KaTeX, with the plain-language explainer each one opens:
// shown on /ml and on every video's Formula panel.

export const FORMULAS: [string, string][] = [
  ["Label", String.raw`\begin{gathered} r_v = \dfrac{\text{views}_v}{\operatorname{median}_{u \in c(v),\ \text{age}_u \ge 7\,\text{d}} \text{views}_u} \\[6pt] y_v = \mathbf{1}\left[\, r_v \ge 3 \,\right] \end{gathered}`],
  ["Within a channel", String.raw`\begin{gathered} \Delta_c = \frac{1}{a_c}\sum_{v \in A_c} y_v - \frac{1}{b_c}\sum_{v \in B_c} y_v \\[6pt] a_c,\ b_c \ge 3, \quad a_c + b_c \le 300 \end{gathered}`],
  ["Weight", String.raw`w_c = \dfrac{2\,a_c\,b_c}{a_c + b_c}`],
  ["Pooled, in points", String.raw`\hat{\Delta} = 100 \cdot \dfrac{\sum_{c} w_c\,\Delta_c}{\sum_{c} w_c}`],
  ["90% range", String.raw`\begin{gathered} \hat{\Delta}^{*(1)}, \dots, \hat{\Delta}^{*(1000)} \\ \text{channels drawn with replacement} \\[6pt] \left[\, \hat{\Delta}^{*}_{(50)},\ \hat{\Delta}^{*}_{(950)} \,\right] \end{gathered}`],
  ["Worked example", String.raw`\begin{gathered} \Delta_{\text{Holler}} = \tfrac{13}{70} - \tfrac{19}{208} = 0.094 \\[4pt] w = \tfrac{2 \cdot 70 \cdot 208}{278} = 104.7 \\[4pt] \hat{\Delta}_{\text{reform, CTA}} = \tfrac{2073.7}{252.5} = +8.2 \end{gathered}`],
  // docs/RESONANCE.md's formula, with the fitted weights of data/generated/model/resonance-formula.json.
  ["Resonance", String.raw`\begin{gathered} \hat{P}(\text{outperform } 3\times) = \sigma\Big( b_0 + \textstyle\sum_i b_i \cdot \operatorname{logit}(q_i) \Big) \\[6pt] b_0 = 0.1926,\ \ b_c = 0.1573,\ \ b_x = 0.1048,\ \ b_h = 0.1550 \end{gathered}`],
]
export const EXPLAIN: Record<string, { pill: string; facts: [string, string][]; rows: [string, string][] }> = {
  Label: {
    pill: "Step 1 of 5",
    facts: [["Pushed at", "3× median"], ["Killed at", "0.5× or less"], ["Settled after", "7 days"], ["Labeled", "18,583 shorts"]],
    rows: [
      ["What", "Every short gets one number: its views divided by the median views of its own channel's shorts. At 3 times the median or more, it counts as pushed past the seed round."],
      ["Why", "Dividing by the channel's own median cancels out channel size. Two thousand views is a hit for a small channel and a flop for a big one; the ratio treats both fairly."],
      ["Example", "FairVote's \u201cDoes Ranked Choice Voting Help Democrats or Republicans?\u201d has 6,392 views. FairVote's median is 1,947.5. 6,392 \u00f7 1,947.5 = 3.28, so it counts as pushed."],
      ["Symbols", "r is the ratio, y is 1 when the short was pushed and 0 when it wasn't, and c(v) is the short's channel. Only shorts at least a week old set the median."],
    ],
  },
  "Within a channel": {
    pill: "Step 2 of 5",
    facts: [["Compares", "a channel to itself"], ["Minimum", "3 shorts a side"], ["Cap", "300 newest"], ["Unit", "share pushed"]],
    rows: [
      ["What", "For one channel and one trait: the share of its shorts with the trait that got pushed, minus the share of its shorts without the trait that got pushed."],
      ["Why", "Comparing a channel only against itself holds its audience, topic and size constant, so the difference belongs to the trait, not to the channel."],
      ["Example", "The Hometown Holler: 13 of its 70 shorts with a call to action were pushed (18.6%), against 19 of 208 without (9.1%). The difference is 9.4 points."],
      ["Symbols", "A is the channel's shorts with the trait and B the ones without; a and b are how many each holds. A channel needs at least 3 on each side to be counted."],
    ],
  },
  Weight: {
    pill: "Step 3 of 5",
    facts: [["Formula", "harmonic mean"], ["Hometown Holler", "104.7"], ["3 vs 100 shorts", "5.8"], ["Effect", "steadies the average"]],
    rows: [
      ["What", "How much each channel counts in the average. A channel counts more when it has plenty of shorts on both sides of the comparison."],
      ["Why", "A channel with only 3 shorts on one side can swing wildly by luck. Weighting by both counts keeps a lucky small sample from carrying the result."],
      ["Example", "The Hometown Holler has 70 shorts with the trait and 208 without: 2 \u00d7 70 \u00d7 208 \u00f7 278 = 104.7. A channel with 3 and 100 gets about 5.8."],
    ],
  },
  "Pooled, in points": {
    pill: "Step 4 of 5",
    facts: [["Unit", "percentage points"], ["Base rate", "13.5% pushed"], ["Reform, call to action", "+8.2"], ["Channels", "only those qualifying"]],
    rows: [
      ["What", "The weighted average of every channel's difference, as percentage points: how much the trait moves a short's chance of being pushed."],
      ["Why", "One number per trait, built only from within-channel comparisons, with each channel weighted so no big or lucky channel dominates."],
      ["Example", "For a call to action on reform channels, the nine channels' differences times their weights add to 2,073.7; the weights add to 252.5; 2,073.7 \u00f7 252.5 = +8.2 points."],
      ["Reading it", "+8.2 points against a 13.5% base rate means roughly 22 in 100 shorts pushed instead of 13 or 14."],
    ],
  },
  "90% range": {
    pill: "Step 5 of 5",
    facts: [["Redraws", "1,000"], ["Kept", "middle 90%"], ["Cut at", "50th and 950th"], ["Crosses zero", "can't tell"]],
    rows: [
      ["What", "How sure the number is. The list of channels is redrawn at random 1,000 times, repeats allowed, and the average recomputed each time; the middle 90% of those results is the range."],
      ["Why", "It shows how much the answer depends on which channels happen to be in the data. A range that crosses zero means the trait can't be told apart from no effect."],
      ["Example", "20 seconds or shorter: +6.5 points, range +2.8 to +10.8. The range never crosses zero, so the effect holds across the channels."],
    ],
  },
  "Worked example": {
    pill: "End to end",
    facts: [["Trait", "call to action"], ["Group", "9 reform channels"], ["Result", "+8.2 points"], ["Range", "+4.7 to +10.4"]],
    rows: [
      ["Question", "Does a call to action in the description help reform channels' shorts get pushed?"],
      ["Step 1", "Label every short: views over its channel's median; 3 times or more is pushed."],
      ["Step 2", "Within each channel, compare the pushed share with and without a call to action. The Hometown Holler: 18.6% against 9.1%, so +9.4 points."],
      ["Step 3", "Weight each channel: the Holler gets 104.7."],
      ["Step 4", "Average across the nine channels: 2,073.7 \u00f7 252.5 = +8.2 points."],
      ["Caveat", "The Hometown Holler carries 41% of the weight, so this finding leans on one channel."],
    ],
  },
  Resonance: {
    pill: "Gen 1",
    facts: [["Stack AUC", "0.5977"], ["Best single", "q_c, 0.5835"], ["Fit on", "1,240 shorts, 10 channels"], ["Intercept shift", "−1.5077"]],
    rows: [
      ["q_c", "The calibrated probability the video outperforms 3× its channel median, from the outlier classifier."],
      ["q_x", "The craft rank: the share of the channel's measured shorts this video beats pairwise under the composition pair picker (combined variant)."],
      ["q_h", "The headline percentile against the tested-headline reference."],
      ["Fit", "One logistic fit over the uniform baseline, held out by channel, with a missing-component indicator per absent q_i. Each q is clamped to [0.01, 0.99]."],
      ["Acceptance", "The stack's held-out AUC must be at least the best single component's, else that component alone serves. The stack, 0.5977, beats q_c's 0.5835, so the stack serves."],
      ["Calibration", "The intercept shifts from the held-out rows' outperform share, 44.1%, to the settled catalog's, 14.9%."],
      ["Score", "Pre is the prediction's percentile among the baseline; post is the measured ratio's percentile among the baseline."],
    ],
  },
}
