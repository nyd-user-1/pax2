// The two lab tiers, by Brendan's amendment (2026-10-22):
//   Lab Tested (data/generated/lab-tested.json) — every short whose video file was measured in the
//   lab: a composition row with media-derived fields (cuts per second present). The flask.
//   e2 (data/generated/e2.json) — run through the platform end to end: media, transcript,
//   composition, embedding, comments and headline. The former strict "Lab Tested" bar.
//
// Usage: node scripts/lab-tested.mjs
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const comp = JSON.parse(fs.readFileSync(path.join(ROOT, "data/generated/model/composition.json"), "utf8"))
const S = comp.shorts ?? comp.videos
const lab = Object.entries(S)
  .filter(([, r]) => r && typeof r.cutsPerSec === "number" && isFinite(r.cutsPerSec))
  .map(([id]) => id)
  .sort()
// Brendan's four, 2026-10-22: Fix American Politics (UA), Taxation Without Representation? (VF),
// When Political Parties See Independent Voters (VF), Closed Primaries Cause Gridlock (UA).
const e2 = ["Eg8mPYYr9OU", "f5ZT7exidXs", "bmIEPFgxcCw", "-50yfo3yqNg"]
fs.writeFileSync(path.join(ROOT, "data/generated/lab-tested.json"), JSON.stringify(lab))
fs.writeFileSync(path.join(ROOT, "data/generated/e2.json"), JSON.stringify(e2))
console.log("lab-tested.json:", lab.length, "ids · e2.json:", e2.length, "ids")
