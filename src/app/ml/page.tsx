import katex from "katex"
import "katex/dist/katex.min.css"

import { FormulaBlock, ListBlock, OneThirdBlock } from "@/components/blocks"
import { FormulaExplainer } from "@/components/formula-explainer"
import { EXPLAIN as explain, FORMULAS as math } from "@/lib/formulas"
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
      detail: "The model's probability becomes the pre-publish iWAR estimate shown with its inputs, the way every PAX2 number shows its math. It advises which take to post first; the live curve then renders the real verdict.",
      status: "UI exists on /break-out",
      ok: true,
    },
  ]
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
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-pax2-lavender font-mono text-sm font-semibold text-pax2-ink">{s.n}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{s.title}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", s.ok ? "bg-above-soft text-above" : "bg-pax2-red-soft text-pax2-red-deep")}>{s.status}</span>
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
