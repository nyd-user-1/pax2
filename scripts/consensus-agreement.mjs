// PAX2 Trait Labeler measured against people. Reads every traits-<videoId> conversation the
// /labeling page wrote to the ledger (pk labeling#VOTE#traits-<id>) and, per Swayable trait:
//   the human majority (present when at least half of the non-pass votes agree) against the
//   labeler's code at 0.5 (data/generated/model/organic-codes.json): agreement rate and Cohen's kappa;
//   with two or more voters on a video, inter-coder agreement: pairwise agreement and the kappa
//   pooled over voter pairs.
//   per video, the distinct people who voted (passes included) and how many videos have three or more;
//   per chapter of the Classifier course (CHAPTERS in src/lib/course.ts, parsed from that file), the
//   labeler's agreement with the human majority pooled over the chapter's traits, and their mean kappa.
// What it spans: only videos the labeler coded and at least one person judged (non-pass) on that
// trait; a voter's latest vote per trait counts. Nothing else.
// Writes data/generated/model/consensus-agreement.json, or { "pending": true } when no votes exist.
// Usage: node scripts/consensus-agreement.mjs   (reads the ledger in us-east-1; read-only)
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"))
const OUT = path.join(root, "data/generated/model/consensus-agreement.json")
const PREFIX = "labeling#VOTE#traits-"

// The trait list and the tid rule are the app's (src/lib/labeling.ts): index in featureLabels.
const labels = read("data/generated/model/reference-model.json").featureLabels
const TRAITS = Object.entries(labels).map(([key, label], tid) => ({ tid, key, label }))
const codes = read("data/generated/model/organic-codes.json").scripts
// The course's chapters, from their one definition.
const courseTs = fs.readFileSync(path.join(root, "src/lib/course.ts"), "utf8")
const CHAPTERS = [...courseTs.matchAll(/\{ n: (\d), title: "(\w+)", keys: \[([^\]]+)\] \}/g)].map((m) => ({ n: Number(m[1]), title: m[2], keys: m[3].match(/"(\w+)"/g).map((x) => x.slice(1, -1)) }))
if (CHAPTERS.length !== 4 || CHAPTERS.flatMap((c) => c.keys).length !== 28) throw new Error("could not read CHAPTERS from src/lib/course.ts")

const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }))
const items = []
let start
do {
  const r = await db.send(new ScanCommand({ TableName: process.env.PAX2_LEDGER_TABLE ?? "pax2-ledger", FilterExpression: "begins_with(pk, :p)", ExpressionAttributeValues: { ":p": PREFIX }, ExclusiveStartKey: start }))
  items.push(...(r.Items ?? []))
  start = r.LastEvaluatedKey
} while (start)

if (!items.length) {
  fs.writeFileSync(OUT, JSON.stringify({ pending: true, checkedAt: new Date().toISOString() }, null, 2) + "\n")
  console.log("no traits-* votes in the ledger; wrote pending")
  process.exit(0)
}

// Latest vote per (video, voter, trait).
const latest = new Map()
for (const v of items.sort((a, b) => a.at.localeCompare(b.at))) latest.set(`${v.pk.slice(PREFIX.length)}|${v.voter}|${v.tid}`, { video: v.pk.slice(PREFIX.length), voter: v.voter, tid: v.tid, vote: v.vote })
const all = [...latest.values()]
const voters = new Set(all.map((v) => v.voter))
const videos = new Set(all.map((v) => v.video))

function kappa(pairs) {
  // pairs: [a, b] of 0/1
  const n = pairs.length
  if (!n) return null
  const po = pairs.filter(([a, b]) => a === b).length / n
  const pa = pairs.filter(([a]) => a).length / n
  const pb = pairs.filter(([, b]) => b).length / n
  const pe = pa * pb + (1 - pa) * (1 - pb)
  return pe === 1 ? null : (po - pe) / (1 - pe)
}
const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000)

const rows = TRAITS.map((t) => {
  const vs = all.filter((v) => v.tid === t.tid && v.vote !== 0)
  const byVideo = new Map()
  for (const v of vs) (byVideo.get(v.video) ?? byVideo.set(v.video, []).get(v.video)).push(v)
  const model = []
  const coder = []
  for (const [video, list] of byVideo) {
    const code = codes[video]?.codes?.[t.key]
    if (code == null) continue
    const human = list.filter((v) => v.vote === 1).length / list.length >= 0.5 ? 1 : 0
    model.push([human, code >= 0.5 ? 1 : 0])
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) coder.push([list[i].vote === 1 ? 1 : 0, list[j].vote === 1 ? 1 : 0])
  }
  return {
    tid: t.tid,
    key: t.key,
    label: t.label,
    videos: model.length,
    agreement: model.length ? r3(model.filter(([a, b]) => a === b).length / model.length) : null,
    kappa: r3(kappa(model)),
    interCoder: coder.length ? { pairs: coder.length, agreement: r3(coder.filter(([a, b]) => a === b).length / coder.length), kappa: r3(kappa(coder)) } : null,
  }
})
const ks = rows.map((r) => r.kappa).filter((k) => k != null)
const labelersByVideo = Object.fromEntries([...videos].sort().map((id) => [id, new Set(all.filter((v) => v.video === id).map((v) => v.voter)).size]))
const chapters = CHAPTERS.map((c) => {
  const rs = rows.filter((r) => c.keys.includes(r.key) && r.videos)
  const n = rs.reduce((t, r) => t + r.videos, 0)
  const ck = rs.map((r) => r.kappa).filter((k) => k != null)
  return { n: c.n, title: c.title, comparisons: n, agreement: n ? r3(rs.reduce((t, r) => t + Math.round(r.agreement * r.videos), 0) / n) : null, meanKappa: ck.length ? r3(ck.reduce((a, b) => a + b, 0) / ck.length) : null }
})
const out = { builtAt: new Date().toISOString(), method: "Human majority at half of non-pass votes against PAX2 Trait Labeler's code at 0.5; Cohen's kappa per trait over videos; inter-coder kappa pooled over voter pairs.", voters: voters.size, videos: videos.size, votes: all.length, meanKappa: ks.length ? r3(ks.reduce((a, b) => a + b, 0) / ks.length) : null, traitsWithKappa: ks.length, labelersByVideo, videosWithThreeOrMore: Object.values(labelersByVideo).filter((n) => n >= 3).length, chapters, rows }
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n")
console.log(`${all.length} votes from ${voters.size} voters on ${videos.size} videos; mean kappa ${out.meanKappa} over ${ks.length} traits`)
console.log(`${out.videosWithThreeOrMore} videos with three or more labelers; by chapter: ${chapters.map((c) => `${c.n} ${c.title} ${c.agreement ?? "-"} (kappa ${c.meanKappa ?? "-"})`).join(", ")}`)
