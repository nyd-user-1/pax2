// The percentiles PAX2 Headline Ranker v1's raw score is read against (src/lib/headline-v1.ts): the
// pax2-headline Lambda scores every distinct held-out Upworthy headline from the run's held-pairs-v1.jsonl
// in S3, and the 101 percentiles of those scores (0 to 100) go to data/generated/model/headline-v1-reference.json.
//   node scripts/headline/reference.mjs [run-id]      (invokes the Lambda about 70 times, cents)
import fs from "node:fs"
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda"

const run = process.argv[2] ?? "20261018-060508-train"
const s3 = new S3Client({ region: "us-east-1" })
const lambda = new LambdaClient({ region: "us-east-1" })
const text = async (key) => (await s3.send(new GetObjectCommand({ Bucket: "nsr-embed-v2", Key: `pax2/headline/runs/${run}/${key}` }))).Body.transformToString()
const report = JSON.parse(await text("headline-v1.json"))
const heads = [...new Set((await text("held-pairs-v1.jsonl")).split("\n").filter(Boolean).flatMap((l) => { const p = JSON.parse(l); return [p.winner, p.loser] }))]
console.log(`${heads.length} distinct held-out headlines from ${report.counts.heldOutPairs} pairs`)
const scores = []
for (let i = 0; i < heads.length; i += 256) {
  const r = await lambda.send(new InvokeCommand({ FunctionName: "pax2-headline", Payload: Buffer.from(JSON.stringify({ texts: heads.slice(i, i + 256) })) }))
  if (r.FunctionError) throw new Error(`Lambda error: ${Buffer.from(r.Payload).toString().slice(0, 300)}`)
  scores.push(...JSON.parse(Buffer.from(r.Payload).toString()).scores)
  process.stdout.write(`\r${scores.length} scored`)
}
console.log()
scores.sort((a, b) => a - b)
const q = (k) => scores[Math.min(scores.length - 1, Math.floor((k / 100) * (scores.length - 1)))]
const percentiles = Array.from({ length: 101 }, (_, k) => Math.round(q(k) * 1e4) / 1e4)
const out = { builtAt: new Date().toISOString(), run, n: scores.length, heldOutAccuracy: report.heldOutAccuracy, percentiles, method: "scores of every distinct held-out Upworthy headline from the run's held-out pairs, through the pax2-headline Lambda; percentile k is the score at position floor(k/100 * (n-1)) of the sorted scores" }
fs.writeFileSync("data/generated/model/headline-v1-reference.json", JSON.stringify(out, null, 1))
console.log(`wrote headline-v1-reference.json: n ${out.n}, median ${percentiles[50]}, p10 ${percentiles[10]}, p90 ${percentiles[90]}`)
