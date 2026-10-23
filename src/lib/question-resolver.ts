import "server-only"

import fs from "node:fs"
import path from "node:path"

import { generatedJson } from "@/lib/generated-store"
import { CHIP_QUESTIONS, auditLine, questionById, type Register } from "@/lib/question-bank"

// The answering layer for the question bank (src/lib/question-bank.ts): one resolver per chip question,
// typed lookups over stored measurements, no model call. The expensive joins (catalog, transcripts, the
// per-short composition files, the serving index's neighbors) come precomputed in
// data/generated/question-bank.json (scripts/question-bank/build.mjs); the committed stores are read here.

export type Answer = {
  id: string
  ask: string
  /** The answer, markdown, scientific voice. Empty when `unlock` stands in for it. */
  text: string
  basis: string
  /** The census audit line, once, quietly. */
  audit?: string
  /** A grounded recommendation's citation; present only where a measured lift backs it. */
  citation?: string
  /** What the reader does when this video lacks the measurement. */
  unlock?: string
}

type BankShort = {
  t?: string; ch?: string; v?: number; m?: number; r?: number; tier?: string; lk?: number | null; cm?: number | null; d?: number; pub?: string
  n?: number; last?: string; h3?: number; end?: { text: number; lufs: number | null }; nb: [number, number][]
}
type Bank = { ids: string[]; quantiles: Record<string, number[]>; family: Record<string, string>; clusters: { id: number; n: number; label: string }[]; shorts: Record<string, BankShort> }
type Census = { callToAction: number; ctaSec?: number | null; format: string; setting: string; peopleScreenShare: number; captionsBurnedIn: number; thirdPartyWatermark: number }
type Comp = Record<string, number | undefined>
type Reads = { axes: string[]; templates: Record<string, number[]>; topic: Record<string, number> }
type Mode = { name: string; center: Record<string, number>; survived: boolean; heldOut: { lift: number; base: number; videos: number; channels: number; liftOverBase90?: number[] } }
type Modes = { axes: Record<string, { label: string }>; full: { axes: string[]; modes: Mode[] }; scores: Record<string, number> }
type TopicLift = { topics: { id: number; name: string; lift: number; low: number; high: number; shorts: number; channels: number }[] }
type Split = { feature: string; pairs: number; breakout: number; control: number; breakoutHigher: number; q: number; channels?: number; scope?: number }
type Findings = { findings: Split[]; overall: Split[]; clusters: { cluster: number; n: number; pairs: number; channels: number; splits: Split[] }[] }
type Lengths = { crossing: { within: { seconds: number } }; overall: { outperform: number; underperform: number }; bins: { from: number; to: number; n: number; within: { outperform: number; underperform: number } }[] }
type LiftRow = { key: string; label: string; column: string; points?: number; low?: number; high?: number; channels?: number; videos?: number; measured: boolean }
type Policy = { features: string[]; mean: number[]; context: { log10ChannelMedian: { mean: number; sd: number } }; arms: { length: string[]; hourBlocksET: string[] } }
type SwayTrait = { key: string; label: string; ads: number; diff: number; low: number; high: number }
type Codes = { swayable?: string[]; wesleyan?: string; upworthy?: { patterns: string[] } }
type UpPattern = { key: string; label: string; won: number; lost: number }
type Velocity = { byId: Record<string, { channelId: string; views1h: number | null; views6h: number | null; views24h: number | null; views72h: number | null }> }

const cache = new Map<string, unknown>()
/** Each store read once. The path is written out at every call so the build's file tracing ships it. */
function load<T>(key: string, read: () => string): T | null {
  if (cache.has(key)) return cache.get(key) as T | null
  let v: T | null = null
  try {
    v = JSON.parse(read()) as T
  } catch {}
  cache.set(key, v)
  return v
}
// The bank, the census and the codebook are read through generated-store (S3 in production, never
// bundled); ready() loads them before any resolver runs, so the resolvers stay synchronous.
let _bank: Bank | null = null
let _census: Record<string, Census> = {}
let _codebook: Record<string, Codes> = {}
async function ready() {
  const [b, c, k] = await Promise.all([
    generatedJson<Bank>("question-bank"),
    generatedJson<{ shorts: Record<string, Census> }>("vqa-census"),
    generatedJson<Record<string, Codes>>("codebook"),
  ])
  _bank = b
  _census = c?.shorts ?? {}
  _codebook = k ?? {}
}
const bank = () => _bank
const census = () => _census
const comp = () => load<{ shorts: Record<string, Comp> }>("data/generated/model/composition.json", () => fs.readFileSync(path.join(process.cwd(), "data/generated/model/composition.json"), "utf8"))?.shorts ?? {}
const reads = () => load<Reads>("data/generated/video-reads.json", () => fs.readFileSync(path.join(process.cwd(), "data/generated/video-reads.json"), "utf8"))
const modes = () => load<Modes>("data/generated/model/winning-modes.json", () => fs.readFileSync(path.join(process.cwd(), "data/generated/model/winning-modes.json"), "utf8"))
const topicLift = () => load<TopicLift>("data/generated/model/topic-lift.json", () => fs.readFileSync(path.join(process.cwd(), "data/generated/model/topic-lift.json"), "utf8"))?.topics ?? []
const findings = () => load<Findings>("data/generated/model/composition-findings.json", () => fs.readFileSync(path.join(process.cwd(), "data/generated/model/composition-findings.json"), "utf8"))
const lengths = () => load<Lengths>("data/generated/model/length-crossing.json", () => fs.readFileSync(path.join(process.cwd(), "data/generated/model/length-crossing.json"), "utf8"))
const lift = () => load<{ rows: LiftRow[]; videos: number; channels: number }>("data/generated/model/vqa-lift.json", () => fs.readFileSync(path.join(process.cwd(), "data/generated/model/vqa-lift.json"), "utf8"))
const policy = () => load<Policy>("data/generated/model/martian-publish-policy.json", () => fs.readFileSync(path.join(process.cwd(), "data/generated/model/martian-publish-policy.json"), "utf8"))
const sway = () => load<{ traits: SwayTrait[] }>("data/generated/swayable-patterns.json", () => fs.readFileSync(path.join(process.cwd(), "data/generated/swayable-patterns.json"), "utf8"))?.traits ?? []
const codebook = () => _codebook
const upworthy = () => load<{ patterns: UpPattern[] }>("data/generated/upworthy-top.json", () => fs.readFileSync(path.join(process.cwd(), "data/generated/upworthy-top.json"), "utf8"))?.patterns ?? []
const velocity = () => load<Velocity>("data/generated/model/velocity-features.json", () => fs.readFileSync(path.join(process.cwd(), "data/generated/model/velocity-features.json"), "utf8"))?.byId ?? {}
const channelNames = () => {
  const c = load<{ id: string; name: string }[]>("data/velocity/channels.json", () => fs.readFileSync(path.join(process.cwd(), "data/velocity/channels.json"), "utf8")) ?? []
  return new Map(c.map((x) => [x.id, x.name]))
}

