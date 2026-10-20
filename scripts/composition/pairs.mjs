// The breakout/control pairs, one definition (the same rule as scripts/catalog-media/pick.mjs, without
// its fetched-already filter): every settled breakout with a same-channel non-breakout control at the
// nearest publish date, each control used once, strongest breakout first.
import fs from "node:fs"
import path from "node:path"

export const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "../..")

export function pairs() {
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "data/velocity/catalog.json"), "utf8"))
  const settled = catalog.videos.filter((v) => v.tier && v.tier !== "unsettled")
  const breakouts = settled.filter((v) => v.tier === "breakout").sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))
  const byChannel = new Map()
  for (const v of settled) {
    if (v.tier === "breakout") continue
    if (!byChannel.has(v.channelId)) byChannel.set(v.channelId, [])
    byChannel.get(v.channelId).push(v)
  }
  const used = new Set()
  const out = []
  for (const b of breakouts) {
    const pool = (byChannel.get(b.channelId) ?? []).filter((c) => !used.has(c.id))
    const control = pool.sort((x, y) => Math.abs(new Date(x.published) - new Date(b.published)) - Math.abs(new Date(y.published) - new Date(b.published)))[0]
    if (!control) continue
    used.add(control.id)
    out.push({ breakout: b, control })
  }
  return { pairs: out, catalog }
}
