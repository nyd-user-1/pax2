// Window Q's census columns: folds the question machine's raw per-short answers
// (s3://pax-2-638175140432/vqa/raw/<TAG>/, scripts/vqa/vqa.py) into data/generated/model/vqa-census.json,
// one definition per column (COLUMNS below), the scripts/composition/merge.mjs pattern: measured values only,
// a short with no answer gets no value, coverage counts ride in the file. A sibling of composition.json,
// not merged into it, because composition.json's feature list is the pair picker's input list
// (scripts/composition/fit.mjs) and a new column there would silently change its next refit.
// Also reports the cross-check: the model's on-screen text against composition's OCR (textFrameShare > 0).
//
// Usage: node scripts/vqa/merge.mjs [--no-sync]       (TAG=qwen3-vl-4b-p3 by default)
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const TAG = process.env.TAG ?? "qwen3-vl-4b-p3"
const RAW = path.join(root, `data/raw/vqa/raw/${TAG}`)

export const COLUMNS = {
  captionsBurnedIn: "0/1: the spoken words appear as on-screen text that changes with the speech (a headline or title that stays put is not captions)",
  callToAction: "0/1: the picture shows an explicit ask of the viewer (subscribe, follow, like, share, comment, donate, vote, register, sign, call, listen, watch more, visit a link, join)",
  ctaSec: "seconds: timestamp of the first sampled frame showing that ask; only where callToAction is 1",
  format: "enum: talking head | graphic card | b-roll | rally | news clip | interview | other — the dominant one",
  setting: "enum: indoor | outdoor | studio | archival | graphics only — the dominant one",
  peopleMax: "count: the most people visible in any one sampled frame, background, split screens and insets included (capped at 20); counts only, never identity or demographics",
  peopleScreenShare: "share 0-1: sampled frames with at least one person visible",
  productShown: "0/1: a commercial product, merchandise or branded package is a subject of the video",
  thirdPartyWatermark: "0/1: a logo, handle or watermark overlaid on the picture from another platform, outlet or creator; the channel's own branding and logos on microphones, podiums or backdrops are not",
}
const CROSS_CHECK = { onScreenText: "0/1: readable text added in editing in any sampled frame — overlaps composition's OCR (textFrameShare), a cross-check, not a column" }

export function columns(a) {
  if (!a) return null
  const ppl = Array.isArray(a.people_per_frame) ? a.people_per_frame.filter((x) => Number.isInteger(x)) : []
  const b = (x) => (typeof x === "boolean" ? (x ? 1 : 0) : null)
  const c = {
    captionsBurnedIn: b(a.captions_burned_in),
    callToAction: b(a.call_to_action),
    ctaSec: a.call_to_action && typeof a.cta_seconds === "number" ? a.cta_seconds : null,
    format: a.format ?? null,
    setting: a.setting ?? null,
    peopleMax: ppl.length ? Math.max(...ppl) : null,
    peopleScreenShare: ppl.length ? Math.round((ppl.filter((x) => x > 0).length / ppl.length) * 1000) / 1000 : null,
    productShown: b(a.product_shown),
    thirdPartyWatermark: b(a.third_party_watermark),
    onScreenText: b(a.on_screen_text),
  }
  for (const k of Object.keys(c)) if (c[k] == null) delete c[k]
  return c
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) {
  fs.mkdirSync(RAW, { recursive: true })
  if (!process.argv.includes("--no-sync")) execFileSync("aws", ["s3", "sync", "--only-show-errors", `s3://pax-2-638175140432/vqa/raw/${TAG}/`, RAW, "--region", "us-east-1"], { stdio: "inherit" })
  const set = fs.readFileSync(path.join(root, "data/raw/vqa/set.tsv"), "utf8").split("\n").filter(Boolean).map((l) => l.split("\t")[0])
  const comp = JSON.parse(fs.readFileSync(path.join(root, "data/generated/model/composition.json"), "utf8")).shorts
  const shorts = {}
  let unparsed = 0, frameMismatch = 0
  for (const id of set) {
    const f = path.join(RAW, `${id}.json`)
    if (!fs.existsSync(f)) continue
    const r = JSON.parse(fs.readFileSync(f, "utf8"))
    if (!r.answers) { unparsed++; continue }
    if ((r.answers.people_per_frame ?? []).length !== r.frameTimes.length) frameMismatch++
    shorts[id] = { ...columns(r.answers), _frames: r.frameTimes.length }
  }
  // cross-check: model on-screen text vs composition OCR text in any frame
  const both = Object.entries(shorts).filter(([id, c]) => c.onScreenText != null && comp[id]?.textFrameShare != null)
  const agree = both.filter(([id, c]) => c.onScreenText === (comp[id].textFrameShare > 0 ? 1 : 0)).length
  const tab = { modelYesOcrYes: 0, modelYesOcrNo: 0, modelNoOcrYes: 0, modelNoOcrNo: 0 }
  for (const [id, c] of both) tab[`model${c.onScreenText ? "Yes" : "No"}Ocr${comp[id].textFrameShare > 0 ? "Yes" : "No"}`]++
  const capVsOcr = Object.entries(shorts).filter(([id, c]) => c.captionsBurnedIn === 1 && comp[id]?.textFrameShare != null)
  const coverage = { set: set.length, answered: Object.keys(shorts).length, unparsed, missing: set.length - Object.keys(shorts).length - unparsed, peopleFrameMismatch: frameMismatch, perColumn: {} }
  for (const k of [...Object.keys(COLUMNS), "onScreenText"]) coverage.perColumn[k] = Object.values(shorts).filter((c) => c[k] != null).length
  const dist = {}
  for (const k of ["format", "setting"]) { dist[k] = {}; for (const c of Object.values(shorts)) if (c[k]) dist[k][c[k]] = (dist[k][c[k]] ?? 0) + 1 }
  for (const k of ["captionsBurnedIn", "callToAction", "productShown", "thirdPartyWatermark", "onScreenText"]) dist[k] = Object.values(shorts).filter((c) => c[k] === 1).length
  const out = {
    builtAt: new Date().toISOString(),
    version: TAG,
    source: `s3://pax-2-638175140432/vqa/raw/${TAG}/ (scripts/vqa/vqa.py, Qwen3-VL), the uniform baseline in data/raw/vqa/set.tsv`,
    notes: [
      "Answers are read from 13 sampled frames: 0, 0.5, 1, 1.5, 2, 3 s, six spread over the rest, and the last half second. Anything shown only between samples is unseen.",
      "No identity or demographic inference: people are counted, nothing else.",
      "Accuracy per column is the hand audit's, in data/generated/model/vqa-audit.json.",
    ],
    columns: COLUMNS,
    crossCheck: { ...CROSS_CHECK, againstCompositionOcr: { rows: both.length, agreement: both.length ? Math.round((agree / both.length) * 1000) / 1000 : null, ...tab, captionedWithOcrText: capVsOcr.filter(([id]) => comp[id].textFrameShare > 0).length, captioned: capVsOcr.length } },
    coverage,
    distribution: dist,
    shorts,
  }
  fs.writeFileSync(path.join(root, "data/generated/model/vqa-census.json"), JSON.stringify(out))
  console.log(JSON.stringify({ coverage, crossCheck: out.crossCheck.againstCompositionOcr, distribution: dist }, null, 1))
}
