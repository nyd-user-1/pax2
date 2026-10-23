# Codebook 5K, the box (docs/briefs/CODEBOOK-5K.md): Qwen3-8B through vLLM codes each video on two prompts
# built by scripts/codebook/prompts.mjs — a, Swayable's 28 traits (evaluate.ts's prompt verbatim), and b, the
# Wesleyan goal, tone and party — over title + transcript. Text only. Launched by scripts/codebook/launch.sh
# through box.sh.
#
# Reads /work/prompts.jsonl ({id, a, b}) in the order of /work/order.txt (the 20 verification ids first).
# Per id and pass: codebook/raw/<TAG>-a/<id>.json and codebook/raw/<TAG>-b/<id>.json — the parsed JSON
# (parsed the way evaluate.ts parses: first "{" to last "}"), the raw text when it does not parse, tokens.
# Resume-safe: an id whose output object exists for a pass is skipped for that pass. LIMIT caps the ids;
# PASSES picks the prompts (a, b or ab), so each pass can run on its own model. REVERSE=1 walks the list from
# the end, and done ids are re-read before every chunk, so two boxes can share one list.
# Summary with timings and token counts to <RUN>summary.json; a progress line per chunk in the log.
import json, os, sys, time
import boto3

BUCKET = os.environ["BUCKET"]
RUN = os.environ["RUN"]
MODEL = os.environ.get("MODEL", "Qwen/Qwen3-8B")
TAG = os.environ.get("TAG", "qwen3-8b-v1")
LIMIT = int(os.environ.get("LIMIT", "0"))
CHUNK = int(os.environ.get("CHUNK", "384"))
PASSES = os.environ.get("PASSES", "ab")      # "a", "b" or "ab": which prompts this box runs
REVERSE = os.environ.get("REVERSE") == "1"   # walk the list from the end: a second box meets the first in the middle
e = lambda k, d: type(d)(os.environ.get(k, d))
s3 = boto3.client("s3", region_name="us-east-1")
T_START = time.time()

def done_ids(prefix):
    out = set()
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=BUCKET, Prefix=prefix):
        out |= {o["Key"].rsplit("/", 1)[-1][:-5] for o in page.get("Contents", [])}
    return out

def parse(text):
    try: return json.loads(text[text.index("{"): text.rindex("}") + 1])
    except Exception: return None

def put_json(key, obj):
    s3.put_object(Bucket=BUCKET, Key=key, Body=json.dumps(obj).encode(), ContentType="application/json")

def main():
    rows = {}
    for l in open("/work/prompts.jsonl"):
        if l.strip():
            r = json.loads(l); rows[r["id"]] = r
    order = [l.strip() for l in open("/work/order.txt") if l.strip()]
    order += [i for i in rows if i not in set(order)]
    order = [i for i in order if i in rows]
    done = {p: done_ids(f"codebook/raw/{TAG}-{p}/") if p in PASSES else set(rows) for p in "ab"}
    todo = [i for i in order if i not in done["a"] or i not in done["b"]]
    if REVERSE: todo = todo[::-1]
    if LIMIT: todo = todo[:LIMIT]
    print(f"prompts {len(rows)}, done a {len(done['a'])} b {len(done['b'])}, to do {len(todo)}, model {MODEL}, tag {TAG}", flush=True)

    from vllm import LLM, SamplingParams
    t0 = time.time()
    kw = dict(model=MODEL, max_model_len=e("MAX_LEN", 8192), gpu_memory_utilization=e("GPU_UTIL", 0.92),
              max_num_seqs=e("MAX_SEQS", 128), max_num_batched_tokens=e("MAX_BATCHED", 8192),
              enable_prefix_caching=True, seed=0)
    if os.environ.get("QUANT"): kw["quantization"] = os.environ["QUANT"]
    if os.environ.get("KV_DTYPE"): kw["kv_cache_dtype"] = os.environ["KV_DTYPE"]
    llm = LLM(**kw)
    load_s = round(time.time() - t0, 1)
    # evaluate.ts's inference config: maxTokens 4000, temperature 0. Pass b answers in three words.
    sp = {"a": SamplingParams(temperature=0.0, max_tokens=4000, seed=0), "b": SamplingParams(temperature=0.0, max_tokens=200, seed=0)}
    # Qwen3 thinks before answering by default; the coder answers directly, as the Bedrock call does.
    ctk = {"enable_thinking": False}
    print(f"model loaded in {load_s}s; settings {json.dumps({k: v for k, v in kw.items() if k != 'model'})}", flush=True)

    t0 = time.time(); n = 0; tin = tout = 0; perr = {"a": 0, "b": 0}; gen_s = 0.0
    for k in range(0, len(todo), CHUNK):
        if k:  # another box may have written since; re-read what is done before each chunk
            done = {p: done_ids(f"codebook/raw/{TAG}-{p}/") if p in PASSES else set(rows) for p in "ab"}
        chunk = [i for i in todo[k:k + CHUNK] if i not in done["a"] or i not in done["b"]]
        if not chunk:
            print(f"chunk at {k}: all done by another box", flush=True); continue
        jobs = [(i, p) for i in chunk for p in "ab" if i not in done[p]]
        msgs = [[{"role": "user", "content": rows[i][p]}] for i, p in jobs]
        g0 = time.time()
        outs = llm.chat(msgs, [sp[p] for _, p in jobs], use_tqdm=False, chat_template_kwargs=ctk)
        gen_s += time.time() - g0
        stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        for (i, p), o in zip(jobs, outs):
            text = o.outputs[0].text
            coded = parse(text)
            if coded is None: perr[p] += 1
            a, b = len(o.prompt_token_ids), len(o.outputs[0].token_ids)
            tin += a; tout += b
            put_json(f"codebook/raw/{TAG}-{p}/{i}.json", {"id": i, "model": MODEL, "tag": f"{TAG}-{p}", "coded": coded,
                     "raw": text if coded is None else None, "finish": o.outputs[0].finish_reason, "tokensIn": a, "tokensOut": b, "at": stamp})
        n += len(chunk)
        el = time.time() - t0
        print(f"{n}/{len(todo)} parse errors a {perr['a']} b {perr['b']} | {n / el * 60:.1f} videos/min, {tout / max(gen_s, 1):.0f} out tok/s, tokens in {tin} out {tout}, {el:.0f}s", flush=True)

    summary = {"model": MODEL, "tag": TAG, "settings": {k: v for k, v in kw.items() if k != "model"}, "attempted": len(todo),
               "parseErrors": perr, "loadSec": load_s, "wallSec": round(time.time() - t0, 1), "gpuSec": round(gen_s, 1),
               "tokensIn": tin, "tokensOut": tout, "sinceScriptStartSec": round(time.time() - T_START, 1)}
    put_json(f"{RUN}summary.json", summary)
    print("SUMMARY " + json.dumps(summary), flush=True)
    return 0

if __name__ == "__main__":
    sys.exit(main())
