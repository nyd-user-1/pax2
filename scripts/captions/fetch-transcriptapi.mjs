// YouTube captions for the catalog through TranscriptAPI (transcriptapi.com), bought by Brendan
// 2026-10-19 to finish what one home IP fetches in days in about an hour: GET /api/v2/youtube/transcript,
// Bearer key from .env.local, 200 requests a minute on the monthly plan, 1 credit per 200 (404s free,
// 402 when credits run out).
//
// Rig rules: dry run by default, --apply spends (16); every raw response cached to
// data/raw/captions-api/<id>.json, 404s to <id>.404.json, so a rerun never re-spends (17); --ceiling
// credits, default 17000, and a clean stop on 402 with what remains (19); 429 waits Retry-After (18).
//
//   node scripts/captions/fetch-transcriptapi.mjs              # census and cost, no network
//   node scripts/captions/fetch-transcriptapi.mjs --sample 3   # fetch 3, show what came back
//   node scripts/captions/fetch-transcriptapi.mjs --apply      # the lot, paced under the rate limit
//   node scripts/captions/fetch-transcriptapi.mjs --merge      # fold the cache into transcripts.json
//
// The merge writes { text, words: [{ t, w }], source: "transcriptapi", at } beside captions-merge.mjs's
// entries and never overwrites an id that already has text. Word times are the segment's start spread
// evenly over its words: segment-level timing, good enough for speaking rate, not word marks.
import fs from "node:fs"
import path from "node:path"

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "../..")
const CACHE = path.join(ROOT, "data/raw/captions-api")
const IDS = path.join(ROOT, "data/raw/captions/ids-remaining.txt")
const JSON3_DIR = path.join(ROOT, "data/raw/captions")
const TRANSCRIPTS = path.join(ROOT, "data/generated/transcripts.json")
const BASE = "https://transcriptapi.com/api/v2/youtube/transcript"
const RPM = 180 // under the plan's 200
const WORKERS = 8
const argv = process.argv.slice(2)
const APPLY = argv.includes("--apply")
const MERGE = argv.includes("--merge")
const SAMPLE = argv.includes("--sample") ? Number(argv[argv.indexOf("--sample") + 1] || 3) : 0
const CEILING = argv.includes("--ceiling") ? Number(argv[argv.indexOf("--ceiling") + 1]) : 17000

fs.mkdirSync(CACHE, { recursive: true })

function key() {
  const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8")
  const m = env.match(/^TRANSCRIPT_API_KEY=["']?([^"'\n]*)["']?$/m)
  if (!m || !m[1].trim()) throw new Error("TRANSCRIPT_API_KEY is empty in .env.local")
  return m[1].trim()
}

// ── census ────────────────────────────────────────────────────────────────────
const transcripts = fs.existsSync(TRANSCRIPTS) ? JSON.parse(fs.readFileSync(TRANSCRIPTS, "utf8")) : {}
const hasJson3 = new Set(fs.readdirSync(JSON3_DIR).filter((f) => f.endsWith(".en.json3")).map((f) => f.slice(0, -".en.json3".length)))
const cached = new Set(fs.readdirSync(CACHE).map((f) => f.replace(/\.(404\.)?json$/, "")))
const all = fs.readFileSync(IDS, "utf8").split("\n").filter(Boolean)
const todo = all.filter((id) => !hasJson3.has(id) && !transcripts[id]?.text && !cached.has(id))
console.log(`${all.length} ids listed; ${hasJson3.size} have a yt-dlp caption file, ${cached.size} are in the API cache; ${todo.length} to fetch`)
console.log(`at 1 credit per success: up to ${todo.length} credits; the plan holds 1,000, top-ups $2.50 per 1,000, so the lot is about $${(Math.max(0, todo.length - 1000) / 1000 * 2.5 + 0).toFixed(0)} beyond the plan`)
console.log(`at ${RPM} requests a minute: about ${Math.ceil(todo.length / RPM)} minutes`)

