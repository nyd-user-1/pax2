// pax2-headline: PAX2 Headline Ranker v1 at request time. bert-base-uncased with one linear unit,
// exported to ONNX by scripts/headline/train.py (run in HEADLINE_RUN), scored here with ONNX Runtime
// from the pax2-onnxruntime layer (scripts/headline/deploy.sh). On a cold start the model and the
// vocabulary come from S3 into /tmp, once per container. Payload { texts: string[] } (direct invoke or a
// JSON body); reply { scores: number[], run, model } with one raw score per text: higher wins a
// pairwise comparison; alone it means little, which is why src/lib/headline-v1.ts reads it against the
// held-out headlines' percentiles.
//
// The tokenizer is bert-base-uncased's WordPiece, written out here so the layer carries no tokenizer
// package: lowercase, accents stripped, punctuation split, greedy longest-match on vocab.txt with ##
// continuations, [CLS] and [SEP], 40 tokens at most, as train.py tokenized (max_length 40).
import fs from "node:fs"
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import ort from "onnxruntime-node"

const REGION = process.env.AWS_REGION ?? "us-east-1"
const BUCKET = process.env.HEADLINE_BUCKET ?? "nsr-embed-v2"
const RUN = process.env.HEADLINE_RUN ?? "20261018-060508-train"
const PREFIX = `pax2/headline/models/${RUN}/`
const MAX_LEN = 40
const DIR = "/tmp/headline-v1"
const s3 = new S3Client({ region: REGION })

let ready = null
async function fetchTo(key, path) {
  if (fs.existsSync(path) && fs.statSync(path).size > 0) return
  const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: PREFIX + key }))
  await fs.promises.writeFile(path, await r.Body.transformToByteArray())
}
async function load() {
  fs.mkdirSync(DIR, { recursive: true })
  await Promise.all([fetchTo("model-v1.onnx", `${DIR}/model.onnx`), fetchTo("model-v1/vocab.txt", `${DIR}/vocab.txt`)])
  const vocab = new Map(fs.readFileSync(`${DIR}/vocab.txt`, "utf8").split("\n").map((w, i) => [w.trim(), i]))
  const session = await ort.InferenceSession.create(`${DIR}/model.onnx`, { executionProviders: ["cpu"] })
  return { vocab, session }
}

const isPunct = (ch) => /[\p{P}\p{S}]/u.test(ch)
function basicTokens(text) {
  const clean = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[\u0000�]/g, "").replace(/[\t\n\r]/g, " ")
  const out = []
  for (const w of clean.split(/\s+/).filter(Boolean)) {
    let cur = ""
    for (const ch of w) {
      if (isPunct(ch)) {
        if (cur) out.push(cur)
        out.push(ch)
        cur = ""
      } else cur += ch
    }
    if (cur) out.push(cur)
  }
  return out
}
function wordpiece(vocab, token) {
  if (token.length > 100) return ["[UNK]"]
  const pieces = []
  let start = 0
  while (start < token.length) {
    let end = token.length
    let piece = null
    while (start < end) {
      const sub = (start > 0 ? "##" : "") + token.slice(start, end)
      if (vocab.has(sub)) { piece = sub; break }
      end--
    }
    if (piece == null) return ["[UNK]"]
    pieces.push(piece)
    start = end
  }
  return pieces
}
function encode(vocab, texts) {
  const ids = texts.map((t) => {
    const toks = basicTokens(t).flatMap((w) => wordpiece(vocab, w)).slice(0, MAX_LEN - 2)
    return [vocab.get("[CLS]"), ...toks.map((p) => vocab.get(p) ?? vocab.get("[UNK]")), vocab.get("[SEP]")]
  })
  const T = Math.max(...ids.map((x) => x.length))
  const B = ids.length
  const inputIds = new BigInt64Array(B * T)
  const mask = new BigInt64Array(B * T)
  ids.forEach((row, b) => row.forEach((id, t) => { inputIds[b * T + t] = BigInt(id); mask[b * T + t] = 1n }))
  return { input_ids: new ort.Tensor("int64", inputIds, [B, T]), attention_mask: new ort.Tensor("int64", mask, [B, T]) }
}

export const handler = async (event) => {
  const body = typeof event?.body === "string" ? JSON.parse(event.body) : event?.body ?? event
  const texts = (body?.texts ?? []).map((t) => String(t).slice(0, 400)).slice(0, 256)
  if (!texts.length) return { statusCode: 400, body: JSON.stringify({ error: "texts: string[] required" }) }
  ready ??= load()
  const { vocab, session } = await ready
  const scores = []
  for (let i = 0; i < texts.length; i += 64) {
    const out = await session.run(encode(vocab, texts.slice(i, i + 64)))
    scores.push(...Array.from(out.score.data).map((v) => Math.round(Number(v) * 1e4) / 1e4))
  }
  const result = { scores, run: RUN, model: "PAX2 Headline Ranker v1, bert-base-uncased" }
  return event?.body !== undefined ? { statusCode: 200, headers: { "content-type": "application/json" }, body: JSON.stringify(result) } : result
}
