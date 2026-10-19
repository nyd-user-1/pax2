// Small-file publisher for the Hugging Face repos under NYSgpt: one commit per repo through the
// commit API, from this Mac, for the JSON models and cards that need no LFS. Weights in S3 go
// through scripts/encoder/publish.sh instead.
//
// Usage: node scripts/hf-upload.mjs <repo> <summary> <localPath:repoPath> [more pairs...]
//   e.g. node scripts/hf-upload.mjs NYSgpt/pax2-velocity-classifier "refresh" \
//          data/generated/model/velocity-model.json:velocity-model.json docs/cards/pax2-velocity-classifier.md:README.md
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const env = fs.readFileSync(path.join(root, ".env.local"), "utf8")
const token = env.match(/^HF_WRITE_API_TOKEN=(.+)$/m)?.[1]?.trim()
if (!token) throw new Error("HF_WRITE_API_TOKEN missing from .env.local")

const [repo, summary, ...pairs] = process.argv.slice(2)
if (!repo || !summary || !pairs.length) throw new Error("usage: hf-upload.mjs <repo> <summary> <local:remote>...")

const lines = [JSON.stringify({ key: "header", value: { summary } })]
for (const pair of pairs) {
  const [local, remote] = pair.split(":")
  const content = fs.readFileSync(path.join(root, local))
  lines.push(JSON.stringify({ key: "file", value: { path: remote, content: content.toString("base64"), encoding: "base64" } }))
  console.log(`${local} (${content.length} bytes) as ${remote}`)
}
const r = await fetch(`https://huggingface.co/api/models/${repo}/commit/main`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "content-type": "application/x-ndjson" },
  body: lines.join("\n"),
})
const out = await r.json()
if (!r.ok) throw new Error(`${r.status}: ${JSON.stringify(out).slice(0, 300)}`)
console.log(`committed to ${repo}: ${out.commitUrl ?? out.commitOid ?? "ok"}`)
