import Link from "next/link"

import lengthCrossing from "../../data/generated/model/length-crossing.json"
import topicLift from "../../data/generated/model/topic-lift.json"
import { GrowBar } from "@/components/grow-bar"
import { Hint } from "@/components/hint"
import { Radar } from "@/components/radar"
import { axisLabel, type Mode } from "@/lib/video-reads"
import { cn } from "@/ui/lib/utils"

// The video page's per-video reads, all drawn as plain SVG from measured artifacts:
// the craft octagon (docs/RESONANCE-EVAL.md: craft axes only, outcome never inside the shape),
// the length crossing with this video's length marked, the topic lift with this video's topic
// highlighted, and Resonance's pair: the banded gauge and the mode match (docs/RESONANCE.md).

const NAVY = "#1e3a8a"
const RED = "#dc2626"
const LIGHT = "#3b82f6"

// ---------- the production profile ----------

/** Eight production axes: composition, speech, length and title, each a within-channel percentile. */
export const OCTAGON_AXES = ["cutsPerSec", "visualActivity", "loudnessLufs", "textFrameShare", "speechWps", "firstWordSec", "durationSec", "titleWords"]

export function CraftOctagon({ template }: { template: Record<string, number> }) {
  const axes = OCTAGON_AXES.map((a) => ({ key: a, label: axisLabel(a) }))
  return (
    <div className="@container">
      <div className="grid items-center gap-6 @xl:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <Radar axes={axes} label="Production profile, within-channel percentiles" shapes={[{ name: "This short", values: template, stroke: NAVY, fill: "rgb(30 58 138 / 0.12)" }]} />
        <table className="tabular w-full max-w-xl text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr className="[&_th]:pb-2 [&_th]:font-medium">
              <th>Feature</th>
              <th className="w-1/2">Percentile in its channel</th>
              <th className="text-right" />
            </tr>
          </thead>
          <tbody className="[&_td]:border-t [&_td]:border-slate-100 [&_td]:py-1.5">
            {OCTAGON_AXES.map((a, i) => (
              <tr key={a}>
                <td className="pr-3 text-slate-700">{axisLabel(a)}</td>
                <td className="pr-3">
                  <GrowBar value={template[a] ?? 0} i={i} marker={50} title="The tick is the channel's middle" />
                </td>
                <td className="w-10 text-right font-semibold text-slate-900">{template[a]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------- the length crossing, this video marked ----------

type Bin = { mid: number; within: { outperform: number; underperform: number } }
const BINS = lengthCrossing.bins as Bin[]
const CROSS = lengthCrossing.crossing.within as { seconds: number; share: number }

export function LengthOnCurve({ seconds }: { seconds: number }) {
  const W = 520
  const H = 220
  const L = 36
  const B = 28
  const S_MAX = 150
  const Y_MAX = 26
  const x = (s: number) => L + (Math.min(S_MAX, Math.max(0, s)) / S_MAX) * (W - L - 8)
  const y = (p: number) => 10 + (1 - p / Y_MAX) * (H - B - 10)
  const line = (k: "outperform" | "underperform") => BINS.filter((b) => b.mid <= S_MAX).map((b) => `${x(b.mid)},${y(b.within[k])}`).join(" ")
  const i = Math.max(1, BINS.findIndex((b) => b.mid >= seconds))
  const a = BINS[i - 1]
  const b = BINS[Math.min(i, BINS.length - 1)]
  const t = b.mid === a.mid ? 0 : Math.min(1, Math.max(0, (seconds - a.mid) / (b.mid - a.mid)))
  const here = { out: a.within.outperform + t * (b.within.outperform - a.within.outperform), under: a.within.underperform + t * (b.within.underperform - a.within.underperform) }
  return (
    <div className="flex flex-col gap-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Share that outperform and underperform by length">
        {[0, 10, 20].map((p) => (
          <g key={p}>
            <line x1={L} x2={W - 8} y1={y(p)} y2={y(p)} stroke="#f1f5f9" />
            <text x={L - 6} y={y(p)} textAnchor="end" dominantBaseline="middle" className="fill-slate-400 text-[10px]">
              {p}%
            </text>
          </g>
        ))}
        {[0, 30, 60, 90, 120, 150].map((s) => (
          <text key={s} x={x(s)} y={H - 8} textAnchor="middle" className="fill-slate-400 text-[10px]">
            {s}s
          </text>
        ))}
        <polyline points={line("outperform")} fill="none" stroke={NAVY} strokeWidth={2.5} />
        <polyline points={line("underperform")} fill="none" stroke={RED} strokeWidth={2.5} />
        <circle cx={x(CROSS.seconds)} cy={y(CROSS.share)} r={4} fill="#fff" stroke="#0f172a" strokeWidth={1.5} />
        <line x1={x(seconds)} x2={x(seconds)} y1={10} y2={H - B} stroke={LIGHT} strokeWidth={1.5} strokeDasharray="4 3" />
        <circle cx={x(seconds)} cy={y(here.out)} r={4} fill={NAVY} />
        <circle cx={x(seconds)} cy={y(here.under)} r={4} fill={RED} />
        <text x={x(seconds) + (seconds > 110 ? -6 : 6)} y={18} textAnchor={seconds > 110 ? "end" : "start"} className="fill-pax2-blue text-[11px] font-semibold">
          This video, {Math.round(seconds)}s
        </text>
      </svg>
      <div className="tabular flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: NAVY }} /> outperform 3x: {here.out.toFixed(1)}% at this length
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: RED }} /> underperform 0.5x: {here.under.toFixed(1)}%
        </span>
        <span>crossing at {CROSS.seconds.toFixed(0)}s</span>
      </div>
    </div>
  )
}

// ---------- the topic lift, this video's row highlighted ----------

type Topic = { id: number; name: string; lift: number; low: number; high: number; shorts: number }
const TOPICS = (topicLift.topics as Topic[]).slice().sort((p, q) => q.lift - p.lift)

export function TopicRows({ cluster }: { cluster: number | null }) {
  const max = Math.max(...TOPICS.map((t) => t.high))
  const min = Math.min(0, ...TOPICS.map((t) => t.low))
  const x = (v: number) => ((v - min) / (max - min)) * 100
  const mine = TOPICS.find((t) => t.id === cluster)
  return (
    <div className="flex flex-col gap-2">
      {!mine && <p className="text-xs text-slate-500">This video&apos;s topic is not among the topics with enough channels to size its lift.</p>}
      <ol className="flex flex-col">
        {TOPICS.map((t) => (
          <li key={t.id} id={t.id === cluster ? "topic-mine" : undefined} className={cn("grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)_4.5rem] items-center gap-3 rounded-lg px-2 py-1.5", t.id === cluster && "bg-pax2-lavender/70 ring-1 ring-pax2-blue/30")}>
            <span className={cn("truncate text-sm", t.id === cluster ? "font-semibold text-pax2-blue" : "text-slate-700")}>{t.name}</span>
            <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="h-4 w-full">
              <rect x={x(0)} y={0} width={0.4} height={10} className="fill-slate-300" />
              <rect x={x(t.low)} y={4.2} width={Math.max(0.6, x(t.high) - x(t.low))} height={1.6} rx={0.8} className={t.id === cluster ? "fill-pax2-blue" : "fill-slate-300"} />
              <circle cx={x(t.lift)} cy={5} r={1.8} className={t.id === cluster ? "fill-pax2-blue" : "fill-slate-500"} />
            </svg>
            <span className={cn("tabular text-right text-sm", t.id === cluster ? "font-semibold text-pax2-blue" : "text-slate-600")}>{t.lift.toFixed(1)}</span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-slate-400">Lift in percentage points of shorts over 3x their channel median, with the 90% range.</p>
    </div>
  )
}

// ---------- Resonance: the banded gauge ----------

/** The credit-score bands, carried proportionally from the 300–850 scale onto 0–100. */
export const BANDS = [
  { name: "Poor", from: 0, to: 51, color: "#dc2626" },
  { name: "Fair", from: 51, to: 67, color: "#f97316" },
  { name: "Good", from: 67, to: 80, color: "#eab308" },
  { name: "Very good", from: 80, to: 91, color: "#84cc16" },
  { name: "Exceptional", from: 91, to: 100, color: "#16a34a" },
]
const bandOf = (v: number) => BANDS.find((b) => v >= b.from && v < b.to) ?? BANDS[BANDS.length - 1]

function arc(from: number, to: number, r: number) {
  const p = (v: number) => {
    const a = Math.PI * (1 - v / 100)
    return [100 + r * Math.cos(a), 100 - r * Math.sin(a)]
  }
  const [x1, y1] = p(from)
  const [x2, y2] = p(to)
  return `M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}`
}

/** Pre-release, the pre score holds the needle. Once the 72-hour window completes, `post` takes the
 *  needle, `pre` becomes a reference tick on the arc, and the center shows the signed difference. */
export function ResonanceGauge({ pre, post }: { pre: number | null; post?: number | null }) {
  const live = post ?? pre
  const needle = (v: number) => {
    const a = Math.PI * (1 - v / 100)
    return [100 + 62 * Math.cos(a), 100 - 62 * Math.sin(a)]
  }
  const tick = (v: number) => {
    const a = Math.PI * (1 - v / 100)
    return [100 + 70 * Math.cos(a), 100 - 70 * Math.sin(a), 100 + 92 * Math.cos(a), 100 - 92 * Math.sin(a)]
  }
  const diff = post != null && pre != null ? Math.round(post - pre) : null
  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 200 116" className="h-auto w-full max-w-[320px]" role="img" aria-label="Resonance gauge">
        {BANDS.map((b) => (
          <path key={b.name} d={arc(b.from + 0.6, b.to - 0.6, 82)} fill="none" stroke={live == null ? "#e2e8f0" : b.color} strokeWidth={14} strokeDasharray={live == null ? "4 3" : undefined} />
        ))}
        {post != null && pre != null && (() => {
          const [x1, y1, x2, y2] = tick(pre)
          return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0f172a" strokeWidth={2} strokeDasharray="2 2" />
        })()}
        {live != null && (() => {
          const [x, y] = needle(live)
          return <line x1={100} y1={100} x2={x} y2={y} stroke="#0f172a" strokeWidth={3} strokeLinecap="round" />
        })()}
        <circle cx={100} cy={100} r={diff != null ? 15 : 6} fill={diff != null ? "#fff" : "#0f172a"} stroke="#0f172a" strokeWidth={diff != null ? 1.5 : 0} />
        {diff != null && (
          <text x={100} y={101} textAnchor="middle" dominantBaseline="middle" className={cn("text-[10px] font-semibold", diff >= 0 ? "fill-above" : "fill-below")}>
            {diff > 0 ? `+${diff}` : diff}
          </text>
        )}
      </svg>
      {live != null ? (
        <div className="flex flex-col items-center">
          <span className="tabular font-display text-4xl text-pax2-blue">{Math.round(live)}</span>
          <span className="text-sm font-medium" style={{ color: bandOf(live).color }}>
            {bandOf(live).name}
          </span>
        </div>
      ) : (
        <span className="text-sm text-slate-400">No Resonance score yet</span>
      )}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {BANDS.map((b) => (
          <span key={b.name} className="flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: b.color }} />
            {b.name}
          </span>
        ))}
      </div>
    </div>
  )
}

/** What unlocks a fuller read, one row per missing component. */
export function UnlockList({ actions }: { actions: { what: string; href?: string }[] }) {
  if (!actions.length) return null
  return (
    <ul className="flex flex-col gap-1.5">
      {actions.map((a) => (
        <li key={a.what} className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600">
          {a.href ? (
            <Link href={a.href} className="text-pax2-blue underline decoration-pax2-light-blue underline-offset-4">
              {a.what}
            </Link>
          ) : (
            a.what
          )}
        </li>
      ))}
    </ul>
  )
}

// ---------- Resonance: the profile similarity ----------

export type Ingredient = { axis: string; weight: number; video: number; center: number; diff: number; band: "On mode" | "Near" | "Off" }

/** The surviving mode's ingredients against this video: the axes the mode leans on most (farthest
 *  from the channel middle), each with its share of the mode's lean, the video's percentile and the
 *  signed difference from the mode's center. */
export function ingredients(template: Record<string, number>, mode: Mode, axes: string[], take = 8): Ingredient[] {
  const lean = axes.map((a) => ({ a, l: Math.abs((mode.center[a] ?? 50) - 50) })).sort((p, q) => q.l - p.l).slice(0, take)
  const total = lean.reduce((s, x) => s + x.l, 0) || 1
  return lean.map(({ a, l }) => {
    const diff = Math.round((template[a] ?? 50) - (mode.center[a] ?? 50))
    return { axis: a, weight: Math.round((l / total) * 100), video: template[a] ?? 50, center: mode.center[a] ?? 50, diff, band: Math.abs(diff) <= 15 ? "On mode" : Math.abs(diff) <= 30 ? "Near" : "Off" }
  })
}

const CHIP: Record<Ingredient["band"], string> = { "On mode": "bg-above-soft text-above", Near: "bg-pax2-lavender text-pax2-blue", Off: "bg-below-soft text-below" }

export function ModeMatch({ score, rows, template, mode }: { score: number; rows: Ingredient[]; template: Record<string, number>; mode: Mode }) {
  const axes = rows.map((r) => ({ key: r.axis, label: axisLabel(r.axis) }))
  const profile = mode.name.replace(/^./, (c) => c.toUpperCase())
  return (
    <div className="@container">
      <div className="grid items-start gap-6 @xl:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <div className="flex flex-col items-center gap-4">
          <Hint text={`How closely this short's production profile matches the profile shared by shorts that outperformed 3x (${profile.toLowerCase()}), scored against the label-blind sample.`}>
            <span className="flex items-baseline gap-1.5">
              <span className="tabular font-display text-6xl leading-none text-pax2-blue">{score}</span>
              <span className="text-sm text-slate-400">/ 100</span>
            </span>
          </Hint>
          <Radar
            axes={axes}
            label="This short against the outperformers' profile"
            shapes={[
              { name: "Outperformers", values: mode.center, stroke: "#94a3b8", fill: "rgb(148 163 184 / 0.08)", dashed: true },
              { name: "This short", values: template, stroke: NAVY, fill: "rgb(30 58 138 / 0.12)" },
            ]}
          />
          <div className="flex gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4" style={{ background: NAVY }} /> this short
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 border-t-2 border-dashed border-slate-400" /> outperformers
            </span>
          </div>
        </div>
        <table className="tabular w-full max-w-xl text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr className="[&_th]:pb-2 [&_th]:font-medium">
              <th>Feature</th>
              <th className="text-right">Weight</th>
              <th className="text-right">This short</th>
              <th className="text-right">Outperformers</th>
              <th className="text-right" />
            </tr>
          </thead>
          <tbody className="[&_td]:border-t [&_td]:border-slate-100 [&_td]:py-1.5">
            {rows.map((r) => (
              <tr key={r.axis}>
                <td className="pr-2 text-slate-700">{axisLabel(r.axis)}</td>
                <td className="text-right text-slate-500">{r.weight}%</td>
                <td className="text-right font-semibold text-slate-900">{r.video}</td>
                <td className="text-right text-slate-500">{r.center}</td>
                <td className="pl-3 text-right">
                  <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", CHIP[r.band])}>
                    {r.band} {r.diff > 0 ? `+${r.diff}` : r.diff}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------- recommendations ----------

const ordinal = (n: number) => {
  const r = n % 100
  return `${n}${r >= 11 && r <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`
}

/** What to do on each feature, in the volunteer's words: `up` when the outperformers sit higher on
 *  it than this short, `down` when lower. */
const PLAIN: Record<string, { up: string; down: string }> = {
  cutsPerSec: { up: "Cut more often: change the shot every few seconds.", down: "Hold each shot a little longer." },
  firstCutSec: { up: "Your first cut can come a little later.", down: "Cut sooner: change the shot in the first second or two." },
  cutsHook: { up: "Put a cut or two in the first two seconds.", down: "Keep the first two seconds on one steady shot." },
  visualActivity: { up: "Add movement on screen: walk, gesture, change the angle.", down: "Calm the picture: a simpler background, a steadier frame." },
  loudnessLufs: { up: "Speak up, or raise the volume a little.", down: "Bring the volume down a little." },
  loudnessRange: { up: "Vary your voice more: lift the words that matter.", down: "Keep your volume more even." },
  hookLoudnessDelta: { up: "Open with more energy than the rest of the video.", down: "Open at the same energy as the rest." },
  textWordsPerFrame: { up: "Put more words on screen: captions help.", down: "Put fewer words on screen at once." },
  textFrameShare: { up: "Keep text on screen for more of the video: add captions.", down: "Show text for less of the video." },
  textHook: { up: "Put words on screen in the first two seconds.", down: "Keep the first two seconds clear of text." },
  brightness: { up: "Film somewhere brighter, or face a window.", down: "Film somewhere a little softer-lit." },
  saturation: { up: "Add color: a brighter shirt or background.", down: "Tone the colors down." },
  speechWps: { up: "Talk a little faster.", down: "Slow down a little." },
  firstWordSec: { up: "Take a beat before your first word.", down: "Start talking right away." },
  wordsHook: { up: "Say more in the first two seconds.", down: "Say less in the first two seconds: let it land." },
  speechShare: { up: "Keep talking: fewer silent stretches.", down: "Leave a little room between lines." },
  durationSec: { up: "Make it a little longer.", down: "Make it shorter." },
  titleWords: { up: "Use a longer title.", down: "Use a shorter title." },
  titleQuestion: { up: "Ask a question in the title.", down: "State the title instead of asking it." },
  titleNumber: { up: "Put a number in the title.", down: "Leave the number out of the title." },
  titleCapsRun: { up: "Put a word or two of the title in capitals.", down: "Drop the all-caps from the title." },
  titleEmoji: { up: "Add an emoji to the title.", down: "Drop the emoji from the title." },
  likeRate: { up: "Ask viewers to like it.", down: "Likes are not the gap: this already draws more per view than the outperformers." },
  commentRate: { up: "End on a question viewers can answer in the comments.", down: "Comments are not the gap: this already draws more per view than the outperformers." },
}

/** Always renders. Each off-mode feature reads twice: what to do, for the volunteer, and where this short
 *  sits against the outperformers, for the staffer coaching them. These compare; the recommendation
 *  registry holds no measured lift for them yet, so none is a tested cause. A short on the mode
 *  everywhere reads "No change recommended." */
export function Recommendations({ rows, unlock }: { rows: Ingredient[] | null; unlock: { what: string; href?: string }[] }) {
  const off = (rows ?? []).filter((r) => r.band !== "On mode")
  return (
    <div className="@container flex flex-col gap-3">
      {rows && !off.length && <p className="text-sm font-medium text-slate-900">No change recommended.</p>}
      {off.length > 0 && (
        <ul className="grid gap-3 @xl:grid-cols-2">
          {off.map((r) => {
            const label = axisLabel(r.axis).replace(/^./, (c) => c.toUpperCase())
            const plain = PLAIN[r.axis]?.[r.center > r.video ? "up" : "down"]
            return (
              <li key={r.axis} className="flex flex-col gap-1 rounded-xl border border-slate-200/80 px-3.5 py-3">
                <span className="text-xs font-medium text-slate-500">{label}</span>
                {plain && <span className="text-[15px] font-medium leading-snug text-slate-900">{plain}</span>}
                <span className="text-xs leading-snug text-slate-500">
                  <span className="font-semibold text-slate-600">Coach: </span>
                  this short sits at the {ordinal(r.video)} percentile of its channel; shorts that outperformed 3x center at the {ordinal(r.center)}.
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {off.length > 0 && <p className="text-xs text-slate-400">Comparisons with shorts that outperformed 3x; none is yet a tested cause.</p>}
      {!rows && <p className="text-sm text-slate-600">No production read yet.</p>}
      <UnlockList actions={unlock} />
    </div>
  )
}
