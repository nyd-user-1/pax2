/**
 * ingest.mjs — put one report PDF into the library: the original to private S3,
 * every page's text to data/generated/reports/<slug>.json for search and chat.
 *
 *   node scripts/reports/ingest.mjs <file.pdf> <slug> "<title>" "<publisher>" "<date>"
 *
 * Pages with a text layer are read with pdf.js (unpdf); pages without one (charts
 * exported as images) are read with Amazon Textract, about $0.0015 a page. unpdf
 * and the Textract client are not pax2 dependencies; this one-off script borrows
 * them from ~/Code/tariffs (override with UNPDF and TEXTRACT).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join } from "node:path"

const [file, slug, title, publisher, date] = process.argv.slice(2)
if (!file || !slug || !title) {
  console.error('usage: node scripts/reports/ingest.mjs <file.pdf> <slug> "<title>" "<publisher>" "<date>"')
  process.exit(1)
}
const UNPDF = process.env.UNPDF ?? `${process.env.HOME}/Code/tariffs/node_modules/unpdf/dist/index.mjs`
const TEXTRACT = process.env.TEXTRACT ?? `${process.env.HOME}/Code/tariffs/node_modules/@aws-sdk/client-textract/dist-cjs/index.js`
const BUCKET = "pax-2-638175140432"
const KEY = `library/reports/${slug}.pdf`

const { getDocumentProxy } = await import(UNPDF)
const bytes = readFileSync(file)
const pdf = await getDocumentProxy(new Uint8Array(bytes))

/** One page's text-layer lines, top to bottom, left to right. */
async function textLayer(n) {
  const page = await pdf.getPage(n)
  const H = page.getViewport({ scale: 1 }).height
  const items = (await page.getTextContent()).items.filter((i) => i.str.trim())
  const rows = new Map()
  for (const i of items) {
    const y = Math.round((H - i.transform[5]) / 3) * 3
    rows.set(y, [...(rows.get(y) ?? []), { x: i.transform[4], s: i.str }])
  }
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r.sort((a, b) => a.x - b.x).map((i) => i.s).join(" ").replace(/\s+/g, " ").trim())
}

let textract = null
async function ocr(n) {
  if (!textract) {
    const { TextractClient, DetectDocumentTextCommand } = await import(TEXTRACT)
    textract = { c: new TextractClient({ region: "us-east-1" }), Cmd: DetectDocumentTextCommand }
  }
  const dir = join(tmpdir(), `pax2-report-${slug}`)
  mkdirSync(dir, { recursive: true })
  execFileSync("pdftoppm", ["-r", "150", "-f", String(n), "-l", String(n), "-jpeg", "-jpegopt", "quality=90", "-singlefile", file, join(dir, `p${n}`)])
  const r = await textract.c.send(new textract.Cmd({ Document: { Bytes: readFileSync(join(dir, `p${n}.jpg`)) } }))
  return r.Blocks.filter((b) => b.BlockType === "LINE").map((b) => b.Text)
}

const pages = []
for (let n = 1; n <= pdf.numPages; n++) {
  let lines = await textLayer(n)
  let source = "text"
  if (lines.length < 5) {
    lines = await ocr(n)
    source = "ocr"
  }
  pages.push({ n, source, text: lines.join("\n") })
  console.log(n, source, lines.length, "lines")
}

execFileSync("aws", ["s3", "cp", file, `s3://${BUCKET}/${KEY}`, "--content-type", "application/pdf", "--only-show-errors"])
mkdirSync("data/generated/reports", { recursive: true })
writeFileSync(
  `data/generated/reports/${slug}.json`,
  JSON.stringify({ slug, title, publisher: publisher || null, date: date || null, key: KEY, bytes: bytes.length, pages }, null, 1),
)
console.log(`wrote data/generated/reports/${slug}.json, ${pages.length} pages; original at s3://${BUCKET}/${KEY}`)