// ── formatting ──────────────────────────────────────────────────────────────────────────────────
const n = (x: number) => x.toLocaleString("en-US")
const ord = (p: number) => {
  const r = Math.round(p)
  const s = r % 100 >= 11 && r % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][r % 10] ?? "th"
  return `${r}${s}`
}
const times = (r: number) => `${r >= 10 ? r.toFixed(0) : r.toFixed(1)}×`
const signed = (x: number, d = 1) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(d)}`
const range = (lo: number, hi: number) => `${signed(lo)} to ${signed(hi)}`
const pctOf = (x: number, of: number) => Math.round((x / of) * 100)
/** Percentile of x against 101 stored quantiles. */
const quantile = (x: number, q: number[]) => {
  let p = 0
  for (let i = 0; i < q.length; i++) if (q[i] <= x) p = i
  return p
}
const titleOf = (id: string) => (bank()?.shorts[id]?.t ?? id).replace(/\s*#\w+/g, "").trim()
const link = (id: string) => `[${titleOf(id).replace(/[[\]]/g, "")}](/v/yt-${id})`

const FEATURE_LABEL: Record<string, string> = {
  cutsPerSec: "cuts per second", firstCutSec: "seconds to the first cut", cutsHook: "cuts in the first 2 s", visualActivity: "visual activity",
  loudnessLufs: "loudness (LUFS)", loudnessRange: "loudness range", hookLoudnessDelta: "opening loudness over the whole (LU)",
  textWordsPerFrame: "on-screen words per frame", textFrameShare: "share of seconds with on-screen text", textHook: "on-screen words in the first 2 s",
  brightness: "brightness", saturation: "saturation", speechWps: "spoken words per second", firstWordSec: "seconds to the first spoken word",
  wordsHook: "spoken words in the first 2 s", speechShare: "share of audible seconds with speech", durationSec: "length (s)",
  titleWords: "title words", titleQuestion: "a question in the title", titleNumber: "a number in the title", titleCapsRun: "all-caps run in the title",
  titleEmoji: "an emoji in the title", titleChars: "title characters", likeRate: "like rate", commentRate: "comment rate",
}
const label = (k: string) => modes()?.axes[k]?.label ?? FEATURE_LABEL[k] ?? k
const fmt = (k: string, x: number) => (k === "textFrameShare" || k === "speechShare" ? `${Math.round(x * 100)}%` : k === "visualActivity" ? x.toFixed(3) : `${Math.round(x * 100) / 100}`)

/** Plain edit directions for the craft axes: [when the target is higher, when it is lower]. */
const EDIT: Record<string, [string, string]> = {
  cutsPerSec: ["Cut more often", "Hold shots longer"],
  firstCutSec: ["Hold the first shot longer", "Make the first cut sooner"],
  cutsHook: ["Cut more in the first 2 s", "Cut less in the first 2 s"],
  visualActivity: ["Add more movement on screen", "Keep the picture steadier"],
  loudnessLufs: ["Mix it louder", "Mix it quieter"],
  loudnessRange: ["Let the loudness vary more", "Keep the loudness more even"],
  hookLoudnessDelta: ["Open louder than the rest", "Open quieter than the rest"],
  textWordsPerFrame: ["Put more words on screen", "Put fewer words on screen"],
  textFrameShare: ["Keep text on screen for more of it", "Keep text on screen for less of it"],
  textHook: ["Put words on screen in the first 2 s", "Put fewer words on screen in the first 2 s"],
  brightness: ["Brighten the picture", "Darken the picture"],
  saturation: ["Use more saturated color", "Use less saturated color"],
  speechWps: ["Talk faster", "Talk slower"],
  firstWordSec: ["Start talking later", "Start talking sooner"],
  wordsHook: ["Say more in the first 2 s", "Say less in the first 2 s"],
  speechShare: ["Talk for more of it", "Leave more room without speech"],
  durationSec: ["Make it longer", "Make it shorter"],
}

const template = (id: string) => {
  const r = reads()
  const t = r?.templates[id]
  return r && t ? Object.fromEntries(r.axes.map((a, i) => [a, t[i]])) as Record<string, number> : null
}
const survivingMode = () => modes()?.full.modes.find((m) => m.survived) ?? null
const channelShorts = (ch: string) => Object.entries(bank()?.shorts ?? {}).filter(([, s]) => s.ch === ch)
const liftRow = (key: string) => lift()?.rows.find((r) => r.key === key)
const cta = () => liftRow("callToAction")
const CTA_CITATION = "On-screen call to action: the feature lift formula over 4,396 settled shorts in 57 channels, within-channel, 90% range from 1,000 channel resamples (data/generated/model/vqa-lift.json); the column read 94 of 99 right in audit."

// ── resolvers ───────────────────────────────────────────────────────────────────────────────────
type Out = Omit<Answer, "id" | "ask" | "basis">
type Resolver = (id: string) => Out | null
const RUN_FLASK = "Run the flask: the file's cuts, loudness and on-screen text are measured from the media"
const ADD_CAPTIONS = "Add captions: the transcript comes from captions or a Whisper pass"

const R: Record<string, Resolver> = {
  "cta-when": (id) => {
    const c = census()[id]
    if (!c) return null
    return c.callToAction
      ? { text: `An on-screen call to action shows at **${c.ctaSec} s**${bank()?.shorts[id]?.d ? ` of ${bank()!.shorts[id].d} s` : ""}.`, audit: `${auditLine("callToAction")}; the second within 2 s on 28 of 28` }
      : { text: "No on-screen call to action in the 13 sampled frames.", audit: auditLine("callToAction") }
  },
  "script-length": (id) => {
    const s = bank()?.shorts[id]
    if (!s?.n) return null
    const d = comp()[id]?.durationSec ?? s.d
    return { text: `**${n(s.n)} words**${d ? ` over ${Math.round(d)} s, ${Math.round((s.n / d) * 60)} words a minute` : ""}.` }
  },
  format: (id) => {
    const c = census()[id]
    return c ? { text: `**${c.format.replace(/^./, (x) => x.toUpperCase())}**, the dominant format across the sampled frames.`, audit: auditLine("format") } : null
  },
  setting: (id) => {
    const c = census()[id]
    return c ? { text: `**${c.setting.replace(/^./, (x) => x.toUpperCase())}**, the dominant setting across the sampled frames.`, audit: auditLine("setting") } : null
  },
  "persuasion-traits": (id) => {
    const keys = codebook()[id]?.swayable
    if (!keys) return null
    const traits = sway().filter((t) => keys.includes(t.key)).sort((a, b) => b.diff - a.diff)
    if (!traits.length) return { text: "None of Swayable's 28 traits is coded present." }
    return { text: `${traits.length} of Swayable's 28 traits, each with its measured difference in vote choice:\n\n${traits.map((t) => `- ${t.label}: ${signed(t.diff, 2)} points (90% range ${signed(t.low, 2)} to ${signed(t.high, 2)}, ${t.ads} ads)`).join("\n")}` }
  },
  "ad-goal": (id) => {
    const g = codebook()[id]?.wesleyan
    if (!g) return null
    const line = g === "persuade" ? "Yes: the Wesleyan coding reads its goal as **persuading voters**." : g === "neither" ? "No: the Wesleyan coding reads it as **neither persuasion nor fundraising**." : `The Wesleyan coding reads its goal as **${g}**.`
    return { text: line }
  },
  "hook-opens-on": (id) => {
    const c = census()[id]
    const s = bank()?.shorts[id]
    if (!c || s?.h3 == null) return null
    const person = ["talking head", "interview", "rally"].includes(c.format)
    const footage = ["b-roll", "news clip"].includes(c.format)
    const opens = person ? "a person on camera" : footage ? "footage" : c.format === "graphic card" ? "a graphic" : "a mixed picture"
    return { text: `The first three sampled seconds carry **${s.h3} on-screen words** (OCR). The dominant format is ${c.format}, so the opening most likely shows ${opens}${s.h3 >= 3 ? ", with text over it" : ""}.`, audit: `format ${auditLine("format")}` }
  },
  "on-mute": (id) => {
    const f = comp()[id]
    const c = census()[id]
    if (f?.textFrameShare == null || !c) return null
    const share = Math.round(f.textFrameShare * 100)
    const under = c.captionsBurnedIn && share < 30 ? " Styled caption fonts often fall under the OCR's confidence floor, so the OCR share undercounts them." : ""
    return { text: `**${share}%** of seconds carry on-screen text, ${f.textWordsPerFrame ?? 0} words a frame on average (OCR, one frame a second). Captions ${c.captionsBurnedIn ? "**are**" : "are **not**"} burned in.${under}`, audit: `captions ${auditLine("captionsBurnedIn")}` }
  },
  "loud-enough": (id) => {
    const f = comp()[id]
    const q = bank()?.quantiles.loudnessLufs
    if (f?.loudnessLufs == null || !q) return null
    return { text: `Integrated loudness **${f.loudnessLufs} LUFS**, the ${ord(quantile(f.loudnessLufs, q))} percentile of the 5,379 baseline shorts (median ${q[50]} LUFS). Loudness range ${f.loudnessRange} LU.` }
  },
  ending: (id) => {
    const s = bank()?.shorts[id]
    const c = census()[id]
    const f = comp()[id]
    if (!s?.end) return null
    const d = f?.durationSec ?? s.d ?? 0
    const ask = c?.callToAction && c.ctaSec != null && c.ctaSec >= d - 3 ? "; an on-screen call to action shows in that stretch" : ""
    const lufs = s.end.lufs != null ? `, at ${s.end.lufs} LUFS against ${f?.loudnessLufs ?? "?"} for the whole short` : ""
    return { text: `The last 3 s: on-screen text in ${s.end.text} of 3 sampled seconds${lufs}${ask}.${s.last ? ` The last words: “${s.last.replace(/[.!?,;:]+$/, "")}”.` : ""}` }
  },
  motion: (id) => {
    const f = comp()[id]
    const t = template(id)
    if (f?.visualActivity == null || !t) return null
    return { text: `Visual activity **${f.visualActivity.toFixed(3)}** (mean frame-to-frame scene score), the ${ord(t.visualActivity)} percentile of the channel's shorts; ${f.cutsPerSec ?? 0} cuts a second, the ${ord(t.cutsPerSec)} percentile.` }
  },
  title: (id) => {
    const f = comp()[id]
    const q = bank()?.quantiles.titleChars
    if (f?.titleChars == null || !q) return null
    const traits = [f.titleQuestion ? "a question" : null, f.titleNumber ? "a number" : null, f.titleCapsRun ? `a run of ${f.titleCapsRun} all-caps word${f.titleCapsRun === 1 ? "" : "s"}` : null, f.titleEmoji ? "an emoji" : null].filter(Boolean)
    return { text: `${f.titleWords} words, ${f.titleChars} characters: the ${ord(quantile(f.titleChars, q))} percentile of baseline titles by length (median ${q[50]}). ${traits.length ? `It carries ${traits.join(", ")}.` : "No question, number, all-caps run or emoji."}` }
  },

  "outlier-score": (id) => {
    const s = bank()?.shorts[id]
    if (s?.v == null || !s.m || s.r == null) return null
    const verdict = s.r >= 3 ? "It outperformed 3x." : s.r <= 0.5 ? "It fell to half the channel median or less." : "It landed between half and 3x the channel median."
    return { text: `${n(s.v)} views against a channel median of ${n(Math.round(s.m))}: an Outlier Score of **${times(s.r)}**. ${verdict}` }
  },
  "why-outperformed": (id) => {
    const s = bank()?.shorts[id]
    const c = census()[id]
    if (s?.r == null || !c) return null
    const carried: string[] = []
    const row = (key: string, note: string) => {
      const r = liftRow(key)
      if (r?.measured && r.points != null) carried.push(`- ${r.label}: ${signed(r.points)} points (90% range ${range(r.low!, r.high!)}, ${r.channels} channels)${note}`)
    }
    if (c.callToAction) row("callToAction", "")
    row(`format:${c.format}`, `; descriptive, format ${auditLine("format")}`)
    if (c.peopleScreenShare >= 0.5) row("personMostFrames", "; descriptive")
    const topic = reads()?.topic[id]
    const tl = topicLift().find((t) => t.id === topic)
    if (tl && (tl.low > 0 || tl.high < 0)) carried.push(`- Topic, ${tl.name}: ${signed(tl.lift)} points (90% range ${range(tl.low, tl.high)}, ${tl.channels} channels)`)
    const head = s.r >= 3 ? `Outlier Score **${times(s.r)}**: it outperformed 3x.` : `Outlier Score **${times(s.r)}**: it did not outperform 3x.`
    return { text: carried.length ? `${head} Of the traits measured to move the outperform rate within channels, it carries:\n\n${carried.join("\n")}\n\nThese are associations across channels, not causes of this one result.` : `${head} It carries none of the traits with a measured lift.` }
  },
  "channel-rank": (id) => {
    const s = bank()?.shorts[id]
    if (!s?.ch || s.r == null) return null
    const list = channelShorts(s.ch).filter(([, x]) => x.r != null).sort((a, b) => b[1].r! - a[1].r!)
    const rank = list.findIndex(([x]) => x === id) + 1
    const out = list.filter(([, x]) => x.r! >= 3).length
    return { text: `**${ord(rank)} of ${list.length}** of the channel's baseline shorts by Outlier Score (${times(s.r)}); ${out} of the ${list.length} outperformed 3x.` }
  },
  "best-video-diff": (id) => {
    const s = bank()?.shorts[id]
    const mine = template(id)
    if (!s?.ch || !mine) return null
    const list = channelShorts(s.ch).filter(([x, v]) => x !== id && v.r != null).sort((a, b) => b[1].r! - a[1].r!)
    const top = list[0]
    if (!top) return null
    const [best, bv] = top
    const theirs = template(best)
    if (!theirs) return null
    const self = (s.r ?? 0) > (bv.r ?? 0)
    const axes = Object.keys(EDIT).filter((a) => mine[a] != null && theirs[a] != null)
    const gaps = axes.map((a) => ({ a, d: theirs[a] - mine[a] })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 4)
    return {
      text: `${self ? "This is the channel's best by Outlier Score; the next is" : "The channel's best by Outlier Score is"} ${link(best)} at **${times(bv.r ?? 0)}**. The widest gaps, in channel percentiles (that video against this one):\n\n${gaps.map((g) => `- ${label(g.a)}: ${ord(theirs[g.a])} against ${ord(mine[g.a])}`).join("\n")}`,
    }
  },
  neighbors: (id) => {
    const b = bank()
    const s = b?.shorts[id]
    if (!b || !s?.nb.length) return null
    const names = channelNames()
    return { text: `Nearest in the serving index, from other channels:\n\n${s.nb.slice(0, 5).map(([i, sim]) => { const nid = b.ids[i]; const o = b.shorts[nid]; return `- ${link(nid)} · ${names.get(o?.ch ?? "") ?? "another channel"} · ${o?.r != null ? times(o.r) : "–"} · cosine ${sim.toFixed(2)}` }).join("\n")}` }
  },
  "like-this-differently": (id) => {
    const b = bank()
    const s = b?.shorts[id]
    if (!b || !s?.nb.length) return null
    const nbs = s.nb.map(([i]) => b.ids[i])
    const up = nbs.filter((x) => (b.shorts[x]?.r ?? 0) >= 3)
    const rest = nbs.filter((x) => (b.shorts[x]?.r ?? 0) < 3)
    if (up.length < 3 || rest.length < 3) return { text: `Of its ${nbs.length} nearest neighbors from other channels, ${up.length} outperformed 3x: too few on one side to compare.` }
    const med = (ids: string[], k: string) => {
      const xs = ids.map((x) => comp()[x]?.[k]).filter((x): x is number => x != null).sort((a, z) => a - z)
      return xs.length >= 3 ? xs[Math.floor(xs.length / 2)] : null
    }
    const keys = ["firstCutSec", "cutsPerSec", "textFrameShare", "textHook", "firstWordSec", "speechWps", "durationSec", "loudnessLufs"]
    const rows = keys
      .map((k) => ({ k, a: med(up, k), z: med(rest, k), me: comp()[id]?.[k] }))
      .filter((r): r is { k: string; a: number; z: number; me: number | undefined } => r.a != null && r.z != null)
      .map((r) => ({ ...r, rel: Math.abs(r.a - r.z) / (Math.abs(r.a) + Math.abs(r.z) || 1) }))
      .sort((x, y) => y.rel - x.rel)
      .slice(0, 4)
    return {
      text: `Of its ${nbs.length} nearest neighbors from other channels, **${up.length} outperformed 3x**. Medians, outperformers against the other ${rest.length}, with this short:\n\n| | outperformed | the rest | this one |\n|---|---|---|---|\n${rows.map((r) => `| ${label(r.k)} | ${fmt(r.k, r.a)} | ${fmt(r.k, r.z)} | ${r.me != null ? fmt(r.k, r.me) : "–"} |`).join("\n")}\n\nTwenty neighbors are a small sample; read the gaps as leads.`,
    }
  },
  topic: (id) => {
    const c = reads()?.topic[id]
    const cl = bank()?.clusters.find((x) => x.id === c)
    if (c == null || !cl) return null
    const tl = topicLift().find((t) => t.id === c)
    const name = tl?.name ?? `the cluster around “${cl.label}”`
    const l = tl ? ` Shorts on it outperform 3x ${Math.abs(tl.lift).toFixed(1)} points ${tl.lift >= 0 ? "more" : "less"} often than others in the same channels (90% range ${range(tl.low, tl.high)}, ${tl.channels} channels).` : " No lift is measured for it in 5+ channels."
    return { text: `Topic: **${name}** (${n(cl.n)} shorts in the encoder map).${l}` }
  },
  "good-length": (id) => {
    const d = comp()[id]?.durationSec ?? bank()?.shorts[id]?.d
    const L = lengths()
    if (d == null || !L) return null
    const bin = L.bins.find((b) => d >= b.from && d < b.to) ?? L.bins.at(-1)!
    return { text: `At **${Math.round(d)} s** it sits in the ${bin.from}–${bin.to} s bin: ${bin.within.outperform}% outperformed 3x and ${bin.within.underperform}% fell to half the channel median or less, within channels (all lengths: ${L.overall.outperform}% and ${L.overall.underperform}%). Past ${L.crossing.within.seconds} s the underperform share exceeds the outperform share.` }
  },
  "mode-match": (id) => {
    const m = survivingMode()
    const score = modes()?.scores[id]
    if (!m || score == null) return null
    return { text: `Mode-match **${score} of 100** against the one winning mode that held up on held-out channels: ${m.name}. Shorts on that mode outperformed 3x at ${Math.round(m.heldOut.lift * 1000) / 10}% against a base of ${Math.round(m.heldOut.base * 1000) / 10}% (${m.heldOut.videos} videos, ${m.heldOut.channels} channels).` }
  },
  "craft-extremes": (id) => {
    const t = template(id)
    if (!t) return null
    const top = Object.entries(t).filter(([a]) => !a.startsWith("title")).sort((a, b) => Math.abs(b[1] - 50) - Math.abs(a[1] - 50)).slice(0, 4)
    return { text: `Furthest from the channel's usual, in channel percentiles:\n\n${top.map(([a, p]) => `- ${label(a)}: ${ord(p)}`).join("\n")}` }
  },
  "hook-vs-winners": (id) => {
    const f = comp()[id]
    const F = findings()
    if (!f || f.cutsHook == null || !F) return null
    const keys = ["firstCutSec", "cutsHook", "textHook", "wordsHook", "firstWordSec", "hookLoudnessDelta"]
    const rows = keys.map((k) => ({ k, s: F.overall.find((x) => x.feature === k), me: f[k] })).filter((r) => r.s)
    return {
      text: `Medians over ${n(F.overall[0]?.pairs ?? 2770)} within-channel pairs, an outperformer against a same-channel control:\n\n| | this one | outperformers | controls | q |\n|---|---|---|---|---|\n${rows.map((r) => `| ${label(r.k)} | ${r.me != null ? fmt(r.k, r.me) : "–"} | ${fmt(r.k, r.s!.breakout)} | ${fmt(r.k, r.s!.control)} | ${r.s!.q < 0.001 ? "<0.001" : r.s!.q.toFixed(2)} |`).join("\n")}\n\nq under 0.1 marks a difference that survives the false-discovery correction over 721 tests.`,
    }
  },
  "format-field": (id) => {
    const c = census()[id]
    if (!c) return null
    const r = liftRow(`format:${c.format}`)
    if (!r || r.points == null) return { text: `Too few ${c.format} shorts to measure a lift.`, audit: auditLine("format") }
    const status = r.measured ? "Descriptive: the format read is under the 0.85 accuracy a recommendation needs." : "Not measured: the 90% range crosses zero or fewer than 5 channels carry it."
    return { text: `${c.format.replace(/^./, (x) => x.toUpperCase())} shorts outperform 3x **${Math.abs(r.points).toFixed(1)} points ${r.points >= 0 ? "more" : "less"} often** than others in the same channels (90% range ${range(r.low!, r.high!)}, ${r.channels} channels, ${n(r.videos ?? 0)} shorts). ${status}`, audit: auditLine("format") }
  },
  engagement: (id) => {
    const s = bank()?.shorts[id]
    const t = template(id)
    if (!s?.v || !t) return null
    if (s.lk == null || s.cm == null) return { text: `YouTube returns no ${s.lk == null ? "like" : "comment"} count for this short, so the rates cannot be computed.` }
    return { text: `Like rate **${((s.lk / s.v) * 100).toFixed(2)}%**, the ${ord(t.likeRate)} percentile on the channel; comment rate **${((s.cm / s.v) * 100).toFixed(2)}%**, the ${ord(t.commentRate)} percentile.` }
  },
  "first-72h": (id) => {
    const v = velocity()[id]
    if (!v || v.views72h == null) return null
    const h = (x: number | null) => (x == null ? "–" : n(Math.round(x)))
    return { text: `${h(v.views1h)} views at 1 h, ${h(v.views6h)} at 6 h, ${h(v.views24h)} at 24 h, **${h(v.views72h)}** at 72 h.` }
  },
  "curve-vs-channel": (id) => {
    const V = velocity()
    const v = V[id]
    if (!v || v.views72h == null) return null
    const peers = Object.entries(V).filter(([x, p]) => x !== id && p.channelId === v.channelId && p.views24h != null).map(([, p]) => p.views24h!).sort((a, b) => a - b)
    if (peers.length < 3) return { text: `${n(Math.round(v.views24h ?? 0))} views at 24 h; the channel has ${peers.length} other tracked shorts, too few for a median.` }
    const med = peers[Math.floor(peers.length / 2)]
    return { text: `At 24 h it had **${n(Math.round(v.views24h ?? 0))}** views; the channel's tracked median at that hour is ${n(Math.round(med))} (${peers.length} shorts), so it ran **${times((v.views24h ?? 0) / (med || 1))}** the channel's pace.` }
  },
  "topic-splits": (id) => {
    const c = reads()?.topic[id]
    const F = findings()
    if (c == null || !F) return null
    const cl = F.clusters.find((x) => x.cluster === c)
    if (!cl) return { text: "This topic's cluster holds too few within-channel pairs (fewer than 50 shorts) to test." }
    const hit = F.findings.filter((x) => x.scope === c).sort((a, b) => a.q - b.q)
    const line = (s: Split) => `${label(s.feature)}: outperformers at ${fmt(s.feature, s.breakout)} against ${fmt(s.feature, s.control)} for their same-channel controls (${s.pairs} pairs; the outperformer runs higher in ${Math.round(s.breakoutHigher * 100)}% of pairs that differ; q = ${s.q < 0.001 ? "<0.001" : s.q.toFixed(3)})`
    if (hit.length) return { text: `In this topic's cluster (${cl.pairs} pairs, ${cl.channels} channel${cl.channels === 1 ? "" : "s"}):\n\n${hit.map((s) => `- ${line(s)}`).join("\n")}${cl.channels === 1 ? "\n\nOne channel carries the cluster, so this is that channel's pattern." : ""}` }
    const top = [...cl.splits].filter((s) => s.pairs >= 20).sort((a, b) => a.q - b.q)[0]
    return { text: `No craft split in this cluster clears q < 0.1 (${cl.pairs} pairs, ${cl.channels} channels).${top ? ` The strongest: ${line(top)}.` : ""}` }
  },
  "channel-format-winners": (id) => {
    const s = bank()?.shorts[id]
    if (!s?.ch) return null
    const C = census()
    const list = channelShorts(s.ch).filter(([x, v]) => C[x] && v.r != null)
    const up = list.filter(([, v]) => v.r! >= 3)
    const rest = list.filter(([, v]) => v.r! < 3)
    const tally = (xs: typeof list) => {
      const t: Record<string, number> = {}
      for (const [x] of xs) t[C[x].format] = (t[C[x].format] ?? 0) + 1
      return Object.entries(t).sort((a, b) => b[1] - a[1]).map(([f, k]) => `${f} ${k} (${pctOf(k, xs.length)}%)`).join(", ")
    }
    if (!up.length) return { text: `None of the channel's ${list.length} baseline shorts outperformed 3x. Formats: ${tally(list)}.`, audit: auditLine("format") }
    return { text: `The channel's **${up.length} outperformers**: ${tally(up)}. The other ${rest.length}: ${rest.length ? tally(rest) : "none"}.`, audit: auditLine("format") }
  },
  persuade: (id) => {
    const keys = codebook()[id]?.swayable
    if (!keys) return null
    const traits = sway().filter((t) => keys.includes(t.key))
    const lean = traits.reduce((x, t) => x + t.diff, 0)
    const top = [...traits].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 3)
    return { text: `Persuasion lean **${signed(lean, 2)} points** of vote choice: the summed differences of the ${traits.length} Swayable traits it carries.${top.length ? ` Largest: ${top.map((t) => `${t.label.toLowerCase()} ${signed(t.diff, 2)}`).join(", ")}.` : ""} No single trait's 90% range clears zero, so the lean is descriptive.` }
  },
  "title-patterns": (id) => {
    const pats = codebook()[id]?.upworthy?.patterns
    if (!pats) return null
    const rows = upworthy().filter((p) => pats.includes(p.key))
    if (!rows.length) return { text: "It carries none of the ten Upworthy headline patterns." }
    return { text: `It carries ${rows.length} of the ten Upworthy patterns. Share among headlines that won their test against those that lost:\n\n${rows.map((p) => `- ${p.label}: ${p.won}% of winners, ${p.lost}% of losers`).join("\n")}` }
  },

  "should-ask-onscreen": (id) => {
    const c = census()[id]
    const r = cta()
    if (!c || !r?.points) return null
    const here = c.callToAction ? `This short shows one at ${c.ctaSec} s. **Recommendation: take the on-screen ask out.**` : "This short shows none. **Recommendation: keep it that way.**"
    return { text: `Shorts with an on-screen call to action outperformed 3x **${Math.abs(r.points).toFixed(1)} points less often** than others in the same channels (90% range ${range(r.low!, r.high!)}, ${r.channels} channels). ${here}`, citation: CTA_CITATION, audit: auditLine("callToAction") }
  },
  "when-ask": (id) => {
    const c = census()[id]
    const r = cta()
    const d = comp()[id]?.durationSec ?? bank()?.shorts[id]?.d
    if (!c || !r?.points) return null
    const here = c.callToAction && c.ctaSec != null ? `The census reads an on-screen ask at ${c.ctaSec} s${d ? ` of ${Math.round(d)} s (${pctOf(c.ctaSec, d)}% through)` : ""}.` : "The census reads no on-screen ask."
    return { text: `${here} The measured lift is for asks shown on screen, mostly subscribe overlays and end cards: ${signed(r.points)} points (90% range ${range(r.low!, r.high!)}). **Recommendation: make the ask in the spoken script, not on screen.** Spoken asks carry no measurement either way.`, citation: CTA_CITATION, audit: auditLine("callToAction") }
  },
  "closer-to-mode": (id) => {
    const m = survivingMode()
    const t = template(id)
    if (!m || !t) return null
    const lean = Object.keys(m.center).filter((a) => EDIT[a]).map((a) => ({ a, l: Math.abs(m.center[a] - 50), d: m.center[a] - (t[a] ?? 50) })).sort((x, y) => y.l - x.l).slice(0, 8)
    const off = lean.filter((x) => Math.abs(x.d) > 15).sort((x, y) => Math.abs(y.d) * y.l - Math.abs(x.d) * x.l).slice(0, 3)
    const lift = `Shorts on the mode outperformed 3x at ${Math.round(m.heldOut.lift * 1000) / 10}% against ${Math.round(m.heldOut.base * 1000) / 10}% on held-out channels.`
    if (!off.length) return { text: `It already sits within 15 percentile points of the winning mode on every axis the mode leans on. ${lift}` }
    return {
      text: `${off.map((x) => `- **${EDIT[x.a][x.d > 0 ? 0 : 1]}**: ${label(x.a)} at the ${ord(t[x.a])} channel percentile here, the ${ord(m.center[x.a])} on the mode`).join("\n")}\n\n${lift}`,
      citation: `The winning mode (data/generated/model/winning-modes.json): the one craft configuration among outperformers whose lift re-measured above base on held-out channels${m.heldOut.liftOverBase90 ? `, ${range(m.heldOut.liftOverBase90[0] * 100, m.heldOut.liftOverBase90[1] * 100)} points over base (90% range)` : ""}.`,
    }
  },
  "one-change": (id) => {
    const c = census()[id]
    if (!c) return null
    const r = cta()
    if (c.callToAction && r?.points) return { text: `**Take the on-screen call to action out** (it shows at ${c.ctaSec} s). Shorts with one outperformed 3x ${Math.abs(r.points).toFixed(1)} points less often within the same channels (90% range ${range(r.low!, r.high!)}, ${r.channels} channels).`, citation: CTA_CITATION, audit: auditLine("callToAction") }
    const mode = R["closer-to-mode"](id)
    if (mode && mode.citation) {
      const first = mode.text.split("\n")[0].replace(/^- /, "")
      return { text: `${first}. That is the largest gap between this short and the winning mode, the one craft configuration whose lift held up on held-out channels.`, citation: mode.citation }
    }
    return { text: "No measured lift applies: it shows no on-screen ask and already sits on the winning mode." }
  },
  "next-topic": (id) => {
    const up = topicLift().filter((t) => t.low > 0).sort((a, b) => b.lift - a.lift).slice(0, 3)
    const mine = topicLift().find((t) => t.id === reads()?.topic[id])
    if (!up.length) return null
    return { text: `Topics that outperform 3x more often within the same channels, 90% range clear of zero:\n\n${up.map((t) => `- **${t.name}**: ${signed(t.lift)} points (${range(t.low, t.high)}, ${t.channels} channels)`).join("\n")}\n\nThis short's topic: ${mine ? `${mine.name}, ${signed(mine.lift)} points (${range(mine.low, mine.high)})` : "no lift measured in 5+ channels"}.` }
  },
  "more-persuasive": (id) => {
    const keys = codebook()[id]?.swayable
    if (!keys) return null
    const moves = sway()
      .filter((t) => t.ads >= 25)
      .map((t) => ({ t, present: keys.includes(t.key) }))
      .map((x) => ({ ...x, gain: x.present ? -x.t.diff : x.t.diff, clear: x.present ? x.t.high < 0 : x.t.low > 0 }))
      .filter((x) => x.gain > 0)
      .sort((a, b) => b.gain - a.gain)
    const grounded = moves.filter((x) => x.clear)
    const say = (x: (typeof moves)[number]) => `${x.present ? "drop" : "add"} ${x.t.label.toLowerCase()} (${signed(x.t.diff, 2)} points, 90% range ${signed(x.t.low, 2)} to ${signed(x.t.high, 2)}, ${x.t.ads} ads)`
    if (grounded.length) return { text: `**Recommendation: ${say(grounded[0])}.**`, citation: "Swayable replication archive (Hewitt et al., APSR 2024): 575 randomized ad tests, vote choice against a placebo (data/generated/swayable-patterns.json)." }
    return { text: `No Swayable trait's 90% range clears zero, so no change is recommended. The largest point estimates this script could move: ${moves.slice(0, 3).map(say).join("; ")}.` }
  },
  "when-post": (id) => publishAdvice(id, "hour"),
  "next-length": (id) => publishAdvice(id, "length"),
}

