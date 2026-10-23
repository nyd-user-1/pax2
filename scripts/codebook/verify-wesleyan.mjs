// Codebook 5K: the Wesleyan v2 prompt on the fresh 20 (data/raw/codebook/verify2-ids.txt), open model against
// Bedrock on the identical prompt (data/raw/codebook/bedrock-v2/). Usage: node scripts/codebook/verify-wesleyan.mjs
import fs from "node:fs"; import { execFileSync } from "node:child_process"
const ids = fs.readFileSync("data/raw/codebook/verify2-ids.txt","utf8").trim().split("\n")
const cols = ["goal","tone","party"], agree = {goal:0,tone:0,party:0}, conf = {goal:{},tone:{},party:{}}; let n=0
for (const id of ids) {
  const o = JSON.parse(execFileSync("aws",["s3","cp","--only-show-errors",`s3://pax-2-638175140432/codebook/raw/qwen3-8b-v2-b/${id}.json`,"-"],{encoding:"utf8"})).coded
  const b = JSON.parse(fs.readFileSync(`data/raw/codebook/bedrock-v2/${id}.json`,"utf8")).wesleyan
  if (!o||!b) continue; n++
  for (const c of cols) { if (o[c]===b[c]) agree[c]++; const k=`${o[c]}|${b[c]}`; conf[c][k]=(conf[c][k]??0)+1 }
}
const out = { ids: "data/raw/codebook/verify2-ids.txt", prompt: "b v2", n, agree: Object.fromEntries(cols.map(c=>[c,+(agree[c]/n).toFixed(2)])), pairs: conf }
fs.writeFileSync("data/raw/codebook/verify2-wesleyan-qwen3-8b-v2.json", JSON.stringify(out,null,1)+"\n"); console.log(JSON.stringify(out))
