import fs from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"

// The encoder map for the graph's cluster layer: every corpus short's 2-D UMAP position and
// k-means cluster (data/generated/model/encoder-map.json, scripts/encoder/map.py), with the
// cluster statistic computed honestly here: lift is the mean of (outlier label minus the short's
// own channel's outlier rate), in percentage points, so a cluster made of one hot channel's
// shorts does not read as a content finding. The outlier label is already channel-relative
// (3x the channel's median); the lift removes the remaining composition confound.

export const dynamic = "force-dynamic"

type Point = { id: string; x: number; y: number; cluster: number; tier: string; breakout: number | null; family: string; channelId: string; label: string }
type CompFile = { builtAt: string; shorts: Record<string, Record<string, number>> }
type Chip = { key: string; label: string; field: string; op: "gte" | "lt" | "lte"; value: number; measured: number }

// The fields the Composition chips read, per point, from data/generated/model/composition.json
// (scripts/composition/merge.mjs). Duration covers every catalog short; the media and speech fields
// only the shorts that were extracted, so a point without one never matches its chip.
const COMP_FIELDS = ["durationSec", "cutsPerSec", "cutsHook", "textHook", "firstWordSec", "speechWps"] as const

const pct = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]
}
const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d

/** Chip thresholds come from the measured spread: "fast" is the top third of the shorts measured. */
function chipsFor(rows: Record<string, number>[]): Chip[] {
  const vals = (f: string) => rows.map((r) => r[f]).filter((v): v is number => v != null)
  const chips: Chip[] = []
  const add = (key: string, label: string, field: string, op: Chip["op"], value: number) => {
    const xs = vals(field)
    if (xs.length) chips.push({ key, label, field, op, value, measured: xs.length })
  }
  add("short", "Under 30 s", "durationSec", "lt", 30)
  add("long", "60 s and over", "durationSec", "gte", 60)
  const cuts = vals("cutsPerSec")
  if (cuts.length) {
    const t = round(pct(cuts, 2 / 3), 2)
    add("fast-cuts", `${t}+ cuts/s`, "cutsPerSec", "gte", t)
  }
  add("cut-hook", "Cut in the first 2 s", "cutsHook", "gte", 1)
  add("text-hook", "Text on screen in the first 2 s", "textHook", "gte", 2)
  add("first-word", "Speaks within 0.5 s", "firstWordSec", "lte", 0.5)
  const wps = vals("speechWps")
  if (wps.length) {
    const t = round(pct(wps, 2 / 3), 1)
    add("fast-talk", `${t}+ words/s`, "speechWps", "gte", t)
  }
  return chips
}

type MapFile = { run: string; builtAt: string; n: number; k: number; clusters: { id: number; n: number; outlierRate: number | null; labels: string[] }[]; points: Point[] }

let cached: { body: unknown; at: number } | null = null

export async function GET() {
  if (cached && Date.now() - cached.at < 600_000) return NextResponse.json(cached.body)
  const p = path.join(process.cwd(), "data/generated/model/encoder-map.json")
  if (!fs.existsSync(p)) return NextResponse.json({ error: "no map built" }, { status: 404 })
  const m = JSON.parse(fs.readFileSync(p, "utf8")) as MapFile

  const chN = new Map<string, number>()
  const chPos = new Map<string, number>()
  for (const pt of m.points) {
    if (pt.breakout == null) continue
    chN.set(pt.channelId, (chN.get(pt.channelId) ?? 0) + 1)
    chPos.set(pt.channelId, (chPos.get(pt.channelId) ?? 0) + pt.breakout)
  }
  const base = (ch: string) => (chN.get(ch) ? (chPos.get(ch) ?? 0) / chN.get(ch)! : null)

  const clusters = m.clusters.map((c) => {
    const pts = m.points.filter((pt) => pt.cluster === c.id)
    const labeled = pts.filter((pt) => pt.breakout != null && base(pt.channelId) != null)
    const lift = labeled.length ? (labeled.reduce((t, pt) => t + (pt.breakout! - base(pt.channelId)!), 0) / labeled.length) * 100 : null
    return { id: c.id, n: c.n, channels: new Set(pts.map((pt) => pt.channelId)).size, rate: c.outlierRate, lift: lift == null ? null : Math.round(lift * 10) / 10, labels: c.labels }
  })
  const cp = path.join(process.cwd(), "data/generated/model/composition.json")
  const comp = fs.existsSync(cp) ? (JSON.parse(fs.readFileSync(cp, "utf8")) as CompFile) : null
  const compOf = (id: string) => {
    const s = comp?.shorts[id]
    if (!s) return undefined
    const f: Record<string, number> = {}
    for (const k of COMP_FIELDS) if (s[k] != null) f[k] = s[k]
    return f
  }
  const points = m.points.map((pt) => ({ id: pt.id, x: pt.x, y: pt.y, cluster: pt.cluster, tier: pt.tier, label: pt.label, f: compOf(pt.id) }))
  const body = {
    run: m.run,
    builtAt: m.builtAt,
    n: m.n,
    k: m.k,
    clusters,
    composition: comp?.builtAt ?? null,
    chips: chipsFor(points.map((p) => p.f ?? {})),
    points,
  }
  cached = { body, at: Date.now() }
  return NextResponse.json(body)
}
