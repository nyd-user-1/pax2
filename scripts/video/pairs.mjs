// Window MM-A (2026-10-20): the Composition Ranker's pair set, exported for the video gates. Same pairs
// (scripts/composition/pairs.mjs), same held-out channels (the encoder's, holdout.json), kept only where
// both sides carry measured media (fit.mjs's hasMedia rule): 2,481 pairs, 590 held out.
// Each row carries the breakout's settled ratio so the box can read the 5x and 10x subsets.
//
// Usage: node scripts/video/pairs.mjs  -> data/generated/model/video-pairs.json
import fs from "node:fs"
import path from "node:path"
import { ROOT, pairs } from "../composition/pairs.mjs"

const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"))
const comp = read("data/generated/model/composition.json")
const holdout = read("data/generated/model/encoder/holdout.json")
const held = new Set(Object.values(holdout.families).flatMap((f) => f.heldOut.map((h) => h.channelId)))
const MEDIA = ["cutsPerSec", "loudnessLufs", "textWordsPerFrame"]
const hasMedia = (id) => MEDIA.some((k) => comp.shorts[id]?.[k] != null)
const { pairs: ps } = pairs()
const rows = ps
  .filter((p) => hasMedia(p.breakout.id) && hasMedia(p.control.id))
  .map((p) => ({ breakout: p.breakout.id, control: p.control.id, channelId: p.breakout.channelId, heldOut: held.has(p.breakout.channelId) ? 1 : 0, breakoutRatio: p.breakout.ratio, controlRatio: p.control.ratio }))
const out = {
  builtAt: new Date().toISOString(),
  rule: "scripts/composition/pairs.mjs pairs with media measured on both sides (composition.json cutsPerSec, loudnessLufs or textWordsPerFrame); heldOut = the breakout's channel is one of the encoder's 10 held-out channels",
  counts: { all: rows.length, heldOut: rows.filter((r) => r.heldOut).length, train: rows.filter((r) => !r.heldOut).length },
  heldOutChannels: [...held],
  pairs: rows,
}
fs.writeFileSync(path.join(ROOT, "data/generated/model/video-pairs.json"), JSON.stringify(out))
console.log(out.counts, "5x held-out", rows.filter((r) => r.heldOut && r.breakoutRatio >= 5).length, "10x held-out", rows.filter((r) => r.heldOut && r.breakoutRatio >= 10).length)
