import ma from "../../../data/generated/ma-house-2022.json"
import spend from "../../../data/generated/reform-ad-spend.json"
import { Choropleth } from "@/components/map/choropleth"
import { GEO } from "@/lib/geo"

const swatch = (c: string) => <span className="inline-block size-2.5 rounded-sm" style={{ background: c }} />

/** Massachusetts House districts by how many names were on the 2022 general-election ballot. */
export function UncontestedMap() {
  const d = (ma as unknown as { districts: Record<string, number> }).districts
  const values = Object.fromEntries(
    Object.entries(d).map(([name, n]) => [
      name,
      { color: n <= 1 ? "#dc2626" : n === 2 ? "#93c5fd" : "#2563eb", title: `${name} District`, lines: [n <= 1 ? "One name on the 2022 ballot" : `${n} candidates in 2022`] },
    ]),
  )
  const one = Object.values(d).filter((n) => n <= 1).length
  return (
    <Choropleth
      geo={`${GEO}/ma-house.geojson`}
      joinOn="district"
      values={values}
      view={{ longitude: -71.75, latitude: 42.25, zoom: 7.1 }}
      height={440}
      legend={
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-slate-900">
            {one} of {Object.keys(d).length} districts had one name
          </span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">{swatch("#dc2626")} one name</span>
            <span className="flex items-center gap-1">{swatch("#93c5fd")} two</span>
            <span className="flex items-center gap-1">{swatch("#2563eb")} three or more</span>
          </span>
        </div>
      }
    />
  )
}

const money = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${n}`)

/** Where reform advertisers bought Google political ads, by state. */
export function ReformSpendMap() {
  const s = (spend as unknown as { states: Record<string, { total: number; top: [string, number][] }> }).states
  const color = (t: number) => (t >= 1e6 ? "#1e3a8a" : t >= 1e5 ? "#2563eb" : t >= 1e4 ? "#60a5fa" : t >= 1e3 ? "#bfdbfe" : "#eff6ff")
  const tidy = (a: string) => a.replace(/ C\/O .*$/, "").replace(/, SPONSORED BY .*$/i, "").replace(/\b([A-Z]{2,})\b/g, (w) => (w.length > 3 ? w[0] + w.slice(1).toLowerCase() : w))
  const values = Object.fromEntries(Object.entries(s).map(([st, v]) => [st, { color: color(v.total), title: `${st} · ${money(v.total)}`, lines: v.top.map(([a, n]) => `${tidy(a)}: ${money(n)}`) }]))
  return (
    <Choropleth
      geo={`${GEO}/states.geojson`}
      joinOn="code"
      values={values}
      view={{ longitude: -98, latitude: 39, zoom: 2.9 }}
      height={420}
      legend={
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">{swatch("#bfdbfe")} $1K+</span>
          <span className="flex items-center gap-1">{swatch("#60a5fa")} $10K+</span>
          <span className="flex items-center gap-1">{swatch("#2563eb")} $100K+</span>
          <span className="flex items-center gap-1">{swatch("#1e3a8a")} $1M+</span>
        </div>
      }
    />
  )
}
