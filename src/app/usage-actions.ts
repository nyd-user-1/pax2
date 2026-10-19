"use server"

import { currentUser } from "@/lib/auth"
import { USAGE_KINDS, usageSince as since, writeUsage, type UsageKind } from "@/lib/usage"

// What a reader does on PAX2, from the browser to the ledger (src/lib/usage.ts). The reader is the
// session's email when signed in; otherwise the anonymous id the browser sends.

export async function logUsage(kind: UsageKind, subject: string, meta?: Record<string, unknown>, reader?: string) {
  if (!USAGE_KINDS.includes(kind)) return
  const user = await currentUser()
  const who = user?.email ?? (reader && /^r-[a-z0-9]{6,16}$/.test(reader) ? reader : "anonymous")
  const m = meta && JSON.stringify(meta).length <= 1000 ? meta : undefined
  await writeUsage(kind, String(subject).slice(0, 200), who, m)
}

/** The signed-in reader's own opens and plays, or the anonymous browser's by its reader id, over the
 *  last `days` days, for the For you sort's affinity term. */
export async function myUsageSince(days: number, reader?: string) {
  const user = await currentUser()
  const who = user?.email ?? (reader && /^r-[a-z0-9]{6,16}$/.test(reader) ? reader : null)
  if (!who) return []
  return (await since(Math.min(90, Math.max(1, days)))).filter((e) => e.who === who && (e.kind === "open" || e.kind === "play")).map((e) => ({ kind: e.kind, subject: e.subject, at: e.at }))
}

/** The opens and plays of the last `days` days, without who did them, for a signed-in reader's
 *  For you sort (src/lib/feed-rank.ts). */
export async function usageSince(days: number) {
  if (!(await currentUser())) return []
  return (await since(Math.min(14, Math.max(1, days)))).filter((e) => e.kind === "open" || e.kind === "play").map((e) => ({ kind: e.kind, subject: e.subject, at: e.at }))
}
