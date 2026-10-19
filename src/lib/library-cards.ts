import "server-only"

import codes from "../../data/generated/model/script-codes.json"
import type { CardData } from "@/components/record/library-card"
import { SCRIPTS } from "@/lib/catalog"
import { board, workspace } from "@/lib/review"

type Codes = { scripts: Record<string, { prior: Record<string, { expected: number; average: number }> }> }

/** The library's script cards: each script with how its recordings have scored and how ads in its style moved vote choice. */
export async function libraryCards(): Promise<CardData[]> {
  const { takes } = await board(await workspace())
  const C = codes as unknown as Codes
  return SCRIPTS.map((s) => {
    const scored = takes.filter((t) => t.take.scriptId === s.id && t.latest?.score.value != null)
    const best = scored.length ? Math.max(...scored.map((t) => t.latest!.score.value!)) : null
    const prior = C.scripts[s.id]?.prior.votechoice
    const notes: CardData["notes"] = []
    if (best != null) notes.push({ label: `Recorded ${scored.length} times so far · best Resonance ${best.toFixed(0)}`, tone: best >= 60 ? "good" : best < 40 ? "caution" : "neutral" })
    else notes.push({ label: "Not yet recorded with paid results", tone: "neutral" })
    if (prior) notes.push({ label: `Ads in this style moved vote choice about ${prior.expected.toFixed(1)} pts in tested campaigns (average ${prior.average.toFixed(1)})`, tone: "neutral" })
    return { id: s.id, title: s.title, framing: s.framing, structure: s.structure, method: s.method, text: s.text, seconds: Math.round((s.words / 130) * 60), place: "Massachusetts", notes }
  })
}
