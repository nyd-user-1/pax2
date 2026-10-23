import lift from "../../data/generated/model/vqa-lift.json"
import { ListBlock } from "@/components/blocks"
import type { Census } from "@/components/census-characteristics"
import { referenceModelFile } from "@/lib/data-files"
import { cn } from "@/ui/lib/utils"

// Guidance (Brendan, 2026-10-23): frames, formats, messengers and messages likely to work, each read off a
// measurement and never inferred. Two sources, kept in their own units because they measure different
// outcomes:
//   Swayable's randomized tests (data/generated/model/reference-model.json): the shift in vote choice, in
//     points, for ads with a trait over ads without it, with its 90% range;
//   the frame census's lifts (data/generated/model/vqa-lift.json): the change, in points, in the share of
//     shorts that outperformed 3x their channel median, within channel, with its 90% range.
// Per category: what this short carries (its Swayable codes and its census), the option with the largest
// shift whose range stays above zero, from each source, and anything it carries whose range stays below
// zero. An option whose range crosses zero is not offered. Messengers read only counts and screen share
// (no demographic inference) and the coded messenger types of Swayable's labeled study.

type Category = "Frame" | "Format" | "Messenger" | "Message"
type Option = { key: string; label: string; points: number; low: number; high: number; source: "swayable" | "census"; has: boolean }

const CATEGORIES: Category[] = ["Frame", "Format", "Messenger", "Message"]

/** Swayable's traits by category. how_scripted waits on its recode. */
const swayableCategory = (key: string): Category | null =>
  key === "how_scripted"
    ? null
    : key.startsWith("messenger_") || key === "technique_pos_testimonial" || key === "technique_neg_testimonial"
      ? "Messenger"
      : key.startsWith("tone_") || key.startsWith("emotion_") || key.startsWith("technique_")
        ? "Frame"
        : key.startsWith("style_") || key.startsWith("production_")
          ? "Format"
          : key.startsWith("narration_") || key.startsWith("fact_") || key === "policy_facts" || key === "explicit_vote_for"
            ? "Message"
            : null

/** The census's lifts by category; the rest (captions, watermark, product) are not one of the four. */
const censusCategory = (key: string): Category | null =>
  key.startsWith("format:") || key.startsWith("setting:") ? "Format" : key === "personMostFrames" ? "Messenger" : key === "callToAction" || key === "ctaInHook" ? "Message" : null

/** What to do, in plain words, for the options measured to work. */
const DO: Record<string, string> = {
  technique_plain_folks: "Speak as an ordinary person, in ordinary words, about everyday stakes.",
  explicit_vote_for: "Ask the viewer, in so many words, to vote for it.",
  "format:b-roll": "Cut to footage of the thing being talked about.",
  "format:news clip": "Build on a news clip.",
  personMostFrames: "Keep a person on screen for at least half the video.",
}

const UNIT = { swayable: "pts vote choice, Swayable's randomized tests", census: "pts of shorts outperforming 3x, within channel" }
/** Swayable's shifts in hundredths, the census's lifts in tenths, as each source reports them. */
const pts = (x: number, source: Option["source"]) => `${x > 0 ? "+" : ""}${x.toFixed(source === "swayable" ? 2 : 1)}`

type LiftRow = { key: string; label: string; points?: number; low?: number; high?: number }
type Feature = { key: string; label: string; diff: number; low: number; high: number }

export function GuidanceBlock({ codes, census }: { codes?: string[] | null; census: Census | null }) {
  const model = referenceModelFile()
  const features = (model.outcomes.votechoice.features as Feature[]) ?? []
  const carried = new Set(codes ?? [])
  const censusHas = (key: string) =>
    !!census &&
    (key === `format:${census.format}` || key === `setting:${census.setting}` || (key === "personMostFrames" && census.peopleScreenShare >= 0.5) || (key === "callToAction" && !!census.callToAction) || (key === "ctaInHook" && census.ctaSec != null && census.ctaSec <= 3))
  const options: (Option & { category: Category })[] = [
    ...features.flatMap((f) => {
      const category = swayableCategory(f.key)
      return category ? [{ category, key: f.key, label: f.label, points: f.diff, low: f.low, high: f.high, source: "swayable" as const, has: carried.has(f.key) }] : []
    }),
    ...(lift as { rows: LiftRow[] }).rows.flatMap((r) => {
      const category = censusCategory(r.key)
      return category && r.points != null && r.low != null && r.high != null ? [{ category, key: r.key, label: r.label, points: r.points, low: r.low, high: r.high, source: "census" as const, has: censusHas(r.key) }] : []
    }),
  ]
  const known = { swayable: !!codes?.length, census: !!census }

  return (
    <ListBlock title="Guidance">
      <div className="@container flex flex-col divide-y divide-slate-100">
        {CATEGORIES.map((c) => {
          const mine = options.filter((o) => o.category === c)
          const has = mine.filter((o) => o.has)
          // The best option above zero from each source, and anything carried that is measured against.
          const best = (["swayable", "census"] as const).flatMap((s) => mine.filter((o) => o.source === s && o.low > 0).sort((a, b) => b.points - a.points).slice(0, 1))
          const against = has.filter((o) => o.high < 0)
          return (
            <div key={c} data-find className="grid gap-x-6 gap-y-2 py-4 @3xl:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1.6fr)]">
              <span className="text-sm font-semibold text-slate-900">{c}</span>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">This short</span>
                <span className="text-sm text-slate-700">{has.length ? has.map((o) => o.label).join(", ") : known.swayable || known.census ? "None of the measured traits" : "Not coded yet"}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {best.length ? (
                  best.map((o) => (
                    <div key={o.key} className="flex flex-col gap-0.5">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-medium text-slate-900">{o.label}</span>
                        <span className="tabular text-sm font-semibold text-above">{pts(o.points, o.source)}</span>
                        <span className="tabular text-xs text-slate-400">
                          ({pts(o.low, o.source)} to {pts(o.high, o.source)}) {UNIT[o.source]}
                        </span>
                      </span>
                      <span className={cn("text-[13px] leading-snug", o.has ? "text-slate-500" : "text-slate-700")}>{o.has ? "This short already does it." : (DO[o.key] ?? `Try ${o.label.toLowerCase()}.`)}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-[13px] text-slate-500">No option measured above zero yet.</span>
                )}
                {against.map((o) => (
                  <span key={o.key} className="text-[13px] leading-snug text-below">
                    Measured against: {o.label} {pts(o.points, o.source)} ({pts(o.low, o.source)} to {pts(o.high, o.source)}) {UNIT[o.source]}.
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </ListBlock>
  )
}
