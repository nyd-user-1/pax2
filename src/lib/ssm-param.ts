import "server-only"

// One SecureString from SSM Parameter Store, cached five minutes: long enough that a burst of polls
// costs one read, short enough that a script writing a new token takes effect without a deploy
// (after govblock's lib/agents/connections/secret.ts). A missing or unreadable parameter reads as null.

const REGION = process.env.PAX2_REGION ?? "us-east-1"
const TTL = 5 * 60_000
const cache = new Map<string, { at: number; value: string | null }>()

export async function param(name: string): Promise<string | null> {
  const hit = cache.get(name)
  if (hit && Date.now() - hit.at < TTL) return hit.value
  let value: string | null = null
  try {
    const { SSMClient, GetParameterCommand } = await import("@aws-sdk/client-ssm")
    value = (await new SSMClient({ region: REGION }).send(new GetParameterCommand({ Name: name, WithDecryption: true }))).Parameter?.Value?.trim() || null
  } catch {
    value = null
  }
  cache.set(name, { at: Date.now(), value })
  return value
}
