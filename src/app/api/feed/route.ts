import { NextResponse, type NextRequest } from "next/server"

import { feedIndex } from "@/lib/feed-data"
import { queryFeed } from "@/lib/feed-query"

// The feed, paged and searched server-side over the full index (19,057 videos as of 2026-10-22):
// GET /api/feed?q=&channel=&tag=&sort=key:dir,key:dir&cursor=0&limit=48
// Returns { videos, total, nextCursor }. The index sits in module scope, so after the first
// request a query is an in-memory filter — the response is the network's time, not the data's.

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams
  const out = queryFeed(feedIndex(), {
    q: p.get("q") ?? undefined,
    channel: p.get("channel") ?? undefined,
    tag: p.get("tag") ?? undefined,
    sort: p.get("sort") ?? undefined,
    cursor: Number(p.get("cursor") ?? 0) || 0,
    limit: Number(p.get("limit") ?? 48) || 48,
  })
  return NextResponse.json(out, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } })
}
