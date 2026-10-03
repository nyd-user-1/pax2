import library from "../../data/library.json"
import takesJson from "../../data/generated/takes.json"
import featuresJson from "../../data/generated/features.json"

import type { Measure, MetricKey, Provenance, Script, Snapshot, Take } from "@/lib/types"
import { METRICS } from "@/lib/types"

// The catalog: what was recorded (scripts, takes) and what the box found in each take.
// Until the partner's own videos arrive, every take is a synthetic reading of a library
// script, and the interface says so wherever a take appears.

type RawTake = { id: string; script: string; voice: string; captions: boolean; cut: boolean; durationSec: number; lines: { t: number; text: string }[]; words: { t: number; w: string }[]; wordCount: number; footage?: string[] }

export const CLAIM = library.claim
export const SCRIPTS: Script[] = library.scripts.map((s) => {
  const words = s.text.split(/\s+/).filter(Boolean).length
  return { id: s.id, claimId: library.claim.id, title: s.title, short: (s as { short?: string }).short ?? s.title, framing: s.framing, text: s.text, words, seconds: Math.round((words / 130) * 60), source: s.source }
})
export const scriptById = (id: string) => SCRIPTS.find((s) => s.id === id)

export type TakeInfo = Take & { voice: string; captions: boolean; cut: boolean; synthetic: true; words: { t: number; w: string }[] }

// Card posters: the original full-color Mixkit still of one clip from the video's own footage,
// a different clip per voice so the cards differ. (The rendered frames came out grey.)
const VOICE_CLIP: Record<string, number> = { Ruth: 1, Stephen: 2, Danielle: 3 }
function posterOf(t: RawTake) {
  const ids = (t.footage ?? []).map((f) => f.replace("mixkit:", ""))
  const id = ids[(VOICE_CLIP[t.voice] ?? 0) % Math.max(1, ids.length)]
  return id ? `https://assets.mixkit.co/videos/${id}/${id}-thumb-720-0.jpg` : `/api/video/${t.id}?poster=1`
}

export const TAKES: TakeInfo[] = (takesJson as unknown as RawTake[]).map((t) => ({
  id: t.id,
  scriptId: t.script,
  messenger: { label: t.voice, role: "Stand-in voice" },
  durationSec: t.durationSec,
  video: { src: `/api/video/${t.id}`, poster: posterOf(t) },
  lines: t.lines,
  words: t.words,
  voice: t.voice,
  captions: t.captions,
  cut: t.cut,
  synthetic: true,
}))
export const takeById = (id: string) => TAKES.find((t) => t.id === id)

export const takeLabel = (t: TakeInfo) => [t.voice, t.captions ? null : "no captions", t.cut ? "short cut" : null].filter(Boolean).join(" · ")

export const MESSENGERS = [...new Set(TAKES.map((t) => t.voice))]

// ---------- Features from the box (Transcribe, Rekognition, Pegasus, ffmpeg) ----------

export type Features = {
  take: string
  analyzedAt: string
  audio?: { source: Provenance; durationSec: number; loudnessDb: number[]; pitchHz: (number | null)[]; pitchMedianHz: number | null; pitchRangeHz: [number, number] | null; pauses: { t: number; sec: number }[]; loudestSec: number[]; quietestSec: number[]; error?: string }
  transcript?: { source: Provenance; text: string; words: { t: number; w: string }[]; wpm: number | null; firstWordSec: number | null; error?: string }
  shots?: { source: Provenance; segments: { type: string; start: number; end: number; kind?: string }[]; error?: string }
  onScreenText?: { source: Provenance; bySecond: Record<string, string[]>; secondsWithText: number; error?: string }
  pegasus?: {
    source: Provenance
    model: string
    ok: boolean
    result?: {
      summary?: string
      hook?: { t: number; text: string; assessment: string }
      observations?: { t: number; end?: number; what: string }[]
      characteristics?: Record<string, string>
      accessibility?: string[]
    } | null
    raw?: string
    error?: string
  }
}

