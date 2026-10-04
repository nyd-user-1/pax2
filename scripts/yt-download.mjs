// Download the picked shorts on this machine (YouTube blocks the same requests from AWS).
// Usage: node scripts/yt-download.mjs [batch-json]   (default data/raw/yt-batch-2026-10-04.json)
// Files land in downloads/<channel-slug>/<rank>-<id>.mp4 (gitignored); already-present files are skipped,
// so the script can be rerun after a partial pass. Best muxed mp4 via the Android client.

import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from "node:fs"
import { Innertube, Utils } from "youtubei.js"

const batchPath = process.argv[2] ?? "data/raw/yt-batch-2026-10-04.json"
const batch = JSON.parse(readFileSync(batchPath, "utf8"))
const yt = await Innertube.create()

let got = 0
let had = 0
let failed = 0
for (const v of batch.videos) {
  const dir = `downloads/${v.slug}`
  mkdirSync(dir, { recursive: true })
  const path = `${dir}/${String(v.rank).padStart(2, "0")}-${v.id}.mp4`
  if (existsSync(path) && statSync(path).size > 0) {
    had++
    continue
  }
  try {
    const stream = await yt.download(v.id, { type: "video+audio", quality: "best", format: "mp4", client: "ANDROID" })
    const file = createWriteStream(path)
    for await (const chunk of Utils.streamToIterable(stream)) file.write(chunk)
    await new Promise((res, rej) => {
      file.end()
      file.on("finish", res)
      file.on("error", rej)
    })
    const kb = Math.round(statSync(path).size / 1024)
    if (kb < 20) throw new Error(`only ${kb} KB`)
    got++
    console.log(`got ${v.channel} #${v.rank} ${v.id} (${kb} KB)`)
  } catch (e) {
    failed++
    if (existsSync(path)) unlinkSync(path)
    console.log(`FAIL ${v.channel} #${v.rank} ${v.id}: ${e.message}`)
  }
}
console.log(`done: ${got} downloaded, ${had} already here, ${failed} failed of ${batch.videos.length}`)
