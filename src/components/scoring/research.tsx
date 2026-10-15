import Link from "next/link"

import model from "../../../data/generated/model/reference-model.json"
import { ChartBlock, MainBlock, TwoHalfBlock } from "@/components/blocks"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { cn } from "@/ui/lib/utils"

export const metadata = { title: "Reference model" }

type Feature = { key: string; label: string; diff: number; se: number; low: number; high: number; prevalence: number; n: number }
type Outcome = { ads: number; estimates: number; studies: number; meanEffect: number; meanEffectSe: number; tau: number; shareAboveZero: number; features: Feature[]; prediction: { method: string; outOfSampleR2: number; correlation: number } }
const M = model as unknown as { source: string; outcomes: Record<string, Outcome> }

// The features a volunteer testimonial actually varies.
const VOLUNTEER = new Set(["technique_plain_folks", "messenger_every_people", "narration_personal_story", "technique_pos_testimonial", "style_amateur", "style_text_on_screen", "explicit_vote_for", "narration_explain_facts", "fact_new_yes", "production_value_high"])

const LABEL: Record<string, string> = { votechoice: "Vote choice", favorability: "Favorability", votechoice_dichotomized: "Vote choice (yes/no)" }

const signed = (v: number, d = 2) => (Math.abs(v) < 0.005 ? "0.00" : `${v > 0 ? "+" : ""}${v.toFixed(d)}`)

function Row({ f, max, i }: { f: Feature; max: number; i: number }) {
  const x = (v: number) => 50 + (v / max) * 50
  const up = f.low > 0
  const down = f.high < 0
  return (
    <li data-find className="grid grid-cols-[minmax(0,15rem)_minmax(0,1fr)_7.5rem] items-center gap-4 py-2.5">
      <span className="flex min-w-0 items-center gap-2">
        <span className={cn("truncate text-sm", up || down ? "font-medium text-slate-900" : "text-slate-700")}>{f.label}</span>
        {VOLUNTEER.has(f.key) && <span className="shrink-0 rounded-full bg-pax2-lavender px-2 py-0.5 text-[10px] font-semibold text-pax2-plum">Volunteer</span>}
      </span>
      <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="h-5 w-full overflow-visible">
        <rect x={50} y={0} width={0.3} height={10} className="fill-slate-300" />
        <rect
          x={Math.max(0, x(f.low))}
          y={4.4}
          width={Math.max(0.5, Math.min(100, x(f.high)) - Math.max(0, x(f.low)))}
          height={1.2}
          rx={0.6}
          style={{ ["--i" as string]: i }}
          className={cn("grow-svg", up ? "fill-above" : down ? "fill-below" : "fill-slate-300")}
        />
        <circle cx={x(f.diff)} cy={5} r={1.7} className={up ? "fill-above" : down ? "fill-below" : "fill-slate-400"} />
      </svg>
      <span className={cn("tabular text-right text-sm", up ? "font-semibold text-above" : down ? "font-semibold text-below" : "text-slate-500")}>
        {signed(f.diff)} <span className="text-xs font-normal text-slate-400">±{((f.high - f.low) / 2).toFixed(1)}</span>
      </span>
    </li>
  )
}

