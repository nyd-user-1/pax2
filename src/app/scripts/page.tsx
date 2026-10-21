import codes from "../../../data/generated/model/script-codes.json"
import model from "../../../data/generated/model/reference-model.json"
import { ScriptCatalog, type CatalogScript } from "@/components/scripts/script-catalog"
import { SCRIPTS } from "@/lib/catalog"
import { board, workspace } from "@/lib/review"

export const dynamic = "force-dynamic"
export const metadata = { title: "Scripts" }

type ChannelLine = { label: string; direction: "lifts" | "sinks"; points: number; low: number; high: number; channels: number; present: boolean; good: boolean; line: number | null; where: string }
type ChannelPattern = { label: string; above: number; below: number; aboveN: number; belowN: number; present: boolean | null }
type Codes = {
  scripts: Record<string, { codes: Record<string, number>; notes: Record<string, string>; prior: Record<string, { expected: number; low: number; high: number; average: number }>; organic?: { lines: ChannelLine[]; patterns: ChannelPattern[] } }>
  organic?: { scope: string; counts: { above: number; below: number } }
}
type Model = { featureLabels: Record<string, string>; outcomes: Record<string, { ads: number; features: { key: string; label?: string; diff: number; low: number; high: number }[] }> }

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/** The catalog a volunteer picks from: every script with the reason for every line, and the evidence behind each reason. */
export default async function ScriptsPage() {
  const ws = await workspace()
  const C = codes as unknown as Codes
  const RM = model as unknown as Model
  const vc = new Map(RM.outcomes.votechoice.features.map((f) => [f.key, f]))
  const { takes } = await board(ws)

  const research = (key: string, outcome: "votechoice" | "favorability") => {
    const o = RM.outcomes[outcome]
    const f = o?.features.find((x) => x.key === key)
    return f ? { label: RM.featureLabels[key] ?? f.label ?? key, diff: f.diff, low: f.low, high: f.high, ads: o.ads, outcome } : null
  }

  const scripts: CatalogScript[] = SCRIPTS.map((s) => {
    const c = C.scripts[s.id]
    const mine = takes.filter((x) => x.take.scriptId === s.id && x.take.captions && !x.take.cut)
    const timed = mine[0]?.take.lines ?? []
    const paras = s.text.split("\n").filter((l) => l.trim())
    const scored = mine.filter((x) => x.latest?.score.value != null)
    return {
      id: s.id,
      title: s.title,
      approach: s.approach,
      framing: s.framing,
      provenance: s.source,
      text: s.text,
      lines: paras.map((text, i) => ({ text, t: timed[i]?.t ?? null })),
      words: s.words,
      seconds: mine.length ? Math.round(mean(mine.map((x) => x.take.durationSec))!) : s.seconds,
      average: mean(scored.map((x) => x.latest!.score.value!)),
      averageLow: mean(scored.map((x) => x.latest!.score.low ?? x.latest!.score.value!)),
      averageHigh: mean(scored.map((x) => x.latest!.score.high ?? x.latest!.score.value!)),
      voices: mine.map((x) => ({ id: x.take.id, voice: x.take.voice, score: x.latest?.score.value ?? null, low: x.latest?.score.low ?? null, high: x.latest?.score.high ?? null })),
      prior: c?.prior.votechoice ?? null,
      features: Object.entries(c?.codes ?? {})
        .filter(([, v]) => v >= 0.5)
        .map(([k]) => ({ k, f: vc.get(k) }))
        .filter((x) => x.f)
        .sort((a, b) => Math.abs(b.f!.diff) - Math.abs(a.f!.diff))
        .slice(0, 5)
        .map(({ k, f }) => ({ label: RM.featureLabels[k], diff: f!.diff, sign: (f!.low > 0 ? "up" : f!.high < 0 ? "down" : "flat") as "up" | "down" | "flat", note: c.notes[k] })),
      why: [
        ...s.why.map((w) => ({ line: w.line, note: w.note, research: w.research ? research(w.research, w.outcome ?? "votechoice") : null, source: w.source ?? null, channel: null })),
        ...(c?.organic?.lines ?? [])
          .filter((l) => l.line != null)
          .map((l) => ({ line: l.line!, note: "", research: null, source: null, channel: { label: l.label, points: l.points, low: l.low, high: l.high, channels: l.channels, scope: C.organic?.scope ?? "these channels" } })),
      ].sort((a, b) => a.line - b.line),
      channels: c?.organic && C.organic ? { scope: C.organic.scope, counts: C.organic.counts, lines: c.organic.lines, patterns: c.organic.patterns } : null,
    }
  })

  return <ScriptCatalog scripts={scripts} solo />
}
