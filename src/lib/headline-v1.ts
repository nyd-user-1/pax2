import "server-only"

import reference from "../../data/generated/model/headline-v1-reference.json"

// PAX2 Headline Ranker v1 at request time: the pax2-headline Lambda (lambda/headline, bert-base-uncased in
// ONNX Runtime) scores headlines; this reads each score against the held-out Upworthy headlines'
// scores (scripts/headline/reference.mjs), so one headline gets a percentile that means something:
// the share of tested headlines it outscores. Null when the function is absent or fails, so a page
// never waits on it; v0 in src/lib/headline.ts stays the fallback.

const FN = process.env.PAX2_HEADLINE_FN ?? "pax2-headline"
const REF = reference as { run: string; n: number; percentiles: number[]; heldOutAccuracy: number }

export type HeadlineV1 = { score: number; percentile: number; run: string; accuracy: number }

/** The share of held-out Upworthy headlines scoring below `score`, 0 to 100, from the 101 stored percentiles. */
export function percentileOf(score: number): number {
  const p = REF.percentiles
  if (!p?.length) return 50
  let lo = 0
  while (lo < p.length && p[lo] <= score) lo++
  return Math.round((lo / p.length) * 100)
}

export async function scoreHeadlinesV1(texts: string[]): Promise<HeadlineV1[] | null> {
  const clean = texts.map((t) => t.trim().slice(0, 400)).filter(Boolean)
  if (!clean.length) return null
  try {
    const { LambdaClient, InvokeCommand } = await import("@aws-sdk/client-lambda")
    const client = new LambdaClient({ region: process.env.PAX2_REGION ?? "us-east-1" })
    const r = await client.send(new InvokeCommand({ FunctionName: FN, Payload: Buffer.from(JSON.stringify({ texts: clean })) }))
    if (r.FunctionError || !r.Payload) return null
    const out = JSON.parse(Buffer.from(r.Payload).toString()) as { scores?: number[]; run?: string }
    if (!out.scores) return null
    return out.scores.map((score) => ({ score, percentile: percentileOf(score), run: out.run ?? REF.run, accuracy: REF.heldOutAccuracy }))
  } catch {
    return null
  }
}
