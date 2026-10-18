// The Mac's second scorer for PAX2 Headline Ranker v1 (rig rule 25): reads the box's held-out pair
// scores from S3 and recomputes the pairwise accuracy, the share of held-out pairs where the winner
// scored higher, and sets it beside the number the box reported in headline-v1.json. Where the two
// agree both are validated; where they differ there is a bug. Also per-test: the share of tests
// whose winner scored above every loser.
//   node scripts/headline/rescore.mjs <run-id>      (read-only against s3://nsr-embed-v2, us-east-1)
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"

const run = process.argv[2]
if (!run) {
  console.error("usage: node scripts/headline/rescore.mjs <run-id>")
  process.exit(2)
}
const s3 = new S3Client({ region: "us-east-1" })
const text = async (key) => (await s3.send(new GetObjectCommand({ Bucket: "nsr-embed-v2", Key: `pax2/headline/runs/${run}/${key}` }))).Body.transformToString()

const report = JSON.parse(await text("headline-v1.json"))
const pairs = (await text("held-pairs-v1.jsonl")).split("\n").filter(Boolean).map((l) => JSON.parse(l))
const wins = pairs.filter((p) => p.winnerScore > p.loserScore).length
const acc = wins / pairs.length
const byTest = new Map()
for (const p of pairs) byTest.set(p.test, (byTest.get(p.test) ?? true) && p.winnerScore > p.loserScore)
const testsRight = [...byTest.values()].filter(Boolean).length
const agree = Math.abs(acc - report.heldOutAccuracy) < 5e-4
console.log(`run ${run}${report.rehearsal ? " (rehearsal)" : ""}: ${pairs.length} held-out pairs in ${byTest.size} tests`)
console.log(`  Mac pairwise accuracy ${acc.toFixed(4)}  box ${report.heldOutAccuracy.toFixed(4)}  ${agree ? "agree" : "DISAGREE"}`)
console.log(`  tests with the winner above every loser: ${testsRight} of ${byTest.size} (${(testsRight / byTest.size).toFixed(3)})`)
console.log(`  v0 ${report.v0HeldOutAccuracy}, flags only ${report.v0FlagsOnlyAccuracy}, chance 0.5; Gate H ${report.gateH.threshold}: ${acc >= report.gateH.threshold ? "PASS" : "FAIL"}`)
process.exit(agree ? 0 : 1)
