// Voter Freedom's uploads as PAX2 originals: content made off the platform, entered after the fact.
// Each upload is version 1; each paid edit of it (data/generated/voter-freedom-paid.json, cut "edit")
// is a later version with `parent` set, in report_date order. A re-run of the same exact cut in
// another creative set is the same version, so its paid figures sit on version 1. Uploads with no
// paid creative are single-version originals.
//
// Every original is written through the app's own ledger code (src/lib/originals.ts: createOriginal,
// addEvent), imported here, not re-implemented: META carries provenance "backfilled", the owner is
// the admin, consent is given, the title is YouTube's, the text is the transcript when
// data/generated/features.json holds one. An upload gets a published event and a watching event
// with its YouTube id, so the Polled tab reads the readings that exist; a paid edit has no upload
// of its own, so it is published to YouTube ads with no link and never watched.
//
// Dry run by default: prints the chains and the census. --apply writes. --score also runs
// evaluate() on each written original that has a transcript (PAX2 Trait Labeler on Bedrock, about
// a cent each), stopping at --max (default 100), before its published and watching events so the
// stage stays Polled.
//
// Usage: node scripts/backfill-voter-freedom.mjs [--apply] [--score] [--max 100]
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createJiti } from "jiti"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"))
const args = process.argv.slice(2)
const APPLY = args.includes("--apply")
const SCORE = args.includes("--score")
// --transcripts <file>: Whisper transcripts from the rig (transcripts-voter-freedom.json), keyed by file name with a
// youtubeId inside; used as the text of any original that was written without one, so it can be scored now.
const TRANSCRIPTS = args.includes("--transcripts") ? args[args.indexOf("--transcripts") + 1] : null
// Several files can share one YouTube id (an upload and its paid cuts); each version takes the transcript whose
// length is closest to its own seconds. --rescore <id,id> writes a fresh scored event for those originals.
const byYoutube = {}
if (TRANSCRIPTS) for (const v of Object.values(JSON.parse(fs.readFileSync(TRANSCRIPTS, "utf8")))) if (v.youtubeId && v.text) (byYoutube[v.youtubeId] ??= []).push(v)
const RESCORE = new Set((args.includes("--rescore") ? args[args.indexOf("--rescore") + 1] : "").split(",").filter(Boolean))
const transcriptFor = (o) => {
  const list = byYoutube[o.youtubeId ?? o.id.replace(/^orig-vf-/, "").replace(/-v\d+$/, "")] ?? []
  return [...list].sort((a, b) => Math.abs((a.durationSec ?? 0) - o.seconds) - Math.abs((b.durationSec ?? 0) - o.seconds))[0]?.text
}
const MAX = Number(args[args.indexOf("--max") + 1]) || 100
const OWNER = (process.env.ADMIN_EMAILS ?? "brendan@nysgpt.com").split(",")[0].trim().toLowerCase()

const raw = read("data/raw/voter-freedom.json").videos
const paid = read("data/generated/voter-freedom-paid.json").creatives
const features = read("data/generated/features.json")

const secs = (iso) => {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso ?? "")
  return m ? (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + +(m[3] ?? 0) : 0
}
const firstDate = (c) => c.rows.map((r) => r.report_date).sort()[0]
const totals = (cs) => cs.map((c) => ({ creativeId: c.creativeId, creativeSet: c.creativeSet, name: c.name, seconds: c.durationSeconds, reportDate: firstDate(c), ...c.totals }))

// The chains.
const chains = raw.map((v) => {
  const mine = paid.filter((c) => c.videoId === v.id)
  const exact = mine.filter((c) => c.cut === "exact")
  const edits = mine.filter((c) => c.cut === "edit").sort((a, b) => firstDate(a).localeCompare(firstDate(b)) || a.creativeId.localeCompare(b.creativeId))
  const transcript = features[`yt-${v.id}`]?.transcript?.text ?? null
  const base = { owner: OWNER, consent: true, provenance: "backfilled", publishAt: v.published, name: "Voter Freedom", sourceYoutubeId: v.id }
  const versions = [
    { ...base, id: `orig-vf-${v.id}-v1`, key: `youtube/${v.id}`, version: 1, title: v.title, text: transcript ?? undefined, seconds: secs(v.duration), youtubeId: v.id, published: v.published, paid: totals(exact) },
    ...edits.map((c, i) => ({ ...base, id: `orig-vf-${v.id}-v${i + 2}`, key: `paid/${c.creativeId}`, version: i + 2, title: c.name, text: transcript ?? undefined, seconds: c.durationSeconds, youtubeId: null, published: null, paid: totals([c]) })),
  ]
  for (let i = 1; i < versions.length; i++) versions[i].parent = versions[i - 1].id
  return { video: v, versions }
})