// ── merge ─────────────────────────────────────────────────────────────────────
if (MERGE) {
  let added = 0
  for (const f of fs.readdirSync(CACHE).filter((x) => x.endsWith(".json") && !x.endsWith(".404.json"))) {
    const id = f.slice(0, -".json".length)
    if (transcripts[id]?.text) continue
    const j = JSON.parse(fs.readFileSync(path.join(CACHE, f), "utf8"))
    const segs = Array.isArray(j.transcript) ? j.transcript : []
    const words = []
    for (const s of segs) {
      const ws = (s.text ?? "").split(/\s+/).filter(Boolean)
      ws.forEach((w, i) => words.push({ t: Math.round((s.start + (i * (s.duration ?? 0)) / ws.length) * 100) / 100, w }))
    }
    const text = words.map((w) => w.w).join(" ").replace(/\s+/g, " ").trim()
    if (!text) continue
    transcripts[id] = { text, words, source: "transcriptapi", at: new Date().toISOString() }
    added++
  }
  fs.writeFileSync(TRANSCRIPTS, JSON.stringify(transcripts, null, 1))
  const withText = Object.values(transcripts).filter((v) => v.text).length
  console.log(`${added} merged, ${withText} with text of ${Object.keys(transcripts).length} in ${TRANSCRIPTS}`)
  process.exit(0)
}

if (!APPLY && !SAMPLE) process.exit(0)

// ── fetch ─────────────────────────────────────────────────────────────────────
const KEY = key()
const list = SAMPLE ? todo.slice(0, SAMPLE) : todo
let next = Date.now()
const slot = () => {
  const at = (next = Math.max(next + 60000 / RPM, Date.now()))
  return new Promise((r) => setTimeout(r, at - Date.now()))
}
let ok = 0, noCaptions = 0, unavailable = 0, failed = 0, stop = null
const t0 = Date.now()

async function one(id) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (stop) return
    await slot()
    if (stop) return
    let res
    try {
      res = await fetch(`${BASE}?video_url=${id}&format=json&language=en,asr-en`, {
        headers: { Authorization: `Bearer ${KEY}` },
        signal: AbortSignal.timeout(30000),
      })
    } catch (e) {
      if (attempt === 2) { failed++; console.log(`${id}: ${e.name}`) }
      continue
    }
    if (res.status === 200) {
      const body = await res.text()
      fs.writeFileSync(path.join(CACHE, `${id}.json`), body)
      ok++
      if (ok >= CEILING) stop = `ceiling of ${CEILING} credits reached`
      return
    }
    if (res.status === 404) {
      const body = await res.text()
      fs.writeFileSync(path.join(CACHE, `${id}.404.json`), body)
      let code = ""
      try { code = JSON.parse(body).code } catch {}
      code === "video_unavailable" ? unavailable++ : noCaptions++
      return
    }
    if (res.status === 402) { stop = "402: credits exhausted; top up and rerun --apply, the cache resumes"; return }
    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after") || 5)
      next = Math.max(next, Date.now() + wait * 1000)
      attempt-- // a 429 is pacing, not a failure
      continue
    }
    if (attempt === 2) { failed++; console.log(`${id}: HTTP ${res.status}`) }
  }
}

let i = 0
await Promise.all(Array.from({ length: Math.min(WORKERS, list.length) }, async () => {
  while (i < list.length && !stop) {
    const id = list[i++]
    await one(id)
    const done = ok + noCaptions + unavailable + failed
    if (done % 200 === 0 && done) console.log(`${done}/${list.length} ok=${ok} noCaptions=${noCaptions} unavailable=${unavailable} failed=${failed} ${(done / ((Date.now() - t0) / 60000)).toFixed(0)}/min`)
  }
}))
console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s: ok=${ok} (credits), noCaptions=${noCaptions}, unavailable=${unavailable}, failed=${failed}, remaining=${list.length - ok - noCaptions - unavailable - failed}`)
if (stop) console.log(`STOPPED: ${stop}`)
if (SAMPLE) for (const id of list) {
  const p = path.join(CACHE, `${id}.json`)
  if (fs.existsSync(p)) {
    const j = JSON.parse(fs.readFileSync(p, "utf8"))
    const segs = Array.isArray(j.transcript) ? j.transcript : []
    console.log(`${id}: language=${j.language} segments=${segs.length} chars=${segs.map((s) => s.text).join(" ").length} first="${(segs[0]?.text ?? "").slice(0, 60)}"`)
  }
}