export default async function ReferencePage({ searchParams }: { searchParams: Promise<{ o?: string }> }) {
  const { o = "votechoice" } = await searchParams
  const out = M.outcomes[o] ?? M.outcomes.votechoice
  const max = Math.max(2, ...out.features.map((f) => Math.max(Math.abs(f.low), Math.abs(f.high))))
  const sorted = [...out.features].sort((a, b) => b.diff - a.diff)
  const groups = [
    { name: "Helps", rows: sorted.filter((f) => f.low > 0), tone: "text-above" },
    { name: "Unclear", rows: sorted.filter((f) => f.low <= 0 && f.high >= 0), tone: "text-slate-500" },
    { name: "Hurts", rows: sorted.filter((f) => f.high < 0), tone: "text-below" },
  ].filter((g) => g.rows.length)
  const r2 = Math.max(0, out.prediction.outOfSampleR2)

  return (
    <div className="flex flex-col gap-10">
      <header className="rise flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-3xl leading-tight text-slate-900 md:text-[34px]">617 campaign ads, each tested against a control group</h1>
          <a href="https://doi.org/10.7910/DVN/LBPSSV" target="_blank" rel="noreferrer" className="w-fit text-sm text-slate-500 hover:text-pax2-plum">
            Swayable archive · {out.studies} randomized experiments, 2018 and 2020
          </a>
        </div>
        <div className="flex rounded-full bg-white p-1 shadow-e1">
          {Object.keys(M.outcomes).map((k) => (
            <Link key={k} href={`/scoring/method?tab=research&o=${k}`} className={cn("rounded-full px-3.5 py-1.5 text-sm transition-colors", k === o ? "bg-pax2-ink font-medium text-white" : "text-slate-600 hover:text-pax2-ink")}>
              {LABEL[k] ?? k}
            </Link>
          ))}
        </div>
      </header>

      <section className="surface grid grid-cols-2 divide-slate-100 overflow-hidden p-0 md:grid-cols-4 md:divide-x">
        {[
          { v: `${signed(out.meanEffect)} pts`, l: "Average ad" },
          { v: `${out.tau.toFixed(2)} pts`, l: "Spread between ads" },
          { v: `${Math.round(out.shareAboveZero * 100)}%`, l: "Ads above zero" },
          { v: `${(r2 * 100).toFixed(0)}%`, l: "Of a new study explained by style" },
        ].map((t, i) => (
          <div key={t.l} style={{ ["--i" as string]: i }} className="rise flex flex-col gap-1 p-5">
            <span className="tabular font-display text-3xl text-slate-900">{t.v}</span>
            <span className="text-sm text-slate-500">{t.l}</span>
          </div>
        ))}
      </section>

      <BlockOrder page="scoring:research" initial={["differ", "features"]}>
        <OrderedBlock id="differ" label="Ads differ">
          <TwoHalfBlock>
            <ChartBlock title="Ads differ" rows={[{ ad: "Average ad", points: out.meanEffect }, { ad: "One spread above", points: out.meanEffect + out.tau }]} name="ads-differ">
              <div className="flex h-full flex-col gap-4">
                <div className="flex flex-col gap-2.5">
                  {[
                    { l: "Average ad", v: out.meanEffect },
                    { l: "One spread above", v: out.meanEffect + out.tau },
                  ].map((b, i) => (
                    <div key={b.l} className="grid grid-cols-[8rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm">
                      <span className="text-slate-600">{b.l}</span>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div className="grow h-full rounded-full bg-pax2-plum" style={{ width: `${(b.v / (out.meanEffect + out.tau)) * 100}%`, ["--i" as string]: i }} />
                      </div>
                      <span className="tabular text-right font-semibold text-slate-900">{signed(b.v, 1)}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-auto text-sm text-slate-500">Points of {(LABEL[o] ?? o).toLowerCase()}.</p>
              </div>
            </ChartBlock>
            <MainBlock title="Style barely says which">
              <div className="flex h-full flex-col gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="tabular font-display text-5xl text-slate-900">{(r2 * 100).toFixed(0)}%</span>
                  <span className="text-sm text-slate-600">of the next study explained, fitted on all the others</span>
                </div>
                <p className="mt-auto text-sm text-slate-500">So every script is a test to run, and the chart below is a prior, not a rule.</p>
              </div>
            </MainBlock>
          </TwoHalfBlock>
        </OrderedBlock>

        <OrderedBlock id="features" label="What each feature was worth">
          <ChartBlock
            title="What each feature was worth"
            search="Search features…"
            rows={sorted.map((f) => ({ feature: f.label, points: f.diff, low: f.low, high: f.high, volunteer: VOLUNTEER.has(f.key) }))}
            name="feature-effects"
            tools={
              <div className="mx-2 flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-above" /> helps
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-slate-300" /> unclear
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-below" /> hurts
                </span>
                <span className="rounded-full bg-pax2-lavender px-2 py-0.5 text-[10px] font-semibold text-pax2-plum">Volunteer</span>
              </div>
            }
          >
            <div className="flex flex-col gap-2">
              {groups.map((g) => (
                <div key={g.name} className="flex flex-col">
                  <span className={cn("pt-3 pb-1 text-xs font-semibold tracking-wide uppercase", g.tone)}>
                    {g.name} · {g.rows.length}
                  </span>
                  <ol className="flex flex-col divide-y divide-slate-100">
                    {g.rows.map((f, i) => (
                      <Row key={f.key} f={f} max={max} i={i} />
                    ))}
                  </ol>
                </div>
              ))}
              <p className="mt-3 text-xs text-slate-400">Points of {(LABEL[o] ?? o).toLowerCase()}, ads with the feature against ads without, with the 95% interval. Random-effects meta-regression, one feature at a time. {M.source}</p>
            </div>
          </ChartBlock>
        </OrderedBlock>
      </BlockOrder>
    </div>
  )
}
