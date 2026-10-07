import { NextRequest, NextResponse } from "next/server"

import { googleKey, STAND_IN_PLACES } from "@/lib/places"

// Ported from solar (src/app/api/places/geocode/route.ts): a place id to its coordinates.
export async function GET(req: NextRequest) {
  const place_id = req.nextUrl.searchParams.get("place_id")
  if (!place_id) return NextResponse.json({ error: "Missing place_id" }, { status: 400 })

  const standIn = STAND_IN_PLACES.find((p) => p.place_id === place_id)
  if (standIn) return NextResponse.json({ lat: standIn.lat, lng: standIn.lng })

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=geometry&key=${googleKey()}`
  try {
    const res = await fetch(url)
    const data = await res.json()
    const loc = data.result?.geometry?.location
    if (!loc) return NextResponse.json({ error: "Location not found" }, { status: 404 })
    return NextResponse.json({ lat: loc.lat, lng: loc.lng })
  } catch {
    return NextResponse.json({ error: "Geocode failed" }, { status: 500 })
  }
}
