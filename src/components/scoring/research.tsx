import Link from "next/link"

import model from "../../../data/generated/model/reference-model.json"
import { cn } from "@/ui/lib/utils"

export const metadata = { title: "Reference model" }

type Feature = { key: string; label: string; diff: number; se: number; low: number; high: number; prevalence: number; n: number }
type Outcome = { ads: number; estimates: number; studies: number; meanEffect: number; meanEffectSe: number; tau: number; shareAboveZero: number; features: Feature[]; prediction: { method: string; outOfSampleR2: number; correlation: number } }
const M = model as unknown as { source: string; outcomes: Record<string, Outcome> }

// The features a volunteer testimonial actually varies.
const VOLUNTEER = new Set(["technique_plain_folks", "messenger_every_people", "narration_personal_story", "technique_pos_testimonial", "style_amateur", "style_text_on_screen", "explicit_vote_for", "narration_explain_facts", "fact_new_yes", "production_value_high"])

const LABEL: Record<string, string> = { votechoice: "Vote choice", favorability: "Favorability", votechoice_dichotomized: "Vote choice (yes/no)" }

function Forest({ features, max }: { features: Feature[]; max: number }) {
  const x = (v: number) => 50 + (v / max) * 50
  return (
    <div className="flex flex-col">
      {features.map((f) => (
        <div key={f.key} className={cn("grid grid-cols-[minmax(160px,240px)_1fr_120px] items-center gap-3 border-t py-1.5 text-sm", VOLUNTEER.has(f.key) && "bg-pax-mist")}>
          <span className={cn("truncate", VOLUNTEER.has(f.key) ? "font-medium text-pax-ink" : "text-foreground/80")}>{f.label}</span>
          <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="h-4 w-full">
            <rect x={50} y={0} width={0.25} height={10} className="fill-foreground/30" />
            <rect x={Math.max(0, x(f.low))} y={4.5} width={Math.max(0.5, Math.min(100, x(f.high)) - Math.max(0, x(f.low)))} height={1} className={f.low > 0 || f.high < 0 ? "fill-pax-plum" : "fill-foreground/35"} />
            <circle cx={x(f.diff)} cy={5} r={1.6} className={f.low > 0 || f.high < 0 ? "fill-pax-plum" : "fill-foreground/50"} />
          </svg>
          <span className="tabular text-right text-xs text-muted-foreground">
            {Math.abs(f.diff) < 0.005 ? "0.00" : `${f.diff > 0 ? "+" : ""}${f.diff.toFixed(2)}`} ({f.low.toFixed(1)} to {f.high.toFixed(1)})
          </span>
        </div>
      ))}
    </div>
  )
}

export default async function ReferencePage({ searchParams }: { searchParams: Promise<{ o?: string }> }) {
  const { o = "votechoice" } = await searchParams
  const out = M.outcomes[o] ?? M.outcomes.votechoice
  const max = Math.max(2, ...out.features.map((f) => Math.max(Math.abs(f.low), Math.abs(f.high))))
  const sorted = [...out.features].sort((a, b) => b.diff - a.diff)
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-pax-plum">What controlled tests say</p>
        <h1 className="font-display text-3xl leading-tight text-slate-900 md:text-[34px]">617 real campaign ads, each tested against a control group</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {`The Swayable archive: ${out.studies} randomized experiments run by campaigns in 2018 and 2020 (${out.ads} ads measured on ${(LABEL[o] ?? o).toLowerCase()}),`} every ad hand-coded for style and substance. It is the closest public record of what Resonance would be if it measured persuasion, so PAX uses it as the reference for what a script&apos;s style is likely worth, and as the reminder of how little style alone predicts.
        </p>
        <div className="flex gap-1">
          {Object.keys(M.outcomes).map((k) => (
            <Link key={k} href={`/scoring?tab=research&o=${k}`} className={cn("rounded-full px-3 py-1 text-xs", k === o ? "bg-pax-plum text-white" : "bg-muted text-muted-foreground hover:bg-pax-lavender")}>
              {LABEL[k] ?? k}
            </Link>
          ))}
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Big v={`${out.meanEffect >= 0 ? "+" : ""}${out.meanEffect.toFixed(2)} pts`} l="The average ad's effect" />
        <Big v={`${out.tau.toFixed(2)} pts`} l="How much true effects vary from ad to ad" />
        <Big v={`${Math.round(out.shareAboveZero * 100)}%`} l="Ads whose measured effect was above zero" />
        <Big v={Math.abs(out.prediction.outOfSampleR2) < 0.005 ? "0.00" : out.prediction.outOfSampleR2.toFixed(2)} l="Share of the variation the coded features predict for a new study" />
      </section>

      <section className="flex max-w-3xl flex-col gap-2 text-sm leading-relaxed">
        <p>
          Two facts hold together. Ads differ: an ad one spread above average moves about {(out.meanEffect + out.tau).toFixed(1)} points where the average moves {out.meanEffect.toFixed(1)}. And the coded features barely tell you in advance which ad that will be: fitted on every other study, they explain {Math.max(0, out.prediction.outOfSampleR2 * 100).toFixed(0)}% of the next study&apos;s variation.
        </p>
        <p className="text-muted-foreground">That is why PAX treats every script choice as a test to run and every style finding below as a prior, not a rule, and why its score never claims to measure persuasion.</p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl text-slate-900">What each coded feature was worth</h2>
          <span className="text-xs text-muted-foreground">Points of {LABEL[o]?.toLowerCase()}, ads with the feature vs. without · 95% interval · highlighted: what a volunteer testimonial varies</span>
        </div>
        <Forest features={sorted} max={max} />
        <p className="text-xs text-muted-foreground">
          Random-effects meta-regression, one feature at a time, inverse-variance weights. Computed by PAX from the archive; the authors&apos; own meta-regressions ship with it for comparison. Source: {M.source}
        </p>
      </section>
    </div>
  )
}

function Big({ v, l }: { v: string; l: string }) {
  return (
    <div className="surface p-4">
      <p className="tabular font-display text-4xl text-pax-ink">{v}</p>
      <p className="text-xs text-muted-foreground">{l}</p>
    </div>
  )
}
