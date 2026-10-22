// Lab Tested: the ids run through the platform end to end — media, transcript, composition,
// embedding, comments and headline measured. Today that is the two client videos, by Brendan's
// word (2026-10-22). Writes data/generated/lab-tested.json for the feed pages' flag and the flask.
//
// To re-expand to every media-measured short (5,077 on 2026-10-22), swap `ids` for MEDIA_MEASURED.
//
// Usage: node scripts/lab-tested.mjs
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const comp = JSON.parse(fs.readFileSync(path.join(ROOT, "data/generated/model/composition.json"), "utf8"))
const S = comp.shorts ?? comp.videos
// eslint-disable-next-line no-unused-vars
const MEDIA_MEASURED = Object.entries(S)
  .filter(([, r]) => r && typeof r.cutsPerSec === "number" && isFinite(r.cutsPerSec))
  .map(([id]) => id)
  .sort()
const ids = ["Eg8mPYYr9OU", "jLD6UwGvldg"]
fs.writeFileSync(path.join(ROOT, "data/generated/lab-tested.json"), JSON.stringify(ids))
console.log("lab-tested.json:", ids.length, "ids")