// The census, and every chain longer than one.
const all = chains.flatMap((c) => c.versions)
const multi = chains.filter((c) => c.versions.length > 1)
const exactOnly = new Set(paid.filter((c) => c.cut === "exact").map((c) => c.videoId))
console.log(`${raw.length} uploads, ${paid.length} paid creatives on ${new Set(paid.map((c) => c.videoId)).size} of them`)
console.log(`${all.length} originals: ${raw.length} uploads as version 1, ${all.length - raw.length} paid edits as later versions; ${multi.length} chains longer than one`)
console.log(`${all.filter((o) => o.text).length} with a transcript, ${all.filter((o) => o.paid.length).length} with paid figures`)
console.log(`${[...exactOnly].length} uploads ran as an exact paid cut; ${multi.filter((c) => !exactOnly.has(c.video.id)).length} chains have an edit but no exact cut in the batch`)
console.log("")
for (const c of multi) {
  console.log(`${c.video.id}  ${c.video.title}`)
  for (const o of c.versions) console.log(`  v${o.version}  ${String(o.seconds).padStart(3)}s  ${o.key.padEnd(20)}  ${o.paid.map((p) => `${p.creativeId}/${p.creativeSet}/${p.reportDate}/$${Math.round(p.spend_usd)}`).join("  ") || "(no paid run)"}`)
}
console.log("")
console.log("sample single:", JSON.stringify({ ...all.find((o) => o.version === 1 && !o.paid.length), text: undefined }))

if (!APPLY) {
  console.log("\ndry run; --apply writes")
  process.exit(0)
}

// The app's own ledger code, with its aliases.
const jiti = createJiti(import.meta.url, { alias: { "@/": path.join(root, "src") + "/", "server-only": path.join(root, "scripts/lib/server-only-stub.mjs") } })
const { createOriginal, addEvent, original, events } = await jiti.import(path.join(root, "src/lib/originals.ts"))
const { evaluate } = SCORE ? await jiti.import(path.join(root, "src/lib/evaluate.ts")) : {}

let written = 0
let skipped = 0
let scored = 0
for (const c of chains) {
  for (const o of c.versions) {
    if (await original(o.id)) {
      skipped++
      // Already written: score it now if it has no score yet and a transcript has arrived since.
      const text = (TRANSCRIPTS && transcriptFor(o)) || o.text
      if (SCORE && text && scored < MAX) {
        const evs = await events(o.id)
        if (!evs.some((e) => e.kind === "scored") || RESCORE.has(o.id)) {
          const row = await original(o.id)
          await addEvent(o.id, { kind: "scored", by: "pax2", evaluation: await evaluate({ ...row, text }) })
          scored++
          console.log(`scored ${o.id} (${text.split(/\s+/).length} words)`)
        }
      }
      continue
    }
    const { youtubeId, published, ...meta } = o
    await createOriginal(meta)
    if (o.parent) await addEvent(o.parent, { kind: "replaced", by: OWNER, child: o.id })
    if (SCORE && o.text && scored < MAX) {
      const row = await original(o.id)
      await addEvent(o.id, { kind: "scored", by: "pax2", evaluation: await evaluate(row) })
      scored++
    }
    if (youtubeId) {
      const url = `https://youtube.com/shorts/${youtubeId}`
      await addEvent(o.id, { kind: "published", by: OWNER, destinations: [{ platform: "YouTube", url }] })
      await addEvent(o.id, { kind: "watching", by: OWNER, youtubeId, published, destinations: [{ platform: "YouTube", url }] })
    } else {
      // A paid edit ran as an ad, never as an upload of its own.
      await addEvent(o.id, { kind: "published", by: OWNER, destinations: [{ platform: "YouTube ads", url: null }] })
    }
    written++
  }
}
console.log(`wrote ${written}, skipped ${skipped} already present, scored ${scored}`)
