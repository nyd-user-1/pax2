// Codebook 5K, the Bedrock cross-check: the 20 verification videos (data/raw/codebook/verify-ids.txt) through
// evaluate.ts's exact call — ConverseCommand, us.anthropic.claude-sonnet-4-6, maxTokens 4000, temperature 0 —
// on prompt a (Swayable) and prompt b (Wesleyan) from data/raw/codebook/prompts.jsonl. Parsed the way
// evaluate.ts parses (first "{" to last "}"). One file per video to data/raw/codebook/bedrock/<id>.json with
// the token counts; skips ids already written. Prints the spend at $3 / $15 per million tokens in / out.
// Usage: node scripts/codebook/bedrock.mjs   (IDS=<ids file> PASSES=b OUTDIR=<dir under data/raw/codebook> for the Wesleyan prompt on another set)
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const DIR = path.join(root, "data/raw/codebook")
const OUT = path.join(DIR, process.env.OUTDIR ?? "bedrock")
fs.mkdirSync(OUT, { recursive: true })
const MODEL = "us.anthropic.claude-sonnet-4-6"
const client = new BedrockRuntimeClient({ region: "us-east-1" })
const ids = fs.readFileSync(path.join(root, process.env.IDS ?? "data/raw/codebook/verify-ids.txt"), "utf8").trim().split("\n")
const PASSES = process.env.PASSES ?? "ab"
const want = new Set(ids)
const prompts = new Map()
for (const l of fs.readFileSync(path.join(DIR, "prompts.jsonl"), "utf8").split("\n")) {
  if (!l) continue
  const r = JSON.parse(l)
  if (want.has(r.id)) prompts.set(r.id, r)
}

async function call(text) {
  const r = await client.send(new ConverseCommand({ modelId: MODEL, messages: [{ role: "user", content: [{ text }] }], inferenceConfig: { maxTokens: 4000, temperature: 0 } }))
  const raw = r.output?.message?.content?.map((c) => ("text" in c ? c.text : "")).join("") ?? ""
  let parsed = null
  try { parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) } catch {}
  return { parsed, raw: parsed ? null : raw, tin: r.usage?.inputTokens ?? 0, tout: r.usage?.outputTokens ?? 0 }
}

let tin = 0, tout = 0
await Promise.all(ids.map(async (id) => {
  const f = path.join(OUT, `${id}.json`)
  if (fs.existsSync(f)) { const o = JSON.parse(fs.readFileSync(f, "utf8")); tin += o.tokensIn; tout += o.tokensOut; return }
  const p = prompts.get(id)
  const none = { parsed: null, raw: null, tin: 0, tout: 0 }
  const [a, b] = await Promise.all([PASSES.includes("a") ? call(p.a) : none, PASSES.includes("b") ? call(p.b) : none])
  const o = { id, model: MODEL, swayable: a.parsed, wesleyan: b.parsed, rawA: a.raw, rawB: b.raw, tokensIn: a.tin + b.tin, tokensOut: a.tout + b.tout, at: new Date().toISOString() }
  fs.writeFileSync(f, JSON.stringify(o, null, 1) + "\n")
  tin += o.tokensIn; tout += o.tokensOut
  console.log(`${id} a ${a.parsed ? "ok" : "PARSE"} b ${b.parsed ? "ok" : "PARSE"} ${o.tokensIn}/${o.tokensOut}`)
}))
console.log(`tokens in ${tin}, out ${tout}: $${((tin * 3 + tout * 15) / 1e6).toFixed(3)}`)
