// Uploads the generated JSON that the app reads at request time (src/lib/generated-store.ts) to
// s3://pax-2-638175140432/generated/<name>.json. Run after rebuilding any of them.
//   node scripts/upload-generated.mjs
import { execFileSync } from "node:child_process"

const FILES = {
  "question-bank": "data/generated/question-bank.json",
  codebook: "data/generated/codebook.json",
  "vqa-census": "data/generated/model/vqa-census.json",
  analytics: "data/generated/analytics.json",
}
const bucket = process.env.PAX2_BUCKET ?? "pax-2-638175140432"
for (const [name, file] of Object.entries(FILES)) {
  execFileSync("aws", ["s3", "cp", file, `s3://${bucket}/generated/${name}.json`, "--content-type", "application/json", "--only-show-errors"], { stdio: "inherit" })
  console.log(`s3://${bucket}/generated/${name}.json  <- ${file}`)
}
