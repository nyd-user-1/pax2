"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"

import maps from "../../../data/generated/campaign-maps.json"
import { Choropleth } from "@/components/map/choropleth"
import { GEO } from "@/lib/geo"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/components/nova/dropdown-menu"

type Spend = Record<string, { total: number; top: [string, number][] }>
type Unc = Record<string, { races: number; uncontested: number; pct: number }>
type Value = { color: string; title: string; lines: string[] }
type Mode = { id: string; label: string; values?: Record<string, Value>; legend?: [string, string][]; note?: string; none?: string }

const money = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${n}`)
const BLUES: [string, string][] = [["#bfdbfe", "$1K+"], ["#60a5fa", "$10K+"], ["#2563eb", "$100K+"], ["#1e3a8a", "$1M+"]]
const blue = (t: number) => (t >= 1e6 ? BLUES[3][0] : t >= 1e5 ? BLUES[2][0] : t >= 1e4 ? BLUES[1][0] : t >= 1e3 ? BLUES[0][0] : "#eff6ff")
const REDS: [string, string][] = [["#fee2e2", "Under 20%"], ["#fca5a5", "20–35%"], ["#ef4444", "35–50%"], ["#991b1b", "50%+"]]
const red = (p: number) => (p >= 50 ? REDS[3][0] : p >= 35 ? REDS[2][0] : p >= 20 ? REDS[1][0] : REDS[0][0])

const spendValues = (s: Spend): Record<string, Value> =>
  Object.fromEntries(Object.entries(s).map(([st, v]) => [st, { color: blue(v.total), title: `${st} · ${money(v.total)}`, lines: v.top.map(([a, n]) => `${a}: ${money(n)}`) }]))

const SPEND_NOTE = "Google Political Ads Transparency via GovBlock: lifetime spend by state, reported in $100 steps."

const MODES: Mode[] = [
  { id: "all", label: "Google ads: every reform group", values: spendValues(maps.spendAll as unknown as Spend), legend: BLUES, note: `${SPEND_NOTE} “Vote YES on 3” in Google's data is Nevada's Question 3, not Massachusetts'.` },
  { id: "unite", label: "Google ads: Unite America", values: spendValues(maps.spendUnite as unknown as Spend), legend: BLUES, note: `${SPEND_NOTE} Unite America's three advertiser accounts combined.` },
  { id: "open", label: "Google ads: Open Primaries", values: spendValues(maps.spendOpen as unknown as Spend), legend: BLUES, note: SPEND_NOTE },
  {
    id: "uncontested",
    label: "Uncontested legislative races",
    values: Object.fromEntries(
      Object.entries(maps.uncontested as unknown as Unc).map(([st, u]) => [st, { color: red(u.pct), title: `${st} · ${u.pct}% uncontested`, lines: [`${u.uncontested.toLocaleString()} of ${u.races.toLocaleString()} races, 2014–2022`] }]),
    ),
    legend: REDS,
    note: "State legislative general elections 2014–2022, single-seat districts with one name or none on the ballot. Klarner returns via GovBlock.",
  },
  { id: "yes3", label: "Google ads: Vote YES on 3 (MA)", none: "None on file" },
  { id: "cocourage", label: "Google ads: Courageous Colorado", none: "None on file" },
]

/** The campaigns' ground: where reform money went on Google, and where races go uncontested. */
export function CampaignMap() {
  const [id, setId] = React.useState("all")
  const mode = MODES.find((m) => m.id === id)!
  return (
    <section className="flex flex-col gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex w-fit items-center gap-2 rounded-lg font-display text-xl text-slate-900 outline-none hover:text-pax-ink">
          {mode.label}
          <ChevronDown className="size-5 text-slate-400" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-max min-w-44 rounded-2xl p-1.5 shadow-e3">
          {MODES.map((m) => (
            <DropdownMenuItem key={m.id} disabled={!!m.none} onClick={() => setId(m.id)} className="flex items-center justify-between gap-8 whitespace-nowrap rounded-xl px-3 py-2 text-sm">
              <span>{m.label}</span>
              {m.none ? <span className="text-xs text-slate-400">{m.none}</span> : id === m.id ? <Check className="size-4 text-pax-plum" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Choropleth
        geo={`${GEO}/states.geojson`}
        joinOn="code"
        values={mode.values!}
        view={{ longitude: -98, latitude: 39, zoom: 2.9 }}
        height={420}
        legend={
          <div className="flex items-center gap-3">
            {mode.legend!.map(([c, l]) => (
              <span key={l} className="flex items-center gap-1">
                <span className="inline-block size-2.5 rounded-sm" style={{ background: c }} /> {l}
              </span>
            ))}
          </div>
        }
      />
      <p className="text-xs text-slate-400">{mode.note}</p>
    </section>
  )
}
