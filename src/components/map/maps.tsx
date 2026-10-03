import ma from "../../../data/generated/ma-house-2022.json"
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
