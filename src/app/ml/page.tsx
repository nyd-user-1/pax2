import katex from "katex"
import "katex/dist/katex.min.css"

import { FormulaBlock, ListBlock, OneThirdBlock } from "@/components/blocks"
import { FormulaExplainer } from "@/components/formula-explainer"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { Stat2 } from "@/components/dash/stats"
import { featureLift, labVideos } from "@/lib/lab"
import { cn } from "@/ui/lib/utils"

export const metadata = { title: "ML" }

export default function MlPage() {
  const vids = labVideos()
  const { analyzed } = featureLift()
  const steps = [
    {
      n: 1,
      title: "Collect",
      detail: "The velocity poller watches every new upload's first 72 hours across the reform channels. Each curve is one labeled experiment.",
      status: "Poller running hourly",
      ok: true,
    },
    {
      n: 2,
      title: "Label",
      detail: "The verdict comes from the curve, not the lifetime count: an exploit inflection inside 72 hours is a pass, a plateau is a kill.",
      status: "Rule written",
      ok: true,
    },
    {
      n: 3,
      title: "Extract",
      detail: "The existing pipeline already produces the features per video for about $0.04: transcript with word timing, pace, pauses, loudness, pitch, captions, hook, call to action. Delivery labels (tone, facial read) are one prompt away in the same pass.",
      status: "Running today",
      ok: true,
    },
    {
      n: 4,
      title: "Train",
      detail: "Gradient-boosted trees or plain logistic regression on the binary verdict; class weights for the rare positives; probability calibration so 0.7 means 70%.",
      status: "An afternoon once the data exists",
      ok: true,
    },
    {
      n: 5,
      title: "Validate",
      detail: "Leave one channel out entirely and test on it, so the model must generalize across audiences rather than memorize FairVote. Report AUC and lift in the top decile, nothing fancier.",
      status: "Designed",
      ok: true,
    },
    {
      n: 6,
      title: "Ship as a prior",
      detail: "The model's probability becomes the pre-publish Breakout estimate shown with its inputs, the way every PAX number shows its math. It advises which take to post first; the live curve then renders the real verdict.",
      status: "UI exists on /break-out",
      ok: true,
    },
  ]
  const math: [string, string][] = [
    ["Label", String.raw`\begin{gathered} r_v = \dfrac{\text{views}_v}{\operatorname{median}_{u \in c(v),\ \text{age}_u \ge 7\,\text{d}} \text{views}_u} \\[6pt] y_v = \mathbf{1}\left[\, r_v \ge 3 \,\right] \end{gathered}`],
    ["Within a channel", String.raw`\begin{gathered} \Delta_c = \frac{1}{a_c}\sum_{v \in A_c} y_v - \frac{1}{b_c}\sum_{v \in B_c} y_v \\[6pt] a_c,\ b_c \ge 3, \quad a_c + b_c \le 300 \end{gathered}`],
    ["Weight", String.raw`w_c = \dfrac{2\,a_c\,b_c}{a_c + b_c}`],
    ["Pooled, in points", String.raw`\hat{\Delta} = 100 \cdot \dfrac{\sum_{c} w_c\,\Delta_c}{\sum_{c} w_c}`],
    ["90% range", String.raw`\begin{gathered} \hat{\Delta}^{*(1)}, \dots, \hat{\Delta}^{*(1000)} \\ \text{channels drawn with replacement} \\[6pt] \left[\, \hat{\Delta}^{*}_{(50)},\ \hat{\Delta}^{*}_{(950)} \,\right] \end{gathered}`],
    ["Worked example", String.raw`\begin{gathered} \Delta_{\text{Holler}} = \tfrac{13}{70} - \tfrac{19}{208} = 0.094 \\[4pt] w = \tfrac{2 \cdot 70 \cdot 208}{278} = 104.7 \\[4pt] \hat{\Delta}_{\text{reform, CTA}} = \tfrac{2073.7}{252.5} = +8.2 \end{gathered}`],
  ]
  const explain: Record<string, { pill: string; facts: [string, string][]; rows: [string, string][] }> = {
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
  }
  const limits = [
    "Any weight on a single feature: with a handful of pushed videos, one lucky caption can look like a law. The lift table stays a table of hints until step 1 runs.",
    "Anything about persuasion. This whole page predicts travel; whether a traveling video changes a mind is a different experiment with a different control group.",
    "Causation. Catalogs are observational; the Upworthy archive is the only randomized evidence in the building, and it only covers wording.",
  ]
  return (
    <div className="flex flex-col">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { title: "Examples today", value: String(analyzed), note: `${vids.length} labeled by catalog ratio, ${analyzed} with full features` },
          { title: "Examples needed", value: "500+", note: "roughly 20 reform channels for two months of uploads, or any partner archive" },
          { title: "Training cost", value: "~$0", note: "minutes of laptop compute; the data is the only expensive ingredient" },
        ].map((t) => (
          <Stat2 key={t.title} title={t.title} value={t.value} footer={t.note} />
        ))}
      </div>

      <BlockOrder page="ml" initial={["workflow", "limits", "calc-1", "calc-2"]}>
        <OrderedBlock id="workflow" label="The workflow">
          <ListBlock title="The workflow" search="Search steps…" rows={steps.map(({ n, title, status, detail }) => ({ step: n, title, status, detail }))} name="ml-workflow">
            <div className="flex flex-col divide-y divide-slate-100">
              {steps.map((s) => (
                <div key={s.n} data-find className="flex gap-4 py-4 first:pt-0">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-pax-lavender font-mono text-sm font-semibold text-pax-ink">{s.n}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{s.title}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", s.ok ? "bg-above-soft text-above" : "bg-pax-red-soft text-pax-red-deep")}>{s.status}</span>
                    </span>
                    <span className="text-sm leading-relaxed text-slate-600">{s.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </ListBlock>
        </OrderedBlock>

        <OrderedBlock id="limits" label={`What ${analyzed} videos cannot tell you`}>
          <ListBlock title={`What ${analyzed} videos cannot tell you`} id="limits" search="Search limits…" rows={limits.map((l, i) => ({ n: i + 1, limit: l }))} name="ml-limits">
            <div className="flex flex-col gap-2">
              {limits.map((l, i) => (
                <div key={l} data-find className="flex items-start gap-2.5 rounded-md border bg-card px-3 py-2">
                  <span className="shrink-0 pt-px font-mono text-xs text-muted-foreground">{i + 1}.</span>
                  <span className="min-w-0 flex-1 text-sm">{l}</span>
                </div>
              ))}
            </div>
          </ListBlock>
        </OrderedBlock>

        <OrderedBlock id="calc-1" label="Calculations">
          <OneThirdBlock>
            {math.slice(0, 3).map(([step, tex]) => (
              <FormulaBlock key={step} title={step} rows={[{ step, tex }]} name={`ml-${step.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                <div className="flex h-full min-w-0 items-center justify-center">
                  <FormulaExplainer title={step} html={katex.renderToString(tex, { displayMode: true, throwOnError: true, output: "html" })} {...explain[step]} />
                </div>
              </FormulaBlock>
            ))}
          </OneThirdBlock>
        </OrderedBlock>

        <OrderedBlock id="calc-2" label="Calculations">
          <OneThirdBlock>
            {math.slice(3, 6).map(([step, tex]) => (
              <FormulaBlock key={step} title={step} rows={[{ step, tex }]} name={`ml-${step.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                <div className="flex h-full min-w-0 items-center justify-center">
                  <FormulaExplainer title={step} html={katex.renderToString(tex, { displayMode: true, throwOnError: true, output: "html" })} {...explain[step]} />
                </div>
              </FormulaBlock>
            ))}
          </OneThirdBlock>
        </OrderedBlock>
      </BlockOrder>
    </div>
  )
}