// ── the publish policy ──────────────────────────────────────────────────────────────────────────
const lengthArm = (d: number) => (d <= 30 ? "<=30s" : d <= 60 ? "31-60s" : d <= 90 ? "61-90s" : ">=91s")
const LENGTH_SAY: Record<string, string> = { "<=30s": "30 s or less", "31-60s": "31 to 60 s", "61-90s": "61 to 90 s", ">=91s": "91 s or more" }
const hourET = (iso: string) => Number(new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" })) % 24
const hourArm = (h: number) => `${Math.floor(h / 4) * 4}-${Math.floor(h / 4) * 4 + 3}`
const hourSay = (arm: string) => {
  const [a, b] = arm.split("-").map(Number)
  const clock = (h: number) => (h % 12 === 0 ? 12 : h % 12) + (h < 12 || h === 24 ? " a.m." : " p.m.")
  return `${clock(a)} to ${clock((b + 1) % 24 || 24).replace("12 a.m.", "midnight")} ET`
}
function publishAdvice(id: string, vary: "hour" | "length"): Out | null {
  const P = policy()
  const b = bank()
  const s = b?.shorts[id]
  const topic = reads()?.topic[id]
  const fam = s?.ch ? b?.family[s.ch] : undefined
  if (!P || !s?.m || !s.pub || topic == null || !fam) return null
  const w = new Map(P.features.map((f, i) => [f, P.mean[i]]))
  const z = (Math.log10(s.m) - P.context.log10ChannelMedian.mean) / P.context.log10ChannelMedian.sd
  const p = (len: string, hour: string) => {
    const keys = ["bias", `family=${fam}`, `topic=${topic}`, `length=${len}`, `hour=${hour}`, `family=${fam}|topic=${topic}`, `family=${fam}|hour=${hour}`, `family=${fam}|length=${len}`]
    const x = keys.reduce((acc, k) => acc + (w.get(k) ?? 0), 0) + z * (w.get("log10ChannelMedian(z)") ?? 0)
    return 1 / (1 + Math.exp(-x))
  }
  const len = lengthArm(comp()[id]?.durationSec ?? s.d ?? 45)
  const hour = hourArm(hourET(s.pub))
  const pc = (x: number) => `${Math.round(x * 100)}%`
  if (vary === "hour") {
    const all = P.arms.hourBlocksET.map((h) => ({ h, p: p(len, h) })).sort((a, b2) => b2.p - a.p)
    const best = all[0], worst = all.at(-1)!, mine = all.find((x) => x.h === hour)
    return { text: `For this topic, a ${LENGTH_SAY[len]} short and a ${fam.toLowerCase()} channel, **${hourSay(best.h)}** scores highest: a ${pc(best.p)} chance to outperform 3x, against ${pc(worst.p)} for ${hourSay(worst.h)}.${mine ? ` This one went out ${hourSay(mine.h)} (${pc(mine.p)}).` : ""}` }
  }
  const all = P.arms.length.map((l) => ({ l, p: p(l, hour) })).sort((a, b2) => b2.p - a.p)
  const best = all[0], worst = all.at(-1)!, mine = all.find((x) => x.l === len)
  return { text: `For this topic and a ${fam.toLowerCase()} channel, **${LENGTH_SAY[best.l]}** scores highest: a ${pc(best.p)} chance to outperform 3x, against ${pc(worst.p)} at ${LENGTH_SAY[worst.l]}.${mine ? ` This one runs ${LENGTH_SAY[mine.l]} (${pc(mine.p)}).` : ""}` }
}

// ── public ──────────────────────────────────────────────────────────────────────────────────────
/** One short's own measurements for the video page's Analytics block: its census answers (read from the
 *  frames) and its raw composition (extracted from the file). */
export async function videoFacts(ytId: string): Promise<{ census: Census | null; comp: Comp | null }> {
  await ready()
  return { census: census()[ytId] ?? null, comp: comp()[ytId] ?? null }
}

export async function resolveQuestion(questionId: string, ytId: string): Promise<Answer | null> {
  await ready()
  const q = questionById(questionId)
  const r = R[questionId]
  if (!q || !r) return null
  let out: Out | null = null
  try {
    out = r(ytId)
  } catch {
    out = null
  }
  return { id: q.id, ask: q.ask, basis: q.basis, ...(out ?? { text: "", unlock: q.unlock ?? (q.needs.includes("transcript") ? ADD_CAPTIONS : RUN_FLASK) }) }
}

/** The video is in the bank: chips can show for it. */
const inBank = (ytId: string) => !!bank()?.shorts[ytId]

export type Surface = "video-panel" | "chat"
/** The video page's wide-column tabs; each draws its chips from its own questions. */
export type ChipTab = "score" | "analysis" | "research" | "notes"
export const CHIP_TABS: ChipTab[] = ["score", "analysis", "research", "notes"]
const TAB_CHIPS: Record<ChipTab, string[]> = {
  score: ["outlier-score", "channel-rank", "first-72h", "curve-vs-channel", "mode-match", "closer-to-mode", "one-change", "why-outperformed", "engagement", "best-video-diff"],
  analysis: ["hook-opens-on", "on-mute", "loud-enough", "ending", "format", "setting", "motion", "craft-extremes", "hook-vs-winners", "topic", "good-length"],
  research: ["neighbors", "like-this-differently", "persuasion-traits", "ad-goal", "persuade", "title-patterns", "topic-splits", "channel-format-winners", "format-field", "should-ask-onscreen"],
  notes: ["script-length", "title", "cta-when", "when-ask", "when-post", "next-length", "next-topic"],
}
export type ChipOffer = { id: string; ask: string; register: Register; position: number; propensity: number }

/** Position slots by register for each surface: the video page leads with the video in hand, /chat
 *  with the field and what to do. */
const SLOTS: Record<Surface, Register[]> = {
  "video-panel": ["video", "video", "field", "action"],
  chat: ["field", "action", "video", "field"],
}

/** The chips for a video on a surface. Cold start (learning/chat-suggested-prompts.json): each slot draws
 *  uniformly from the eligible chips of its register not yet shown or tapped, so a chip's propensity at
 *  its position is exactly 1 / (eligible in that register at that draw). Eligible = rated 4-5; a chip
 *  whose measurement this video lacks still shows, and its answer is the unlocking action. */
export async function chipsFor(ytId: string, surface: Surface, exclude: string[] = [], tab?: ChipTab): Promise<ChipOffer[]> {
  await ready()
  if (!inBank(ytId)) return []
  const pool = CHIP_QUESTIONS.filter((q) => !exclude.includes(q.id))
  const out: ChipOffer[] = []
  // A tab's chips: three drawn uniformly from its own questions, so each propensity is 1 / (left at the draw).
  if (tab) {
    const left = pool.filter((q) => TAB_CHIPS[tab].includes(q.id))
    while (out.length < 3 && left.length) {
      const [q] = left.splice(Math.floor(Math.random() * left.length), 1)
      out.push({ id: q.id, ask: q.ask, register: q.register, position: out.length, propensity: Math.round((1 / (left.length + 1)) * 10000) / 10000 })
    }
    return out
  }
  for (const reg of SLOTS[surface]) {
    const left = pool.filter((q) => q.register === reg && !out.some((o) => o.id === q.id))
    if (!left.length) continue
    const q = left[Math.floor(Math.random() * left.length)]
    out.push({ id: q.id, ask: q.ask, register: reg, position: out.length, propensity: Math.round((1 / left.length) * 10000) / 10000 })
  }
  return out
}

