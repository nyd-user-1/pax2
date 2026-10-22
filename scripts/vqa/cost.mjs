// Window Q's spend: every pax2-vqa-* box EC2 still remembers (terminated boxes stay listed about an hour, so
// each box is also appended to data/raw/vqa/boxes.jsonl the first time this sees it), its life from launch
// to termination, priced at the spot price in its zone at launch. EBS (150 GB gp3 for the box's life) is
// added at $0.08/GB-month. Usage: node scripts/vqa/cost.mjs
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const LEDGER = path.join(root, "data/raw/vqa/boxes.jsonl")
const aws = (...a) => JSON.parse(execFileSync("aws", [...a, "--region", "us-east-1", "--output", "json"], { encoding: "utf8" }))
const seen = new Map(fs.existsSync(LEDGER) ? fs.readFileSync(LEDGER, "utf8").split("\n").filter(Boolean).map((l) => { const r = JSON.parse(l); return [r.id, r] }) : [])
const res = aws("ec2", "describe-instances", "--filters", "Name=tag:Name,Values=pax2-vqa-*")
for (const r of res.Reservations) for (const i of r.Instances) {
  if (seen.has(i.InstanceId) && seen.get(i.InstanceId).end) continue
  const run0 = i.Tags.find((t) => t.Key === "Run")?.Value
  // A box that shuts itself down leaves no time in StateTransitionReason; its log's last stamp + 60 s stands in.
  let end = i.State.Name === "terminated" ? i.StateTransitionReason.match(/\((.+) GMT\)/)?.[1]?.replace(" ", "T") : null
  if (i.State.Name === "terminated" && !end) {
    try {
      const log = execFileSync("aws", ["s3", "cp", "--only-show-errors", `s3://pax-2-638175140432/${run0}box.log`, "-", "--region", "us-east-1"], { encoding: "utf8" })
      const stamps = [...log.matchAll(/(20\d\d-\d\d-\d\dT\d\d:\d\d:\d\dZ)/g)].map((m) => Date.parse(m[1]))
      end = new Date(Math.max(...stamps) + 60e3).toISOString().slice(0, 19)
    } catch {}
  }
  const price = Number(aws("ec2", "describe-spot-price-history", "--instance-types", i.InstanceType, "--availability-zone", i.Placement.AvailabilityZone, "--product-descriptions", "Linux/UNIX", "--start-time", i.LaunchTime, "--end-time", i.LaunchTime).SpotPriceHistory[0]?.SpotPrice ?? NaN)
  const run = i.Tags.find((t) => t.Key === "Run")?.Value
  const rec = { id: i.InstanceId, type: i.InstanceType, az: i.Placement.AvailabilityZone, run, launched: i.LaunchTime, end: end ? new Date(end + "Z").toISOString() : null, endFrom: end && !i.StateTransitionReason.includes("GMT") ? "box log + 60 s" : "EC2", spotPerHour: price }
  seen.set(i.InstanceId, rec)
}
fs.writeFileSync(LEDGER, [...seen.values()].map((r) => JSON.stringify(r)).join("\n") + "\n")
let total = 0
for (const r of [...seen.values()].sort((a, b) => a.launched.localeCompare(b.launched))) {
  const h = ((r.end ? Date.parse(r.end) : Date.now()) - Date.parse(r.launched)) / 3.6e6
  const usd = h * r.spotPerHour + h * (150 * 0.08) / 730
  total += usd
  console.log(`${r.launched.slice(11, 16)} ${r.type.padEnd(11)} ${(h * 60).toFixed(1).padStart(6)} min  $${r.spotPerHour.toFixed(3)}/h  $${usd.toFixed(3)}  ${r.end ? "" : "(running) "}${r.run}`)
}
console.log(`total $${total.toFixed(2)}`)
