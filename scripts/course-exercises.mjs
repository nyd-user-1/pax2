// Teach a Model's exercise answers, read back for the models they feed. Scans the ledger for
// EXERCISE#<course>#<chapter> rows (written by src/lib/courses.ts), keeps each learner's latest
// answer per round, replaces the email with a short hash, and joins what was shown to the frozen
// items in data/generated/course-items.json. Where an exercise has a known answer, it re-scores the
// learners here, apart from the app's own scoring: breakout picks (ranker 4), push or stop
// (simulator 1) and Hit, in between or Miss (simulator 4).
// What it spans: only rows under EXERCISE#; nothing from the Classifier course, whose labels
// scripts/consensus-agreement.mjs reads.
// Writes data/generated/model/course-exercises.json, or { "pending": true } when no answers exist.
// Usage: node scripts/course-exercises.mjs   (reads the ledger in us-east-1; read-only)
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const OUT = path.join(root, "data/generated/model/course-exercises.json")
const items = JSON.parse(fs.readFileSync(path.join(root, "data/generated/course-items.json"), "utf8"))
const F = items.facts

// Which model each exercise's answers are for, by the inventory's names (src/lib/recipes/memorable.ts).
const FEEDS = {
  "ranker#1": { model: "PAX2 Headline Ranker, PAX2 Feed Ranker", shape: "title comparisons" },
  "ranker#2": { model: "PAX2 Feed Ranker", shape: "orders of four, six comparisons each" },
  "ranker#3": { model: "PAX2 Vision Encoder, PAX2 Feed Ranker", shape: "thumbnail comparisons" },
  "ranker#4": { model: "PAX2 Classifier", shape: "human within-channel breakout picks, a baseline beside the model's within-channel AUC" },
  "encoder#1": { model: "PAX2 Encoder", shape: "similarity triplets: anchor, chosen, other" },
  "encoder#2": { model: "PAX2 Encoder", shape: "same-viewers pairs: positives and negatives" },
  "encoder#3": { model: "PAX2 Encoder", shape: "odd one out of three from one channel: hard negatives" },
  "encoder#4": { model: "PAX2 Reranker", shape: "nearest-of-four relevance judgments" },
  "regressor#1": { model: "PAX2 Classifier", shape: "human view estimates against the truth" },
  "regressor#2": { model: "PAX2 Retention Regressor", shape: "self-reported swipe-away second per short" },
  "regressor#3": { model: "PAX2 Classifier", shape: "human view ranges and their coverage" },
  "regressor#4": { model: "PAX2 Retention Regressor, PAX2 Feed Ranker", shape: "orders by views against the channel median" },
  "simulator#1": { model: "PAX2 Platform Simulator", shape: "push or stop decisions on settled shorts" },
  "simulator#2": { model: "PAX2 Platform Simulator, PAX2 Feed Ranker", shape: "watch or skip feed sessions" },
  "simulator#3": { model: "PAX2 Platform Simulator", shape: "human base-rate estimates by family" },
  "simulator#4": { model: "PAX2 Platform Simulator, PAX2 Velocity Classifier", shape: "Hit, in between or Miss calls" },
  "language-model#1": { model: "PAX2GPT", shape: "human next lines after a script's opening" },
  "language-model#2": { model: "PAX2GPT, PAX2 Headline Ranker", shape: "opening-line preference pairs" },
  "language-model#3": { model: "PAX2GPT", shape: "claim labels on script lines" },
  "language-model#4": { model: "PAX2GPT", shape: "edit pairs: library line and human rewrite" },
}

const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }))
const rows = []
let start
do {
  const r = await db.send(new ScanCommand({ TableName: process.env.PAX2_LEDGER_TABLE ?? "pax2-ledger", FilterExpression: "begins_with(pk, :p)", ExpressionAttributeValues: { ":p": "EXERCISE#" }, ExclusiveStartKey: start }))
  rows.push(...(r.Items ?? []))
  start = r.LastEvaluatedKey
} while (start)

if (!rows.length) {
  fs.writeFileSync(OUT, JSON.stringify({ pending: true, checkedAt: new Date().toISOString() }, null, 2) + "\n")
  console.log("no EXERCISE# answers in the ledger; wrote pending")
  process.exit(0)
}

const learner = (email) => crypto.createHash("sha256").update(email).digest("hex").slice(0, 10)
const latest = new Map()
for (const r of rows.sort((a, b) => a.at.localeCompare(b.at))) latest.set(`${r.pk}|${r.voter}|${r.round}`, r)

const byExercise = {}
for (const r of latest.values()) {
  const [, course, chapter] = r.pk.split("#")
  const key = `${course}#${chapter}`
  ;(byExercise[key] ??= []).push({ learner: learner(r.voter), round: r.round, shown: r.shown, answer: r.answer, at: r.at })
}

// Re-scoring where the truth is known, from the items file, not from the app.
const score = (key, list) => {
  if (key === "ranker#4") {
    const d = list.filter((x) => x.answer >= 0)
    return { right: d.filter((x) => F[x.shown[x.answer]]?.tier === "breakout").length, of: d.length, chance: 0.5 }
  }
  if (key === "simulator#1") return { right: list.filter((x) => (x.answer === 0) === (F[x.shown[0]]?.tier === "breakout")).length, of: list.length, chance: 0.5 }
  if (key === "simulator#4") return { right: list.filter((x) => ["breakout", "baseline", "killed"][x.answer] === F[x.shown[0]]?.tier).length, of: list.length, chance: 1 / 3 }
  return null
}

const exercises = Object.keys(FEEDS).map((key) => {
  const list = byExercise[key] ?? []
  return { exercise: key, ...FEEDS[key], answers: list.length, learners: new Set(list.map((x) => x.learner)).size, score: list.length ? score(key, list) : null, rows: list }
})
const out = { builtAt: new Date().toISOString(), method: "Latest answer per learner per round; learners as the first 10 hex of sha256(email); shown ids join data/generated/course-items.json facts. A pick answer i indexes the options shown; where a round has an anchor (encoder 1 and 4), shown[0] is the anchor and answer i means shown[i + 1]; -1 is can't tell.", answers: latest.size, learners: new Set([...latest.values()].map((r) => r.voter)).size, exercises }
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n")
console.log(`${latest.size} answers from ${out.learners} learners`)
for (const e of exercises.filter((e) => e.answers)) console.log(`${e.exercise}: ${e.answers} answers, ${e.learners} learners${e.score ? `, right ${e.score.right} of ${e.score.of}` : ""}`)
