// PAX2 Video Resonance (window MM-B): every settled non-paid training-set short's channel, split and label,
// so the box can place the label-blind sample (MM-A, 2026-10-21) on groups.json's channel splits: held =
// the encoder's 10 held-out channels, val = groups.json's 8 validation channels, train = the rest.
// Usage: node scripts/video-resonance/catalog-splits.mjs -> data/generated/model/video-resonance/catalog-splits.json
import fs from "node:fs"
import path from "node:path"
import { ROOT } from "../composition/pairs.mjs"

const g = JSON.parse(fs.readFileSync(path.join(ROOT, "data/generated/model/video-resonance/groups.json"), "utf8"))
const held = new Set(g.media.heldChannels)
const val = new Set(g.media.valChannels)
const out = {}
for (const l of fs.readFileSync(path.join(ROOT, "data/generated/model/training-set.jsonl"), "utf8").split("\n")) {
  if (!l) continue
  const r = JSON.parse(l)
  if (r.group === "paid-ad" || r.ratio == null || !r.channelId) continue
  out[r.id] = [r.channelId, held.has(r.channelId) ? "held" : val.has(r.channelId) ? "val" : "train", r.breakout]
}
fs.writeFileSync(path.join(ROOT, "data/generated/model/video-resonance/catalog-splits.json"), JSON.stringify(out))
const v = Object.values(out)
console.log(v.length, "train", v.filter((x) => x[2] !== undefined && x[1] === "train").length, "outlier share", (v.filter((x) => x[2] === 1).length / v.length).toFixed(4))
