// The visuals lane, held apart from the record and Studio paths until proven: for one library
// script, a shot list from Claude on Bedrock, a stock photo per beat (Pexels when PEXELS_API_KEY
// exists, Openverse's CC pool otherwise), a Stability Image Ultra image per beat for the quality
// comparison (Amazon's own Nova Canvas reached end of life on Bedrock; Ultra is the account's best
// on-Bedrock text-to-image, served from us-west-2), and two Luma Ray 2 text-to-video jobs started
// async into the us-west-2 bucket. /visuals reads the manifest this writes.
//
// Usage: node scripts/visuals/demo.mjs            plan, fetch stock, generate Canvas, start Reel
//        node scripts/visuals/demo.mjs --collect  check the Reel jobs, download finished clips
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { BedrockRuntimeClient, ConverseCommand, GetAsyncInvokeCommand, InvokeModelCommand, StartAsyncInvokeCommand } from "@aws-sdk/client-bedrock-runtime"
import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const PUB = path.join(root, "public/visuals")
const OUT = path.join(root, "data/generated/visuals")
fs.mkdirSync(PUB, { recursive: true })
fs.mkdirSync(OUT, { recursive: true })
const MANIFEST = path.join(OUT, "demo.json")
const VIDEO_BUCKET = "pax-2-video-usw2-638175140432"
const CLAUDE = process.env.PAX2_MODEL ?? "us.anthropic.claude-sonnet-4-6"
const bedrock = new BedrockRuntimeClient({ region: "us-east-1" })
const west = new BedrockRuntimeClient({ region: "us-west-2" })
const s3 = new S3Client({ region: "us-west-2" })
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

// ---------- collect: check Reel jobs, pull finished clips ----------
if (process.argv.includes("--collect")) {
  const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8"))
  for (const job of m.reel) {
    if ((job.status === "Completed" && job.file) || !job.arn) continue
    const r = await west.send(new GetAsyncInvokeCommand({ invocationArn: job.arn }))
    job.status = r.status
    if (r.status === "Completed") {
      const prefix = r.outputDataConfig.s3OutputDataConfig.s3Uri.replace(`s3://${VIDEO_BUCKET}/`, "")
      const list = await s3.send(new ListObjectsV2Command({ Bucket: VIDEO_BUCKET, Prefix: prefix }))
      const key = (list.Contents ?? []).find((o) => o.Key.endsWith(".mp4"))?.Key
      if (key) {
        const file = `reel-${m.reel.indexOf(job)}.mp4`
        const obj = await s3.send(new GetObjectCommand({ Bucket: VIDEO_BUCKET, Key: key }))
        fs.writeFileSync(path.join(PUB, file), Buffer.from(await obj.Body.transformToByteArray()))
        job.file = `/visuals/${file}`
        log(`reel ${job.arn.split("/").pop()}: downloaded ${file}`)
      }
    } else log(`reel ${job.arn.split("/").pop()}: ${r.status}${r.failureMessage ? ` (${r.failureMessage})` : ""}`)
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 1))
  process.exit(0)
}

// ---------- the script and its shot list ----------
const library = JSON.parse(fs.readFileSync(path.join(root, "data/library.json"), "utf8"))
const script = (Array.isArray(library) ? library : (library.scripts ?? [])).find((s) => s.id === "coin") ?? (Array.isArray(library) ? library[0] : library.scripts[0])
log(`script: ${script.title}`)

const ASK = `From this 60-second political short script, make a 5-shot b-roll list. For each shot give: "line" (the script sentence or clause the shot sits under, verbatim), "query" (2-3 plain words for a stock photo search), "prompt" (one sentence for a photoreal image generator: concrete subject, setting, light, mood; no text in the image, no real politicians' faces). Reply as a JSON array of 5 objects with keys line, query, prompt, nothing else.\n\n${script.text}`
let beats
try {
  const r = await bedrock.send(new ConverseCommand({ modelId: CLAUDE, messages: [{ role: "user", content: [{ text: ASK }] }], inferenceConfig: { maxTokens: 1500 } }))
  beats = JSON.parse(r.output.message.content[0].text.replace(/^[^[]*/, "").replace(/[^\]]*$/, ""))
  log(`shot list: ${beats.length} beats from ${CLAUDE}`)
} catch (e) {
  log(`shot list fell back to plain split: ${e.name}`)
  const lines = script.text.split(/\n+/).filter((l) => l.trim().length > 20).slice(0, 5)
  beats = lines.map((line) => ({ line, query: "state capitol vote", prompt: `A photoreal editorial image under the line: ${line}` }))
}

