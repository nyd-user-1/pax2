"use server"

import { DescribeRuleCommand, DisableRuleCommand, EnableRuleCommand, EventBridgeClient } from "@aws-sdk/client-eventbridge"
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda"
import { revalidatePath } from "next/cache"

import { polledCards, type VelocityCard } from "@/lib/lab"
import { forbidDemo, requireAdmin } from "@/lib/auth"
import { baselines, pollerState, recentPolls } from "@/lib/velocity-store"

const REGION = process.env.PAX2_REGION ?? "us-east-1"
const FUNCTION = "pax2-velocity-poll"
const RULE = "pax2-velocity-poll"
const lambda = new LambdaClient({ region: REGION })
const events = new EventBridgeClient({ region: REGION })

/** Recompute the /outliers stat card snapshot now, then re-render the page. */
export async function refreshSnapshot() {
  await lambda.send(new InvokeCommand({ FunctionName: FUNCTION, InvocationType: "RequestResponse", Payload: new TextEncoder().encode(JSON.stringify({ mode: "snapshot" })) }))
  revalidatePath("/tracking")
}

export type PollerStatus = { enabled: boolean; lastRunAt: string | null; lastWatched: number | null }

export async function pollerStatus(): Promise<PollerStatus> {
  const [rule, state] = await Promise.all([events.send(new DescribeRuleCommand({ Name: RULE })), pollerState()])
  return { enabled: rule.State === "ENABLED", lastRunAt: state.lastRunAt ?? null, lastWatched: state.lastWatched ?? null }
}

/** Turn the 15-minute poller schedule on or off. Admins only. */
export async function setPoller(enabled: boolean): Promise<PollerStatus> {
  forbidDemo(await requireAdmin())
  await events.send(enabled ? new EnableRuleCommand({ Name: RULE }) : new DisableRuleCommand({ Name: RULE }))
  revalidatePath("/dashboard")
  return pollerStatus()
}

let cardsCache: { at: number; cards: VelocityCard[] } | null = null

/** Every real curve card, cached briefly per instance - the poller only writes every 15 minutes. */
async function allCards(): Promise<VelocityCard[]> {
  if (cardsCache && Date.now() - cardsCache.at < 5 * 60_000) return cardsCache.cards
  const [rows, medians] = await Promise.all([recentPolls(7), baselines()])
  cardsCache = { at: Date.now(), cards: polledCards(rows, medians) }
  return cardsCache.cards
}

export type VelocitySort = "oldest" | "views" | "az"

const ORDER: Record<VelocitySort, (a: VelocityCard, b: VelocityCard) => number> = {
  // furthest along first: finished 72-hour curves lead, ones still in flight trail
  oldest: (a, b) => (b.hours ?? 0) - (a.hours ?? 0),
  views: (a, b) => b.views - a.views,
  az: (a, b) => alpha(a.title).localeCompare(alpha(b.title), "en", { sensitivity: "base", numeric: true }),
}

// A–Z reads past leading quotes and emoji: "🚨Ilhan Omar…" files under I.
function alpha(title: string) {
  return title.replace(/^[^\p{L}\p{N}]+/u, "")
}

/** One scroll batch of curve cards for /velocity-tracker; the focused video leads when named. */
export type VelocityFilter = "all" | "breakout" | "baseline" | "killed"

export async function moreVelocityCards(offset: number, focus?: string, sort: VelocitySort = "oldest", filter: VelocityFilter = "all"): Promise<{ cards: VelocityCard[]; total: number }> {
  const every = [...(await allCards())].sort(ORDER[sort] ?? ORDER.oldest)
  const all = filter === "all" ? every : every.filter((c) => c.tier === filter)
  const pool = focus ? [...all.filter((c) => c.id === focus), ...all.filter((c) => c.id !== focus)] : all
  return { cards: pool.slice(offset, offset + 12), total: pool.length }
}
