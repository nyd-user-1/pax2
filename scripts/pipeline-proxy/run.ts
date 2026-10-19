// The labeled proxy run: one Voter Freedom video through the entire pipeline, end to end, driven
// headless at Brendan's order of 2026-10-19 ("use a Voter Freedom video as a proxy and just label it
// as such") — he records nothing, and no one else does until the sponsors meet.
//
// This driver composes the app's own server libraries (src/lib/originals, evaluate, mail, youtube,
// velocity-store — rule 15, one definition) and mirrors src/app/original-actions.ts step for step,
// skipping only the Cognito shell that the live site already proved on 2026-10-18. The video is
// labeled a proxy in its title and a note event; it uploads to the channel UNLISTED (a republish of
// back-catalog content, not a new release); its watch entry is real tracking of the test upload and
// never joins a training set.
//
// Run with the react-server condition so `server-only` resolves, and tsx for the @/ paths:
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/pipeline-proxy/run.ts submit
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/pipeline-proxy/run.ts status <id>
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/pipeline-proxy/run.ts approve <id>
// submit: copies the mp4 to uploads/ (the S3 event starts the analyze box), opens the original,
//         scores it and emails the admins — exactly what pressing Send does.
// approve: what the admin's Approved button does — upload to the channel, watch list, emails.
import fs from "node:fs"
import path from "node:path"

const ROOT = path.join(import.meta.dirname!, "../..")
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Za-z0-9_]+)=["']?([^"'\n]*)["']?\s*$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2]
}
process.env.PAX2_YOUTUBE_PRIVACY ??= "unlisted"

const BUCKET = process.env.PAX2_BUCKET ?? "pax-2-638175140432"
const REGION = process.env.PAX2_REGION ?? "us-east-1"
const SRC_FILE = "MoreThanTwoChoices-LarrySokoff-34s-4x5.mp4"
const SRC_KEY = `uploads/voter-freedom/${SRC_FILE}`
const SECONDS = 34
const TITLE = "More Than Two Choices (Voter Freedom proxy)"
const NAME = "Larry Sokoff"
const OWNER = "brendan@nysgpt.com"
const LABEL =
  "Voter Freedom back-catalog proxy, pipeline test of 2026-10-19 at Brendan's direction. Original content that predates PAX2, republished unlisted to test the loop; not a new release; never joins a training set."

const [cmd, arg] = process.argv.slice(2)

async function main() {
  const { createOriginal, addEvent, originalRow, latestEvaluation, playableKey } = await import("@/lib/originals")
  const { evaluate } = await import("@/lib/evaluate")
  const { ADMINS, layout, send, SITE } = await import("@/lib/mail")

  if (cmd === "submit") {
    const transcripts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/generated/model/transcripts-voter-freedom.json"), "utf8"))
    const t = transcripts[SRC_FILE]
    const text: string = (t?.text ?? t?.transcript ?? (Array.isArray(t?.words) ? t.words.map((w: { w: string }) => w.w).join(" ") : "")).trim()
    if (!text) throw new Error(`no transcript text for ${SRC_FILE}`)

    const id = `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const key = `uploads/voter-freedom-proxy/${id}.mp4`
    const { S3Client, CopyObjectCommand } = await import("@aws-sdk/client-s3")
    const s3 = new S3Client({ region: REGION })
    await s3.send(new CopyObjectCommand({ Bucket: BUCKET, Key: key, CopySource: encodeURIComponent(`${BUCKET}/${SRC_KEY}`) }))
    console.log(`copied ${SRC_KEY} -> ${key} (the S3 event starts the analyze box)`)

    await createOriginal({ id, owner: OWNER, key, version: 1, title: TITLE, text, name: NAME, role: "Voter Freedom messenger", seconds: SECONDS, consent: true })
    await addEvent(id, { kind: "note", by: "pax2-lead, at Brendan's direction", note: LABEL })
    console.log(`original ${id} opened, proxy label on its record`)

    const row = await originalRow(id)
    if (!row) throw new Error("the original did not land")
    const evaluation = await evaluate(row)
    await addEvent(id, { kind: "scored", by: "pax2", evaluation })
    const body = layout({
      heading: "Original Content ready for review",
      paragraphs: [`${TITLE}, recorded by ${NAME}, has been scored.`, evaluation.summary],
      buttons: [{ label: "Review it", href: `${SITE}/v/${id}?tab=scored` }],
    })
    await send(ADMINS, "Original Content ready for review", body, id)
    console.log(`scored and the admins emailed; forecast: ${evaluation.forecast ? `${Math.round(evaluation.forecast.p * 100)}% chance of a Hit` : "none"}`)
    console.log(`id: ${id}`)
    console.log(`next: status ${id} until an analyzed event lands, then approve ${id}`)
    return
  }

  if (cmd === "status") {
    if (!arg) throw new Error("status <id>")
    const row = await originalRow(arg)
    if (!row) throw new Error("no such original")
    for (const e of row.events) console.log(`${e.at ?? ""}  ${e.kind}  ${e.by ?? ""}`)
    console.log(`stage: ${row.stage}, playable: ${playableKey(row, row.events)}`)
    return
  }

  if (cmd === "approve") {
    if (!arg) throw new Error("approve <id>")
    const { channel, uploadShort } = await import("@/lib/youtube")
    const { addToWatch } = await import("@/lib/velocity-store")
    const row = await originalRow(arg)
    if (!row) throw new Error("no such original")
    if (!latestEvaluation(row.events)) throw new Error("Score the video first.")
    const by = "pax2-lead, at Brendan's direction"
    await addEvent(arg, { kind: "approved", by })

    const ch = await channel()
    if (!ch) throw new Error("no channel is connected; the grant has not run")
    const key = playableKey(row, row.events)
    if (!/\.(mp4|mov|m4v)$/i.test(key)) throw new Error("no playable mp4 on the record")
    const { youtubeId, url } = await uploadShort({ key, title: row.title ?? TITLE, description: row.text ?? "", publishAt: null })
    await addEvent(arg, { kind: "published", by, destinations: [{ platform: "YouTube", url }, { platform: "TikTok", url: null }, { platform: "Instagram", url: null }] })
    await addToWatch({ youtubeId, original: arg, at: new Date().toISOString() })
    await addEvent(arg, { kind: "watching", by: "pax2", youtubeId, published: new Date().toISOString(), destinations: [{ platform: "YouTube", url }] })
    const body = layout({
      heading: "Your video is published",
      paragraphs: [`${row.title ?? TITLE} is live on ${ch.title}. PAX2 is watching how it does in its first days and shows it on the video's page.`],
      buttons: [{ label: "Watch it on YouTube", href: url }, { label: "See your video", href: `${SITE}/v/${arg}?tab=published` }],
    })
    await send([row.owner], "Your video is published", body, arg)
    console.log(`published ${PRIVACYNOTE()} to ${ch.title}: ${url}`)
    console.log(`watch list entry written; the poller reads it on its next 15-minute run`)
    return
  }

  throw new Error("usage: run.ts submit | status <id> | approve <id>")
}

const PRIVACYNOTE = () => `(${process.env.PAX2_YOUTUBE_PRIVACY})`
main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
