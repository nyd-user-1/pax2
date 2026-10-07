import { NextRequest, NextResponse } from "next/server"

import houses from "../../../../data/generated/house-districts.json"
import polling from "../../../../data/polling.json"
import { GEO } from "@/lib/geo"

// The address's state House district (GovBlock's district shapes, Massachusetts and Colorado), who
// holds the seat now, and how its last two generals went (2024 from MEDSL, 2022 from Klarner, both
// via GovBlock; see scripts/house-districts.mjs): what /chat's address mode hands the answer, where
// solar handed its rooftop numbers.

type Ring = [number, number][]
type Feature = { properties: { district: string }; geometry: { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] } }
type Race = { election: string; candidates: { name: string; party: string; votes: number; won: boolean }[]; contested: boolean }
type Seat = { members: { name: string; party: string }[]; race: Race | null; previous: Race | null }

const STATES = [
  { code: "MA", file: "ma-house", chamber: "Massachusetts House", label: (d: string) => `${d} District`, key: (d: string) => (d === "Barnstable-Dukes-Nantucket" ? "Barnstable, Dukes and Nantucket" : d) },
  { code: "CO", file: "co-house", chamber: "Colorado House", label: (d: string) => `House District ${d}`, key: (d: string) => d },
] as const

const shapes = new Map<string, Promise<Feature[]>>()
const load = (file: string) => {
  if (!shapes.has(file)) shapes.set(file, fetch(`${GEO}/${file}.geojson`).then((r) => r.json()).then((d: { features: Feature[] }) => d.features))
  return shapes.get(file)!
}

const inRing = (x: number, y: number, ring: Ring) => {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
const inPolygon = (x: number, y: number, rings: Ring[]) => inRing(x, y, rings[0]) && !rings.slice(1).some((h) => inRing(x, y, h))
const contains = (f: Feature, x: number, y: number) => (f.geometry.type === "Polygon" ? inPolygon(x, y, f.geometry.coordinates) : f.geometry.coordinates.some((p) => inPolygon(x, y, p)))

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"))
  const lng = Number(req.nextUrl.searchParams.get("lng"))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: "Missing lat/lng" }, { status: 400 })
  try {
    for (const st of STATES) {
      const hit = (await load(st.file)).find((f) => contains(f, lng, lat))
      if (!hit) continue
      const seat = (houses as unknown as Record<string, Record<string, Seat>>)[st.code][st.key(hit.properties.district)]
      return NextResponse.json({
        state: st.code,
        chamber: st.chamber,
        district: st.label(hit.properties.district),
        members: seat?.members ?? [],
        race: seat?.race ?? null,
        previous: seat?.previous ?? null,
        ...(st.code === "MA" ? { question3: { yes: polling.q3.yes, no: polling.q3.no, undecided: polling.q3.undecided, pollster: polling.q3.pollster } } : {}),
      })
    }
    return NextResponse.json({ district: null, note: "Outside the Massachusetts and Colorado House districts on file" })
  } catch {
    return NextResponse.json({ error: "District lookup failed" }, { status: 500 })
  }
}
