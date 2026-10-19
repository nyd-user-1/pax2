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
  const body = {
    run: m.run,
    builtAt: m.builtAt,
    n: m.n,
    k: m.k,
    clusters,
    points: m.points.map((pt) => ({ id: pt.id, x: pt.x, y: pt.y, cluster: pt.cluster, tier: pt.tier, label: pt.label })),
  }
  cached = { body, at: Date.now() }
  return NextResponse.json(body)
}
