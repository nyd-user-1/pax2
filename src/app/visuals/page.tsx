import fs from "node:fs"
import path from "node:path"

import { VisualsDemo, type VisualsData } from "@/components/visuals-demo"

export const metadata = { title: "Visuals" }
export const dynamic = "force-dynamic"

// Reads the manifest at request time so a rerun of scripts/visuals/demo.mjs shows on reload.

const QUOTA = {
  image: "Stability Image Ultra is authorized on Bedrock but the account's applied quota is 0 of the default 10 a minute; once it provisions, the rerun fills this card.",
  video: "Luma Ray 2 is authorized on Bedrock but the account's applied quota is 0 concurrent jobs of the default 1; once it provisions, the rerun fills this card.",
}

export default function VisualsPage() {
  const p = path.join(process.cwd(), "data/generated/visuals/demo.json")
  const data: VisualsData | null = fs.existsSync(p) ? { ...JSON.parse(fs.readFileSync(p, "utf8")), quota: QUOTA } : null
  return <VisualsDemo data={data} />
}
