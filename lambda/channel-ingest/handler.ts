// pax2-channel-ingest: a connected YouTube channel's collection run, off the request path. Invoked
// asynchronously by kick() in src/lib/channel-ingest.ts when a user connects a channel or changes which
// private and unlisted videos are included; it steps the run (catalog, YouTube Analytics totals,
// retention curves) until it is done or under 90 seconds remain, then hands the rest to a fresh
// invocation, at most 20 hops. One definition: this bundles src/lib/channel-ingest.ts itself
// (lambda/channel-ingest/deploy.sh). Errors land as a FAIL row the pages show; no automatic retries.
//
// The Google OAuth client comes from SSM /pax2/youtube/oauth-client ({"id","secret"}), read before the
// library loads, since src/lib/youtube.ts reads it from the environment when imported.
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm"

type Event = { channelId: string; by: string; hop?: number }
type Context = { getRemainingTimeInMillis(): number }

const MAX_HOPS = 20
let ready = false

async function loadClient() {
  if (ready) return
  const v = (await new SSMClient({}).send(new GetParameterCommand({ Name: "/pax2/youtube/oauth-client", WithDecryption: true }))).Parameter?.Value
  const { id, secret } = JSON.parse(v ?? "{}") as { id?: string; secret?: string }
  if (!id || !secret) throw new Error("SSM /pax2/youtube/oauth-client is missing the Google OAuth client.")
  process.env.PAX2_GOOGLE_CLIENT_ID = id
  process.env.PAX2_GOOGLE_CLIENT_SECRET = secret
  ready = true
}

export const handler = async (event: Event, context: Context) => {
  const { channelId, by } = event
  const hop = event.hop ?? 0
  if (!/^UC[\w-]{22}$/.test(channelId ?? "") || !by) return { skipped: "bad event" }
  await loadClient()
  const lib = await import("../../src/lib/channel-ingest")
  try {
    const p = await lib.runUntil(channelId, by, () => context.getRemainingTimeInMillis())
    const line = { channelId, hop, phase: p.phase, done: p.done, total: p.total, hidden: p.hidden }
    if (p.phase !== "done") {
      if (hop + 1 >= MAX_HOPS) await lib.recordFailure(channelId, `The run did not finish in ${MAX_HOPS} passes; open the channel to resume it.`)
      else await lib.kick(channelId, by, hop + 1)
    }
    console.log(JSON.stringify(line))
    return line
  } catch (e) {
    const message = (e as Error).message ?? String(e)
    console.error(JSON.stringify({ channelId, hop, error: message }))
    await lib.recordFailure(channelId, message)
    return { channelId, hop, error: message }
  }
}
