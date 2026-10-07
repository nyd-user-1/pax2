import { NextRequest, NextResponse } from "next/server"

import { googleKey, STAND_IN_DEFAULT, STAND_IN_PLACES } from "@/lib/places"

// Five at most: more than that runs off the top of the chat column.
const MAX = 5

// Ported from solar (src/app/api/places/route.ts): Google Places autocomplete, biased to the
// browser's location. When Google refuses (no key, or billing off) the stand-in addresses answer.
export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams.get("input") ?? ""
  if (input.length < 3) return NextResponse.json([])

  const lat = req.nextUrl.searchParams.get("lat")
  const lng = req.nextUrl.searchParams.get("lng")

  const key = googleKey()
  if (key) {
    let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=address&components=country:us&key=${key}`
    if (lat && lng) url += `&location=${lat},${lng}&radius=80000`
    try {
      const res = await fetch(url)
      const data = (await res.json()) as { status?: string; predictions?: { place_id: string; description: string }[] }
      if (data.status === "OK" || data.status === "ZERO_RESULTS")
        return NextResponse.json((data.predictions ?? []).slice(0, MAX).map((p) => ({ place_id: p.place_id, description: p.description })))
    } catch {
      /* fall through to the stand-ins */
    }
  }

  const words = input.toLowerCase().replace(/\bcolorado\b/g, "co").replace(/\bmassachusetts\b/g, "ma").split(/[^a-z0-9]+/).filter((w) => w.length >= 2)
  const score = (p: (typeof STAND_IN_PLACES)[number]) => {
    const parts = p.description.toLowerCase().split(/[^a-z0-9]+/)
    return words.filter((w) => parts.some((x) => x.startsWith(w))).length
  }
  const hits = STAND_IN_PLACES.map((p) => ({ p, n: score(p) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).map((x) => x.p)
  const list = hits.length ? hits : STAND_IN_DEFAULT.map((id) => STAND_IN_PLACES.find((p) => p.place_id === id)!)
  return NextResponse.json(list.slice(0, MAX).map(({ place_id, description }) => ({ place_id, description })))
}