// ---------- stock, Pexels first, Openverse without a key ----------
async function stock(query, i) {
  try {
    const px = process.env.PEXELS_API_KEY
    if (px) {
      const r = await (await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=3`, { headers: { Authorization: px } })).json()
      const url = r.photos?.[0]?.src?.large2x
      if (!url) return null
      const img = await (await fetch(url)).arrayBuffer()
      fs.writeFileSync(path.join(PUB, `stock-${i}.jpg`), Buffer.from(img))
      return { file: `/visuals/stock-${i}.jpg`, source: "Pexels", credit: r.photos[0].photographer }
    }
    const r = await (await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license_type=commercial&per_page=5`, { headers: { "User-Agent": "pax2-visuals-demo" } })).json()
    const hit = (r.results ?? []).find((x) => (x.width ?? 0) >= 800)
    if (!hit) return null
    const img = await (await fetch(hit.url, { headers: { "User-Agent": "pax2-visuals-demo" } })).arrayBuffer()
    const ext = hit.url.split(".").pop().split("?")[0].slice(0, 4)
    fs.writeFileSync(path.join(PUB, `stock-${i}.${ext}`), Buffer.from(img))
    return { file: `/visuals/stock-${i}.${ext}`, source: "Openverse (CC)", credit: hit.creator ?? null }
  } catch (e) {
    log(`stock ${i} failed: ${e.message}`)
    return null
  }
}

// ---------- Stability Image Ultra on Bedrock (us-west-2), one portrait image per beat ----------
async function canvas(prompt, i) {
  try {
    const body = { prompt, negative_prompt: "text, words, captions, watermark, logo, distorted faces", aspect_ratio: "9:16", output_format: "png", seed: 20261019 + i }
    const r = await west.send(new InvokeModelCommand({ modelId: "stability.stable-image-ultra-v1:1", contentType: "application/json", body: JSON.stringify(body) }))
    const out = JSON.parse(Buffer.from(r.body).toString())
    const img = out.images?.[0] ?? out.artifacts?.[0]?.base64
    if (!img) return null
    fs.writeFileSync(path.join(PUB, `canvas-${i}.png`), Buffer.from(img, "base64"))
    return { file: `/visuals/canvas-${i}.png`, source: "Stability Image Ultra (Bedrock)" }
  } catch (e) {
    log(`canvas ${i} failed: ${e.name} ${e.message?.slice(0, 120)}`)
    return { error: e.name }
  }
}

const rows = []
for (const [i, b] of beats.entries()) {
  const [st, cv] = await Promise.all([stock(b.query, i), canvas(b.prompt, i)])
  rows.push({ line: b.line, query: b.query, prompt: b.prompt, stock: st, canvas: cv })
  log(`beat ${i + 1}: stock ${st ? "ok" : "none"}, canvas ${cv?.file ? "ok" : (cv?.error ?? "none")}`)
}

// ---------- Luma Ray 2 on Bedrock (us-west-2), two clips started async into S3 ----------
const reel = []
for (const [i, b] of beats.slice(0, 2).entries()) {
  try {
    const r = await west.send(
      new StartAsyncInvokeCommand({
        modelId: "luma.ray-v2:0",
        modelInput: { prompt: b.prompt, aspect_ratio: "9:16", duration: "5s", resolution: "720p", loop: false },
        outputDataConfig: { s3OutputDataConfig: { s3Uri: `s3://${VIDEO_BUCKET}/visuals/reel/` } },
      }),
    )
    reel.push({ arn: r.invocationArn, prompt: b.prompt, status: "InProgress", file: null })
    log(`reel ${i + 1} started: ${r.invocationArn.split("/").pop()}`)
  } catch (e) {
    reel.push({ arn: null, prompt: b.prompt, status: `failed: ${e.name}`, file: null })
    log(`reel ${i + 1} failed to start: ${e.name} ${e.message?.slice(0, 120)}`)
  }
}

fs.writeFileSync(
  MANIFEST,
  JSON.stringify({ builtAt: new Date().toISOString(), script: { id: script.id, title: script.title }, model: { shots: CLAUDE, image: "stability.stable-image-ultra-v1:1", video: "luma.ray-v2:0" }, beats: rows, reel }, null, 1),
)
log(`manifest: ${MANIFEST}`)