export const FEATURES = featuresJson as unknown as Record<string, Features>
export const featuresFor = (id: string): Features | undefined => FEATURES[id]

// ---------- Paid results: Meta Ads Manager's export format ----------

const COLUMN: Record<string, MetricKey> = {
  "Amount spent (USD)": "spend",
  Impressions: "impressions",
  Reach: "reach",
  "3-second video plays": "plays3s",
  ThruPlays: "thruplays",
  "Video plays at 25%": "p25",
  "Video plays at 50%": "p50",
  "Video plays at 75%": "p75",
  "Video plays at 100%": "p100",
  "Video average play time": "avgWatchSec",
  "Post shares": "shares",
  "Post saves": "saves",
  "Post comments": "comments",
  "Post reactions": "reactions",
  "Link clicks": "linkClicks",
}

export const METRIC_LABEL: Record<MetricKey, string> = Object.fromEntries(Object.entries(COLUMN).map(([k, v]) => [v, k])) as Record<MetricKey, string>

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ",") row.push(cell), (cell = "")
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(cell)
      if (row.some((x) => x !== "")) rows.push(row)
      row = []
      cell = ""
    } else cell += c
  }
  if (cell || row.length) row.push(cell), rows.push(row)
  return rows
}

/** FNV-1a, enough to key a file and a snapshot deterministically. */
export function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}

export type Parsed = { snapshots: Snapshot[]; unmatched: string[]; missingColumns: string[]; fileHash: string }

/** Parse an export into snapshots. Each row is keyed by flight + reporting window + as-of date, so a reload is recognizable. */
export function parseExport(text: string, dataset: string, asOf: string, source: Provenance): Parsed {
  const rows = parseCsv(text.trim())
  const head = rows[0] ?? []
  const idx = (name: string) => head.indexOf(name)
  const missingColumns = Object.keys(COLUMN).filter((c) => idx(c) < 0)
  const unmatched: string[] = []
  const snapshots: Snapshot[] = []
  for (const r of rows.slice(1)) {
    const adId = r[idx("Ad ID")] ?? ""
    const takeId = adId.replace(/^ad-/, "")
    if (!takeById(takeId)) {
      unmatched.push(r[idx("Ad name")] || adId)
      continue
    }
    const start = r[idx("Reporting starts")]
    const end = r[idx("Reporting ends")]
    const metrics = {} as Record<MetricKey, Measure>
    for (const m of METRICS) {
      const i = idx(METRIC_LABEL[m])
      const raw = i >= 0 ? r[i] : undefined
      const n = raw == null || raw === "" ? null : Number(raw)
      metrics[m] = { value: n == null || Number.isNaN(n) ? null : n, source }
    }
    const flightId = `fl-${takeId}`
    snapshots.push({ id: `${flightId}~${start}~${end}~${asOf}`, flightId, asOf, windowStart: start, windowEnd: end, dataset, metrics })
  }
  return { snapshots, unmatched, missingColumns, fileHash: hash(text.trim()) }
}

export const takeOfFlight = (flightId: string) => flightId.replace(/^fl-/, "")

// Stand-in faces for the stand-in voices (Unsplash, free to use, hotlinked as Unsplash asks),
// one per messenger so a voice keeps its face across takes. Replaced by real posters with real videos.
const FACES: Record<string, string> = {
  Ruth: "https://images.unsplash.com/photo-1758273706454-b85bc7796b5e",
  Danielle: "https://images.unsplash.com/photo-1758874384555-de68b8035c24",
  Stephen: "https://images.unsplash.com/photo-1758874574136-6506197be737",
}
export const faceFor = (voice: string, w = 480) => (FACES[voice] ? `${FACES[voice]}?w=${w}&h=${Math.round(w * 16 / 9)}&fit=crop&crop=faces&q=70` : undefined)
