// Window Q step 3: each census column's association with outperformed-3x, by the repo's feature-lift formula —
// the Breakout lift (src/lib/formulas.ts; the same arithmetic as scripts/metadata-lift.mjs): per channel, the
// share of shorts with the trait at 3x the channel median or more, minus the share without (3+ shorts a side,
// the 300 newest per channel), pooled with weights 2ab/(a+b), in points; 90% range from 1,000 resamples of
// channels, seeded as metadata-lift is. Pool: the uniform baseline's settled shorts with an answer.
// Enums and counts enter as yes/no traits (TRAITS below).
//
// Usage: node scripts/vqa/lift.mjs     (after merge.mjs)  -> data/generated/model/vqa-lift.json
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"))
const CAP = 300
const DRAWS = 1000
const census = read("data/generated/model/vqa-census.json")
const catalog = read("data/velocity/catalog.json").videos

const FORMATS = ["talking head", "graphic card", "b-roll", "rally", "news clip", "interview", "other"]
const SETTINGS = ["indoor", "outdoor", "studio", "archival", "graphics only"]
export const TRAITS = [
  ["captionsBurnedIn", "Captions burned in", "captionsBurnedIn", (c) => c.captionsBurnedIn === 1],
  ["callToAction", "Call to action shown", "callToAction", (c) => c.callToAction === 1],
  ["ctaInHook", "Call to action shown in the first 3 s", "callToAction", (c) => c.callToAction === 1 && c.ctaSec != null && c.ctaSec <= 3],
  ...FORMATS.map((f) => [`format:${f}`, `Format: ${f}`, "format", (c) => c.format === f]),
  ...SETTINGS.map((s) => [`setting:${s}`, `Setting: ${s}`, "setting", (c) => c.setting === s]),
  ["noPeople", "No person on screen in any sampled frame", "peopleMax", (c) => c.peopleMax === 0],
  ["twoPlusPeople", "Two or more people in one frame", "peopleMax", (c) => c.peopleMax >= 2],
  ["personMostFrames", "A person on screen in half the sampled frames or more", "peopleScreenShare", (c) => c.peopleScreenShare >= 0.5],
  ["productShown", "Product shown", "productShown", (c) => c.productShown === 1],
  ["thirdPartyWatermark", "Third-party watermark", "thirdPartyWatermark", (c) => c.thirdPartyWatermark === 1],
]

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) {
  const pool = catalog.filter((v) => v.tier !== "unsettled" && census.shorts[v.id])
  const byChannel = new Map()
  for (const v of pool) byChannel.set(v.channelId, [...(byChannel.get(v.channelId) ?? []), v])
  for (const [id, vs] of byChannel) byChannel.set(id, vs.sort((a, b) => b.published.localeCompare(a.published)).slice(0, CAP))
  const pushed = (v) => (v.tier === "breakout" ? 1 : 0)
  const mean = (xs) => xs.reduce((t, x) => t + x, 0) / xs.length
  let seed = 20261006
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  function effect(test, col) {
    const parts = []
    for (const vs0 of byChannel.values()) {
      const vs = vs0.filter((v) => census.shorts[v.id][col] != null)
      const a = vs.filter((v) => test(census.shorts[v.id]))
      const b = vs.filter((v) => !test(census.shorts[v.id]))
      if (a.length < 3 || b.length < 3) continue
      parts.push({ d: mean(a.map(pushed)) - mean(b.map(pushed)), w: (2 * a.length * b.length) / (a.length + b.length), n: a.length, base: mean(b.map(pushed)) })
    }
    if (parts.length < 2) return null
    const wavg = (ps) => ps.reduce((t, p) => t + p.d * p.w, 0) / ps.reduce((t, p) => t + p.w, 0)
    const est = wavg(parts)
    const boots = []
    for (let i = 0; i < DRAWS; i++) boots.push(wavg(Array.from({ length: parts.length }, () => parts[Math.floor(rnd() * parts.length)])))
    boots.sort((x, y) => x - y)
    const r = (x) => Math.round(x * 1000) / 10
    return { points: r(est), low: r(boots[Math.floor(DRAWS * 0.05)]), high: r(boots[Math.floor(DRAWS * 0.95)]), channels: parts.length, videos: parts.reduce((t, p) => t + p.n, 0), basePushed: r(mean(parts.map((p) => p.base))) }
  }
  const all = [...byChannel.values()].flat()
  const rows = TRAITS.map(([key, label, col, test]) => {
    const e = effect(test, col)
    return { key, label, column: col, prevalence: Math.round((all.filter((v) => census.shorts[v.id][col] != null && test(census.shorts[v.id])).length / all.length) * 1000) / 10, ...e, measured: e ? e.low > 0 || e.high < 0 : false }
  })
  const out = {
    builtAt: new Date().toISOString(),
    method: `The Breakout lift (src/lib/formulas.ts): within-channel difference in the share of shorts outperforming 3x the channel median, percentage points; channels weighted 2ab/(a+b); at most ${CAP} recent shorts per channel, 3+ a side; 90% ranges from ${DRAWS} resamples of channels. "measured" = the 90% range excludes zero. Pool: the uniform baseline's settled shorts with an answer.`,
    census: census.version,
    videos: all.length,
    channels: byChannel.size,
    pushedShare: Math.round(mean(all.map(pushed)) * 1000) / 10,
    rows,
  }
  fs.writeFileSync(path.join(root, "data/generated/model/vqa-lift.json"), JSON.stringify(out, null, 1) + "\n")
  console.log(`${out.videos} shorts, ${out.channels} channels, ${out.pushedShare}% outperformed 3x`)
  for (const r of [...rows].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))) console.log(`${r.measured ? "*" : " "} ${r.label} | ${r.prevalence}% | ${r.points == null ? "—" : `${r.points >= 0 ? "+" : ""}${r.points} (${r.low} to ${r.high}), ${r.channels} ch`}`)
}
