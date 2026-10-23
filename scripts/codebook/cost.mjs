// Codebook 5K's spend: every pax2-codebook box EC2 remembers (appended to data/raw/codebook/boxes.jsonl the
// first time it is seen, since terminated boxes drop out of EC2 after about an hour), launch to termination
// (or now, if running), at the on-demand list price for its type — or the zone's spot price at launch for a
// spot box — plus its 100 GB gp3 at $0.08/GB-month; and the Bedrock cross-check's tokens at $3 / $15 per million.
// Usage: node scripts/codebook/cost.mjs
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const LEDGER = path.join(root, "data/raw/codebook/boxes.jsonl")
const ON_DEMAND = { "g6.xlarge": 0.8048, "g6.2xlarge": 0.9776, "g6e.xlarge": 1.861 }
const aws = (...a) => JSON.parse(execFileSync("aws", [...a, "--region", "us-east-1", "--output", "json"], { encoding: "utf8" }))
const seen = new Map(fs.existsSync(LEDGER) ? fs.readFileSync(LEDGER, "utf8").split("\n").filter(Boolean).map((l) => { const r = JSON.parse(l); return [r.id, r] }) : [])
for (const r of aws("ec2", "describe-instances", "--filters", "Name=tag:Name,Values=pax2-codebook").Reservations) for (const i of r.Instances) {
  if (seen.get(i.InstanceId)?.end) continue
  const tag = (k) => i.Tags.find((t) => t.Key === k)?.Value
  let end = i.State.Name === "terminated" ? i.StateTransitionReason.match(/\((.+) GMT\)/)?.[1]?.replace(" ", "T") : null
  // A box that shuts itself down leaves no time in StateTransitionReason; its log's last stamp + 60 s stands in.
  if (!end && ["terminated", "shutting-down"].includes(i.State.Name)) {
    try {
      const log = execFileSync("aws", ["s3", "cp", "--only-show-errors", `s3://pax-2-638175140432/${tag("Run")}box.log`, "-", "--region", "us-east-1"], { encoding: "utf8" })
      const stamps = [...log.matchAll(/(20\d\d-\d\d-\d\dT\d\d:\d\d:\d\dZ)/g)].map((m) => Date.parse(m[1]))
      end = new Date(Math.max(...stamps) + 60e3).toISOString().slice(0, 19)
    } catch {}
  }
  const market = i.InstanceLifecycle === "spot" ? "spot" : "on-demand"
  const perHour = market === "spot" ? Number(aws("ec2", "describe-spot-price-history", "--instance-types", i.InstanceType, "--availability-zone", i.Placement.AvailabilityZone, "--product-descriptions", "Linux/UNIX", "--start-time", i.LaunchTime, "--end-time", i.LaunchTime).SpotPriceHistory[0]?.SpotPrice) : ON_DEMAND[i.InstanceType]
  seen.set(i.InstanceId, { id: i.InstanceId, type: i.InstanceType, market, run: tag("Run"), launched: i.LaunchTime, end: end ? new Date(end + "Z").toISOString() : null, perHour })
}
// Boxes gone from EC2 with no end on record: their log's last stamp + 60 s.
const live = new Set(aws("ec2", "describe-instances", "--filters", "Name=tag:Name,Values=pax2-codebook").Reservations.flatMap((r) => r.Instances.map((i) => i.InstanceId)))
for (const r of seen.values()) if (!r.end && !live.has(r.id)) {
  try {
    const log = execFileSync("aws", ["s3", "cp", "--only-show-errors", `s3://pax-2-638175140432/${r.run}box.log`, "-", "--region", "us-east-1"], { encoding: "utf8" })
    r.end = new Date(Math.max(...[...log.matchAll(/(20\d\d-\d\d-\d\dT\d\d:\d\d:\d\dZ)/g)].map((m) => Date.parse(m[1]))) + 60e3).toISOString()
  } catch {}
}
fs.writeFileSync(LEDGER, [...seen.values()].map((r) => JSON.stringify(r)).join("\n") + "\n")
let total = 0
for (const r of [...seen.values()].sort((a, b) => a.launched.localeCompare(b.launched))) {
  const h = ((r.end ? Date.parse(r.end) : Date.now()) - Date.parse(r.launched)) / 3.6e6
  const usd = h * r.perHour + (h * 100 * 0.08) / 730
  total += usd
  console.log(`${r.launched.slice(11, 16)} ${r.type} ${r.market.padEnd(9)} ${(h * 60).toFixed(1).padStart(6)} min  $${r.perHour}/h  $${usd.toFixed(3)}  ${r.end ? "" : "(running) "}${r.run}`)
}
let tin = 0, tout = 0
for (const d of fs.readdirSync(path.join(root, "data/raw/codebook")).filter((d) => d.startsWith("bedrock") && !d.includes("."))) {
  const dir = path.join(root, "data/raw/codebook", d)
  for (const f of fs.readdirSync(dir)) { const o = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); tin += o.tokensIn; tout += o.tokensOut }
}
const bed = (tin * 3 + tout * 15) / 1e6
console.log(`boxes $${total.toFixed(2)}, Bedrock $${bed.toFixed(2)}, total $${(total + bed).toFixed(2)}`)
