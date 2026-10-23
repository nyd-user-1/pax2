import "server-only"

import { readFileSync } from "node:fs"
import { join } from "node:path"

import upworthy from "../../data/generated/upworthy-top.json"
import wesleyan from "../../data/generated/wesleyan-meta-2022.json"
import maps from "../../data/generated/campaign-maps.json"
import { referenceModelFile } from "@/lib/data-files"
import { CAMPAIGN_FAMILY, organicEvidence } from "@/lib/organic-evidence"
import type { CatalogWhy } from "@/components/scripts/script-catalog"

// What a script may lean on, from the four bodies of evidence the /scripts library is written from:
// Swayable's randomized ad tests (what moved vote choice and favorability), Upworthy's randomized
// headline tests (what opened a story), Wesleyan's coding of 2022 Meta ads (what every other campaign
// ran — description, not effect), and the within-channel lifts on the reform channels we track. Plus
// the facts a script may state: the only numbers it may use. Every item has an id; a writer cites the
// ids it used and the Citations panel renders them the way /scripts renders its own.

export type Evidence = { id: string; kind: "swayable" | "upworthy" | "wesleyan" | "channels" | "fact"; prompt: string; cite: Omit<CatalogWhy, "line" | "note"> & { finding: string } }

const pts = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`
const SWAYABLE = { label: "Swayable archive, 617 tested ads", href: "/library/swayable-archive" }
const UPWORTHY = { label: "Upworthy archive, 32,487 headline tests", href: "/library/upworthy-archive" }
const WESLEYAN = { label: "Wesleyan Media Project, Meta 2022 ads", href: "/library/wesleyan-codebook" }
const CHANNELS = { label: "Reform channels' shorts", href: "/library/yt-reform-shorts" }

function swayable(): Evidence[] {
  const RM = referenceModelFile() as unknown as { featureLabels: Record<string, string>; outcomes: Record<string, { ads: number; features: { key: string; diff: number; low: number; high: number }[] }> }
  const out: Evidence[] = []
  for (const outcome of ["votechoice", "favorability"] as const) {
    const o = RM.outcomes[outcome]
    for (const f of o?.features ?? []) {
      if (!(f.low > 0 || f.high < 0)) continue
      const label = RM.featureLabels[f.key] ?? f.key
      const name = outcome === "votechoice" ? "vote choice" : "favorability"
      const finding = `In ${o.ads} Swayable-tested ads, “${label}” moved ${name} ${pts(f.diff)} points (${f.low.toFixed(1)} to ${f.high.toFixed(1)}).`
      out.push({ id: `swayable:${f.key}:${outcome}`, kind: "swayable", prompt: finding, cite: { finding, research: { label, diff: f.diff, low: f.low, high: f.high, ads: o.ads, outcome }, channel: null, source: SWAYABLE } })
    }
  }
  return out
}

function upworthyItems(): Evidence[] {
  const U = upworthy as unknown as { patterns: { key: string; label: string; won: number; lost: number }[] }
  return U.patterns
    .filter((p) => Math.abs(p.won - p.lost) >= 1)
    .map((p) => {
      const finding = `In Upworthy's headline tests, “${p.label}” appeared in ${p.won}% of winning headlines and ${p.lost}% of losing ones.`
      return { id: `upworthy:${p.key}`, kind: "upworthy" as const, prompt: `${finding} (Use for the hook.)`, cite: { finding, research: null, channel: null, source: UPWORTHY } }
    })
}

function wesleyanItems(): Evidence[] {
  const W = wesleyan as unknown as { ads: number; scope: string; goals: { key: string; adShare: number; spendShare: number }[] }
  const g = Object.fromEntries(W.goals.map((x) => [x.key, x]))
  const finding = `Of ${W.ads.toLocaleString()} pro-Democratic Meta video ads in 2022, Wesleyan coded ${g.persuade?.adShare}% as persuasion and ${g.money?.adShare}% as fundraising. It records what ran, not what worked.`
  return [{ id: "wesleyan:goals-2022", kind: "wesleyan", prompt: `${finding} (Use to keep the script a persuasion piece and apart from what everyone else ran; never as proof that something works.)`, cite: { finding, research: null, channel: null, source: WESLEYAN } }]
}

function channelItems(): Evidence[] {
  const ev = organicEvidence(CAMPAIGN_FAMILY)
  return ev.traits
    .filter((t) => t.direction !== "unclear")
    .map((t) => ({ id: `channels:${t.key}`, kind: "channels" as const, prompt: t.sentence, cite: { finding: t.sentence, research: null, channel: { label: t.label, points: t.points, low: t.low, high: t.high, channels: t.channels, scope: ev.scope }, source: CHANNELS } }))
}

/** The 2022 Massachusetts House: districts whose ballot carried one name, write-ins aside. */
function oneNameDistricts(): { one: number; all: number } | null {
  try {
    const rows = readFileSync(join(process.cwd(), "data/raw/klarner-house-2022-ma-co.csv"), "utf8").trim().split("\n").slice(1)
    const by = new Map<string, number>()
    for (const r of rows) {
      const c = r.split(",").map((x) => x.replace(/^"|"$/g, ""))
      if (c[0] !== "MA" || c[4] === "writein" || c[3] === "scattering") continue
      const k = `${c[1]}|${c[2]}`
      by.set(k, (by.get(k) ?? 0) + 1)
    }
    return { one: [...by.values()].filter((n) => n === 1).length, all: by.size }
  } catch {
    return null
  }
}

function facts(): Evidence[] {
  const out: Evidence[] = []
  const ma = (maps as unknown as { uncontested: Record<string, { races: number; uncontested: number; pct: number }> }).uncontested.MA
  if (ma) {
    const finding = `Massachusetts state legislative general elections, 2014–2022: ${ma.uncontested} of ${ma.races.toLocaleString()} races uncontested (${ma.pct}%).`
    out.push({ id: "fact:uncontested-ma-2014-2022", kind: "fact", prompt: finding, cite: { finding, research: null, channel: null, source: { label: "Uncontested races 2014–2022", href: "/polling" } } })
  }
  const h = oneNameDistricts()
  if (h) {
    const finding = `2022 Massachusetts House general election: ${h.one} of ${h.all} districts had one name on the ballot (write-ins aside).`
    out.push({ id: "fact:ma-house-2022-one-name", kind: "fact", prompt: finding, cite: { finding, research: null, channel: null, source: { label: "Massachusetts House returns 2022", href: "/library/ma-house-2022" } } })
  }
  return out
}

let cache: Evidence[] | null = null
export function scriptEvidence(): Evidence[] {
  return (cache ??= [...swayable(), ...upworthyItems(), ...wesleyanItems(), ...channelItems(), ...facts()])
}

/** One body of evidence as prompt lines, each under its id. */
export function evidenceLines(kind: Evidence["kind"]): string {
  return scriptEvidence().filter((e) => e.kind === kind).map((e) => `- [${e.id}] ${e.prompt}`).join("\n")
}

/** The evidence as the writer reads it, each line under its id. */
export function evidencePrompt(): string {
  const by = evidenceLines
  return `EVIDENCE — what a script may lean on. Each line carries its id.
Swayable, randomized tests of 617 political ads (what moved vote choice and favorability):
${by("swayable")}
Upworthy, randomized headline tests (what opened a story; apply to the hook):
${by("upworthy")}
Wesleyan, coding of 2022 Meta ads (what other campaigns ran):
${by("wesleyan")}
The reform channels PAX2 tracks (within-channel lifts):
${by("channels")}
FACTS — the only numbers a script may state. A number not listed here never goes in a script:
${by("fact")}`
}
