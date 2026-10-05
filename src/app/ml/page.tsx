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
      status: "Needs the poller",
      ok: false,
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
  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 md:grid-cols-3">
        {[
          { k: "Examples today", v: String(analyzed), note: `${vids.length} labeled by catalog ratio, ${analyzed} with full features` },
          { k: "Examples needed", v: "500+", note: "roughly 20 reform channels for two months of uploads, or any partner archive" },
          { k: "Training cost", v: "~$0", note: "minutes of laptop compute; the data is the only expensive ingredient" },
        ].map((x) => (
          <div key={x.k} className="surface flex flex-col gap-1 p-5">
            <span className="text-xs uppercase tracking-wider text-slate-400">{x.k}</span>
            <span className="font-display text-3xl text-pax-ink">{x.v}</span>
            <span className="text-xs leading-relaxed text-slate-500">{x.note}</span>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-slate-900">The workflow</h2>
        <div className="surface flex flex-col divide-y divide-slate-100 p-0">
          {steps.map((s) => (
            <div key={s.n} className="flex gap-4 px-5 py-4">
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
      </section>

      <section className="surface flex flex-col gap-2 p-5">
        <p className="text-sm font-semibold text-slate-900">What {analyzed} videos cannot tell you</p>
        <ul className="flex flex-col gap-1.5 text-sm leading-relaxed text-slate-600">
          <li>Any weight on a single feature: with a handful of pushed videos, one lucky caption can look like a law. The lift table stays a table of hints until step 1 runs.</li>
          <li>Anything about persuasion. This whole page predicts travel; whether a traveling video changes a mind is a different experiment with a different control group.</li>
          <li>Causation. Catalogs are observational; the Upworthy archive is the only randomized evidence in the building, and it only covers wording.</li>
        </ul>
      </section>
    </div>
  )
}
