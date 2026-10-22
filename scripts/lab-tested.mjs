// Lab Tested: the ids whose video file PAX2 has measured in the lab — a composition row with
// media-derived fields (cuts per second present), not just title traits. Writes
// data/generated/lab-tested.json for the feed pages' flag and the flask badge.
//
// Usage: node scripts/lab-tested.mjs
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const comp = JSON.parse(fs.readFileSync(path.join(ROOT, "data/generated/model/composition.json"), "utf8"))
const S = comp.shorts ?? comp.videos
const ids = Object.entries(S)
  .filter(([, r]) => r && typeof r.cutsPerSec === "number" && isFinite(r.cutsPerSec))
  .map(([id]) => id)
  .sort()
fs.writeFileSync(path.join(ROOT, "data/generated/lab-tested.json"), JSON.stringify(ids))
console.log("lab-tested.json:", ids.length, "ids")
