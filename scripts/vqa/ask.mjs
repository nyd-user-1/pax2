// Ask a video a question (Window Q step 6): the same model as the census batch, one held short, any question.
// Launches one spot GPU box through scripts/vqa/launch.sh (MODE=ask), waits for its answer in S3, prints it
// with the measured latency (box spin-up included) and the cost of the box from launch to termination at
// the spot price it ran on. No product surface; this is the seed of ask-about-this-video.
//
// Usage: node scripts/vqa/ask.mjs <id> "<question>"      (MODEL=Qwen/Qwen3-VL-8B-Instruct for the 8B)
// Each ask appends its record to data/raw/vqa/asks.jsonl.
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const [id, question] = process.argv.slice(2)
if (!id || !question) { console.error('usage: node scripts/vqa/ask.mjs <id> "<question>"'); process.exit(1) }
const B = "pax-2-638175140432"
const aws = (...a) => execFileSync("aws", [...a, "--region", "us-east-1"], { encoding: "utf8" }).trim()
const video = JSON.parse(fs.readFileSync(path.join(root, "data/generated/feed-index.json"), "utf8")).find((v) => v.id === id)
const RUN = `vqa/asks/${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}-${id}/`
const tmp = path.join(fs.mkdtempSync("/tmp/ask-"), "ask.json")
fs.writeFileSync(tmp, JSON.stringify({ id, question, channel: video?.channel ?? "" }))
aws("s3", "cp", "--only-show-errors", tmp, `s3://${B}/${RUN}ask.json`)

const t0 = Date.now()
const out = execFileSync("bash", ["scripts/vqa/launch.sh"], { cwd: root, encoding: "utf8", env: { ...process.env, APPLY: "1", MODE: "ask", ONDEMAND_FALLBACK: process.env.ONDEMAND_FALLBACK ?? "1", ASK_RUN: RUN, WATCHDOG_MIN: process.env.WATCHDOG_MIN ?? "25" } })
const iid = out.match(/instance: (i-\w+)/)?.[1]
const type = out.match(/launched i-\w+ (\S+)/)?.[1]
const market = out.match(/launched i-\w+ \S+ \S+ (\w+)/)?.[1] ?? "spot"
if (!iid) { console.error(out); process.exit(1) }
console.error(`launched ${iid} ${type}; waiting for the answer`)

let answer = null
while (Date.now() - t0 < 30 * 60e3) {
  try { answer = JSON.parse(aws("s3", "cp", "--only-show-errors", `s3://${B}/${RUN}answer.json`, "-")); break } catch {}
  const st = aws("ec2", "describe-instances", "--instance-ids", iid, "--query", "Reservations[0].Instances[0].State.Name", "--output", "text")
  if (st === "terminated" || st === "shutting-down") { try { answer = JSON.parse(aws("s3", "cp", "--only-show-errors", `s3://${B}/${RUN}answer.json`, "-")) } catch {} break }
  await new Promise((r) => setTimeout(r, 10e3))
}
const latencySec = Math.round((Date.now() - t0) / 1000)
// The box's billed life: launch to its own shutdown (the log's last stamp + 60 s; EC2 is slow to report
// "terminated"), at the spot price in its zone at launch, or the on-demand rate.
let st
while ((st = aws("ec2", "describe-instances", "--instance-ids", iid, "--query", "Reservations[0].Instances[0].[State.Name,LaunchTime,Placement.AvailabilityZone]", "--output", "text").split(/\s+/))[0] !== "terminated") await new Promise((r) => setTimeout(r, 10e3))
const log = aws("s3", "cp", "--only-show-errors", `s3://${B}/${RUN}box.log`, "-")
const end = Math.max(...[...log.matchAll(/(20\d\d-\d\d-\d\dT\d\d:\d\d:\d\dZ)/g)].map((m) => Date.parse(m[1]))) + 60e3
const boxSec = Math.round((end - Date.parse(st[1])) / 1000)
const ONDEMAND = { "g6.2xlarge": 0.9776 }  // us-east-1 Linux on-demand, $/h
const price = market === "ondemand" ? ONDEMAND[type] : Number(aws("ec2", "describe-spot-price-history", "--instance-types", type, "--availability-zone", st[2], "--product-descriptions", "Linux/UNIX", "--start-time", st[1], "--end-time", st[1], "--query", "SpotPriceHistory[0].SpotPrice", "--output", "text"))
const rec = { at: new Date().toISOString(), id, question, answer: answer?.answer ?? null, error: answer?.error ?? (answer ? undefined : "no answer; see the box log"), model: answer?.model, instance: type, market, latencySec, boxSec, pricePerHour: price, costUsd: Math.round((boxSec / 3600) * price * 1000) / 1000, box: answer?.sec, log: `s3://${B}/${RUN}box.log` }
fs.mkdirSync(path.join(root, "data/raw/vqa"), { recursive: true })
fs.appendFileSync(path.join(root, "data/raw/vqa/asks.jsonl"), JSON.stringify(rec) + "\n")
console.log(JSON.stringify(rec, null, 1))
