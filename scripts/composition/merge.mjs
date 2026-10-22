// Composition table (window C, 2026-10-20): folds the extraction box's raw per-short measurements
// (s3://pax-2-638175140432/composition/raw/, scripts/composition/extract.py) together with the
// word-timed transcripts and the catalog titles into data/generated/model/composition.json, one
// definition per feature (FEATURES below). Measured features only; a short missing an input gets no
// value for the features that need it, never a guess. Coverage counts ride in the file.
//
// Usage: node scripts/composition/merge.mjs          (syncs from S3 first)
//        node scripts/composition/merge.mjs --no-sync
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { ROOT, pairs } from "./pairs.mjs"

const RAW = path.join(ROOT, "data/raw/composition/raw")
const OUT = path.join(ROOT, "data/generated/model/composition.json")
fs.mkdirSync(RAW, { recursive: true })
if (!process.argv.includes("--no-sync")) {
  execFileSync("aws", ["s3", "sync", "--only-show-errors", "s3://pax-2-638175140432/composition/raw/", RAW, "--region", "us-east-1"], { stdio: "inherit" })
}

import { FEATURES, headline, media, speech } from "../../src/lib/composition-features.mjs"

export { FEATURES }

const { pairs: ps, catalog } = pairs()
const transcripts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/generated/transcripts.json"), "utf8"))
const raws = new Map()
for (const file of fs.readdirSync(RAW).filter((x) => x.endsWith(".json"))) {
  const j = JSON.parse(fs.readFileSync(path.join(RAW, file), "utf8"))
  raws.set(j.id, j)
}

const shorts = {}
for (const v of catalog.videos) {
  const raw = raws.get(v.id)
  const f = { ...headline(v.title), durationSec: v.durationSec ?? null, ...(raw ? media(raw) : {}), ...speech(transcripts[v.id], raw) }
  if (f.durationSec == null) f.durationSec = v.durationSec ?? null
  for (const k of Object.keys(f)) if (f[k] == null) delete f[k]
  shorts[v.id] = f
}

const pairIds = new Set(ps.flatMap((p) => [p.breakout.id, p.control.id]))
const coverage = { catalog: catalog.videos.length, pairs: ps.length, pairIds: pairIds.size, raw: raws.size, perFeature: {}, perFeaturePairIds: {}, pairsBothSidesVideo: 0, pairsBothSidesAudio: 0 }
for (const k of Object.keys(FEATURES)) {
  coverage.perFeature[k] = Object.values(shorts).filter((f) => f[k] != null).length
  coverage.perFeaturePairIds[k] = [...pairIds].filter((id) => shorts[id]?.[k] != null).length
}
for (const p of ps) {
  const a = raws.get(p.breakout.id)
  const b = raws.get(p.control.id)
  if (a?.scenes && b?.scenes) coverage.pairsBothSidesVideo++
  if (a?.loudness && b?.loudness) coverage.pairsBothSidesAudio++
}

const out = {
  builtAt: new Date().toISOString(),
  version: "composition-1",
  source: "s3://pax-2-638175140432/composition/raw/ (scripts/composition/extract.py), data/generated/transcripts.json, data/velocity/catalog.json",
  notes: [
    "Headline traits cover every catalog short; media features only shorts with media extracted; speech timing only caption and Whisper transcripts (the transcript API's word times are word indices).",
    "Text overlay is OCR at one frame a second, words of 2+ alphanumerics at confidence 60+.",
    "Not measured: emotion, music detection as such (speechShare is the speech-versus-other-sound balance over audible seconds).",
  ],
  features: FEATURES,
  coverage,
  shorts,
}
fs.writeFileSync(OUT, JSON.stringify(out))
console.log(JSON.stringify(coverage, null, 1))
