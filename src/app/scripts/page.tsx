import Link from "next/link"
import { PenLine, Video } from "lucide-react"

import polling from "../../../data/polling.json"
import codes from "../../../data/generated/model/script-codes.json"
import model from "../../../data/generated/model/reference-model.json"
import { ScriptCatalog, type CatalogScript } from "@/components/scripts/script-catalog"
import { SCRIPTS } from "@/lib/catalog"
import { board, workspace } from "@/lib/review"

export const dynamic = "force-dynamic"
export const metadata = { title: "Scripts" }

type Codes = { scripts: Record<string, { codes: Record<string, number>; notes: Record<string, string>; prior: Record<string, { expected: number; low: number; high: number; average: number }> }> }
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
      why: s.why.map((w) => ({ line: w.line, note: w.note, research: w.research ? research(w.research, w.outcome ?? "votechoice") : null, source: w.source ?? null })),
    }
  })

  return (
    <div className="flex flex-col gap-10">
      <header className="rise flex flex-wrap items-end justify-between gap-4 md:pt-9">
        <h1 className="font-display text-3xl text-slate-900 md:text-[34px]">Scripts</h1>
        <div className="flex items-center gap-2">
          <Link href="/record/personal" className="press inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-pax-ink shadow-e1">
            <PenLine className="size-4" /> New
          </Link>
          <Link href="/record" className="press inline-flex items-center gap-2 rounded-full bg-pax-ink px-5 py-2.5 text-sm font-semibold text-white shadow-e2">
            <Video className="size-4" /> Record
          </Link>
        </div>
      </header>

      <ScriptCatalog
        scripts={scripts}
        opposition={{
          items: ["A top-two primary can leave two candidates of the same party in November", "Favors candidates who can fund their own campaigns", "Squeezes out third parties"],
          note: "Both state parties and the AFL-CIO oppose Question 3; supporters include officials of both parties and the NAACP.",
          href: "https://www.wbur.org/news/2026/09/28/massachusetts-ballot-question-3-backers-supporters",
        }}
        settle={`No public poll tests which of these arguments wins — the only topline is ${polling.q3.yes}–${polling.q3.no} with ${polling.q3.undecided}% undecided. Recording them is how it gets settled.`}
      />
    </div>
  )
}
