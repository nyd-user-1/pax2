"use server"

import { DescribeRuleCommand, DisableRuleCommand, EnableRuleCommand, EventBridgeClient } from "@aws-sdk/client-eventbridge"
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda"
import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth"
import { pollerState } from "@/lib/velocity-store"

const REGION = process.env.PAX_REGION ?? "us-east-1"
const FUNCTION = "hermes-velocity-poll"
const RULE = "hermes-velocity-poll"
const lambda = new LambdaClient({ region: REGION })
const events = new EventBridgeClient({ region: REGION })

/** Recompute the /break-out stat card snapshot now, then re-render the page. */
export async function refreshSnapshot() {
  await lambda.send(new InvokeCommand({ FunctionName: FUNCTION, InvocationType: "RequestResponse", Payload: new TextEncoder().encode(JSON.stringify({ mode: "snapshot" })) }))
  revalidatePath("/break-out")
}

export type PollerStatus = { enabled: boolean; lastRunAt: string | null; lastWatched: number | null }

export async function pollerStatus(): Promise<PollerStatus> {
  const [rule, state] = await Promise.all([events.send(new DescribeRuleCommand({ Name: RULE })), pollerState()])
  return { enabled: rule.State === "ENABLED", lastRunAt: state.lastRunAt ?? null, lastWatched: state.lastWatched ?? null }
}

/** Turn the 15-minute poller schedule on or off. Admins only. */
export async function setPoller(enabled: boolean): Promise<PollerStatus> {
  await requireAdmin()
  await events.send(enabled ? new EnableRuleCommand({ Name: RULE }) : new DisableRuleCommand({ Name: RULE }))
  revalidatePath("/dashboard")
  return pollerStatus()
}
