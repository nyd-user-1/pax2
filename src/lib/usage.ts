import "server-only"

import { now, putOnce, query, type Item } from "@/lib/ledger"

// The platform usage log, requirement 11: what readers do on PAX2, one ledger row per act.
//
//   pk                   sk                      item
//   USAGE#<yyyy-mm-dd>   <iso>#<4 random chars>  kind, subject, meta, who
//
// `who` is the signed-in email, or the anonymous id the browser keeps under pax2-reader.
// Written by src/app/usage-actions.ts; read back here by day partition, server-side only, since a
// row names its reader.

export const USAGE_KINDS = ["open", "play", "watched75", "search", "filter", "sort", "boost", "bookmark", "share", "queue"] as const
export type UsageKind = (typeof USAGE_KINDS)[number]
export type UsageEvent = Item & { at: string; kind: UsageKind; subject: string; meta?: Record<string, unknown>; who: string }

export async function writeUsage(kind: UsageKind, subject: string, who: string, meta?: Record<string, unknown>) {
  const at = now()
  await putOnce({ pk: `USAGE#${at.slice(0, 10)}`, sk: `${at}#${Math.random().toString(36).slice(2, 6)}`, at, kind, subject, meta, who })
}

/** Every usage row from the last `days` days, today included, oldest first. */
export async function usageSince(days: number): Promise<UsageEvent[]> {
  const today = Date.now()
  const parts = Array.from({ length: Math.max(1, days) }, (_, i) => new Date(today - i * 864e5).toISOString().slice(0, 10))
  const rows = (await Promise.all(parts.map((d) => query<UsageEvent>(`USAGE#${d}`)))).flat()
  const from = new Date(today - days * 864e5).toISOString()
  return rows.filter((r) => r.at >= from).sort((a, b) => a.at.localeCompare(b.at))
}
