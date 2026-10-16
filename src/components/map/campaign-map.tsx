"use client"

import * as React from "react"

import maps from "../../../data/generated/campaign-maps.json"
import { MapBlock } from "@/components/blocks"
import { Choropleth } from "@/components/map/choropleth"
import { GEO } from "@/lib/geo"
import { cn } from "@/ui/lib/utils"

type Spend = Record<string, { total: number; top: [string, number][] }>
type Unc = Record<string, { races: number; uncontested: number; pct: number }>
type Value = { color: string; title: string; lines: string[] }
type Mode = { id: string; label: string; short: string; values?: Record<string, Value>; legend?: [string, string][]; note?: string; none?: string }

const money = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${n}`)
const BLUES: [string, string][] = [["#bfdbfe", "$1K+"], ["#60a5fa", "$10K+"], ["#2563eb", "$100K+"], ["#1e3a8a", "$1M+"]]
const blue = (t: number) => (t >= 1e6 ? BLUES[3][0] : t >= 1e5 ? BLUES[2][0] : t >= 1e4 ? BLUES[1][0] : t >= 1e3 ? BLUES[0][0] : "#eff6ff")
const REDS: [string, string][] = [["#fee2e2", "Under 20%"], ["#fca5a5", "20–35%"], ["#ef4444", "35–50%"], ["#991b1b", "50%+"]]
const red = (p: number) => (p >= 50 ? REDS[3][0] : p >= 35 ? REDS[2][0] : p >= 20 ? REDS[1][0] : REDS[0][0])

const spendValues = (s: Spend): Record<string, Value> =>
  Object.fromEntries(Object.entries(s).map(([st, v]) => [st, { color: blue(v.total), title: `${st} · ${money(v.total)}`, lines: v.top.map(([a, n]) => `${a}: ${money(n)}`) }]))

const SPEND_NOTE = "Google Political Ads Transparency via GovBlock: lifetime spend by state, reported in $100 steps."

const MODES: Mode[] = [
  { id: "all", label: "Google ads", short: "All", values: spendValues(maps.spendAll as unknown as Spend), legend: BLUES },
  { id: "unite", label: "Google ads: Unite America", short: "Unite America", values: spendValues(maps.spendUnite as unknown as Spend), legend: BLUES, note: `${SPEND_NOTE} Unite America's three advertiser accounts combined.` },
  { id: "open", label: "Google ads: Open Primaries", short: "Open Primaries", values: spendValues(maps.spendOpen as unknown as Spend), legend: BLUES, note: SPEND_NOTE },
  {
    id: "uncontested",
    label: "Uncontested legislative races",
    short: "Uncontested",
    values: Object.fromEntries(
      Object.entries(maps.uncontested as unknown as Unc).map(([st, u]) => [st, { color: red(u.pct), title: `${st} · ${u.pct}% uncontested`, lines: [`${u.uncontested.toLocaleString()} of ${u.races.toLocaleString()} races, 2014–2022`] }]),
    ),
    legend: REDS,
    note: "State legislative general elections 2014–2022, single-seat districts with one name or none on the ballot. Klarner returns via GovBlock.",
  },
  { id: "yes3", label: "Google ads: Vote YES on 3 (MA)", short: "Yes on 3", none: "None on file" },
  { id: "cocourage", label: "Google ads: Courageous Colorado", short: "Courageous Colorado", none: "None on file" },
]

/** The campaigns' ground: where reform money went on Google, and where races go uncontested. */
export function CampaignMap() {
  const [id, setId] = React.useState("all")
  const mode = MODES.find((m) => m.id === id)!
  return (
    <MapBlock
      title={mode.label}
      id="campaign-map"
      rows={Object.entries(mode.values ?? {}).map(([state, v]) => ({ state, value: v.title, detail: v.lines.join("; ") }))}
      name={`campaign-map-${mode.id}`}
      views={MODES.filter((m) => !m.none).map((m) => ({ value: m.id, label: m.label }))}
      view={id}
      onView={setId}
      actions={
        <div className="flex rounded-lg bg-muted p-0.5 text-xs">
          {MODES.map((m) => (
            <button key={m.id} type="button" disabled={!!m.none} title={m.none ? `${m.label}: ${m.none}` : m.label} onClick={() => setId(m.id)} className={cn("rounded-md px-2.5 py-1 whitespace-nowrap disabled:opacity-40", id === m.id ? "bg-white font-medium shadow-e1" : "text-slate-800")}>
              {m.short}
            </button>
          ))}
        </div>
      }
    >
      <div className="flex h-full flex-col gap-2">
        <Choropleth
          geo={`${GEO}/states.geojson`}
          joinOn="code"
          values={mode.values!}
          view={{ longitude: -98, latitude: 39, zoom: 2.9 }}
          height="auto"
          bare
          className="min-h-0 flex-1"
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
        {mode.note && <p className="text-xs text-slate-400">{mode.note}</p>}
      </div>
    </MapBlock>
  )
}
