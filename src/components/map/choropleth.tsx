"use client"

import * as React from "react"
import Map, { Layer, Source, type MapLayerMouseEvent } from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"

import { cn } from "@/ui/lib/utils"

// GovBlock's map stack: MapLibre over OpenFreeMap's positron basemap (no key, OSM data under
// ODbL), geometry from GovBlock's public geo bucket. Values join on one feature property.

const BASEMAP = "https://tiles.openfreemap.org/styles/positron"

export type MapProps = {
  geo: string
  joinOn: string
  values: Record<string, { color: string; title: string; lines: string[] }>
  view: { longitude: number; latitude: number; zoom: number }
  height?: number | string
  className?: string
  legend?: React.ReactNode
  /** Inside a MapBlock: no card shell of its own. */
  bare?: boolean
}

export function Choropleth({ geo, joinOn, values, view, height = 460, className, legend, bare }: MapProps) {
  const [data, setData] = React.useState<GeoJSON.FeatureCollection | null>(null)
  const [failed, setFailed] = React.useState(false)
  const [hover, setHover] = React.useState<{ x: number; y: number; key: string } | null>(null)
  // Shapes load once per file; switching what the map shows only recolors them.
  const [raw, setRaw] = React.useState<GeoJSON.FeatureCollection | null>(null)
  React.useEffect(() => {
    let alive = true
    fetch(geo)
      .then((r) => r.json())
      .then((fc: GeoJSON.FeatureCollection) => alive && setRaw(fc))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [geo])
  React.useEffect(() => {
    if (!raw) return
    setData({
      ...raw,
      features: raw.features.map((f, i) => {
        const key = String(f.properties?.[joinOn] ?? "")
        return { ...f, id: i, properties: { ...f.properties, _key: key, _color: values[key]?.color ?? "#e5e7eb" } }
      }),
    })
  }, [raw, joinOn, values])
  const onMove = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    setHover(f ? { x: e.point.x, y: e.point.y, key: String(f.properties?._key) } : null)
  }
  const h = hover && values[hover.key]
  return (
    <div className={cn(bare ? "rounded-xl" : "surface", "relative overflow-hidden", className)} style={{ height }}>
      <Map
        initialViewState={view}
        mapStyle={BASEMAP}
        interactiveLayerIds={["fill"]}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        cursor={hover ? "pointer" : "grab"}
        attributionControl={{ compact: true }}
        style={{ width: "100%", height: "100%" }}
      >
        {data && (
          <Source id="areas" type="geojson" data={data}>
            <Layer id="fill" type="fill" paint={{ "fill-color": ["get", "_color"], "fill-opacity": 0.78, "fill-opacity-transition": { duration: 700 } }} />
            <Layer id="line" type="line" paint={{ "line-color": "#ffffff", "line-width": 0.8 }} />
            {hover && <Layer id="hover" type="line" filter={["==", ["get", "_key"], hover.key]} paint={{ "line-color": "#1e3a8a", "line-width": 2.5 }} />}
          </Source>
        )}
      </Map>
      {!data && !failed && <div className="absolute inset-0 animate-pulse bg-slate-100" />}
      {failed && <p className="absolute inset-x-0 top-4 mx-auto w-fit rounded-full bg-white px-3 py-1 text-xs text-pax-red-deep shadow-e1">The map shapes did not load.</p>}
      {h && hover && (
        <div className="pointer-events-none absolute z-10 w-max max-w-64 rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-e3" style={{ left: Math.min(hover.x + 14, 9999), top: hover.y + 14 }}>
          <p className="font-semibold">{h.title}</p>
          {h.lines.map((l, i) => (
            <p key={i} className="text-white/75">
              {l}
            </p>
          ))}
        </div>
      )}
      {legend && <div className="absolute bottom-3 left-3 rounded-xl bg-white/95 px-3 py-2 text-xs text-slate-600 shadow-e2 backdrop-blur">{legend}</div>}
    </div>
  )
}
