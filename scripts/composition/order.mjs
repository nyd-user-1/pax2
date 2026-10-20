// Writes data/raw/composition/order.txt: pair ids strongest-first, breakout then control, so a partial
// extraction run still covers whole pairs. Usage: node scripts/composition/order.mjs
import fs from "node:fs"
import path from "node:path"
import { pairs, ROOT } from "./pairs.mjs"

const { pairs: ps } = pairs()
const lines = ps.flatMap((p) => [p.breakout.id, p.control.id])
fs.mkdirSync(path.join(ROOT, "data/raw/composition"), { recursive: true })
fs.writeFileSync(path.join(ROOT, "data/raw/composition/order.txt"), lines.join("\n") + "\n")
console.log(`${ps.length} pairs, ${lines.length} ids to order.txt`)
