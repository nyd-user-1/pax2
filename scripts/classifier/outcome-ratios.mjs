// What a Hit and a non-Hit draw against their channel's median, for the forecast's expected views
// (src/lib/forecast.ts): the median ratio of views to the channel's median in each class, over the
// settled catalog rows of the Model Training Library. Medians, not means: the mean of the Hits is set by
// a few viral shorts (30x for the reform family's 158 Hits) and would swing with each one.
// Usage: node scripts/classifier/outcome-ratios.mjs   Writes data/generated/model/outcome-ratios.json
import fs from "node:fs"

const rows = fs.readFileSync("data/generated/model/training-set.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.breakout != null && r.ratio != null)
const median = (a) => {
  const s = a.slice().sort((x, y) => x - y)
  return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}
const of = (rs) => ({ n: rs.length, medianRatio: Math.round(median(rs.map((r) => r.ratio)) * 1000) / 1000 })
const out = {
  builtAt: new Date().toISOString(),
  source: "data/generated/model/training-set.jsonl, settled catalog shorts; ratio = lifetime views over the channel's median of settled shorts",
  hit: of(rows.filter((r) => r.breakout === 1)),
  rest: of(rows.filter((r) => r.breakout === 0)),
}
fs.writeFileSync("data/generated/model/outcome-ratios.json", JSON.stringify(out, null, 1) + "\n")
console.log(JSON.stringify(out))
