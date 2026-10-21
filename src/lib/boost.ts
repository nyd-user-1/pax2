import "server-only"

import { add, get, getMany, put, query, type Item } from "@/lib/ledger"
import { writeUsage } from "@/lib/usage"

// Boost, the reader's explicit positive (requirement 11): stronger than a like, short of a share.
// A toggle writes three places — the reader's current state (BOOSTED#<reader>), the video's running
// count (BOOSTCOUNT#<video id>), and the usage log's audit event — so a card reads one row for its
// count, a reader's rockets stay filled across visits, and the Feed Ranker's labels accrue.

type BoostRow = Item & { on: boolean; at: string }

const bare = (id: string) => id.replace(/^yt-/, "").slice(0, 40)

/** Flip the reader's Boost on a video; returns the new state and the video's new count. */
export async function toggleBoost(videoId: string, who: string): Promise<{ on: boolean; n: number }> {
  const id = bare(videoId)
  const prev = await get<BoostRow>(`BOOSTED#${who}`, id)
  const on = !(prev?.on ?? false)
  await put({ pk: `BOOSTED#${who}`, sk: id, on, at: new Date().toISOString() })
  const n = await add(`BOOSTCOUNT#${id}`, "META", on ? 1 : -1)
  await writeUsage("boost", id, who, { on })
  return { on, n: Math.max(0, n) }
}

/** The video ids the reader currently boosts. */
export async function myBoosts(who: string): Promise<string[]> {
  return (await query<BoostRow>(`BOOSTED#${who}`)).filter((r) => r.on).map((r) => r.sk)
}

/** Boost counts for a set of videos; only videos with at least one boost appear. */
export async function boostCounts(ids: string[]): Promise<Record<string, number>> {
  const keys = [...new Set(ids.map(bare))].slice(0, 500).map((id) => ({ pk: `BOOSTCOUNT#${id}`, sk: "META" }))
  if (!keys.length) return {}
  const rows = await getMany<Item & { n?: number }>(keys)
  const out: Record<string, number> = {}
  for (const r of rows) if (typeof r.n === "number" && r.n > 0) out[r.pk.slice("BOOSTCOUNT#".length)] = r.n
  return out
}
