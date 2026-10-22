# Window Q, the question machine (2026-10-22): Qwen3-VL on one GPU box answers questions about catalog
# shorts from frames sampled out of s3://<bucket>/catalog-media/<id>.mp4. Launched by scripts/vqa/launch.sh
# through box.sh.
#
# MODE=batch  the fixed census questions (QUESTIONS below), all in one pass per video, structured JSON.
#             Ids from ids.tsv (id, channel); done ids under vqa/raw/<TAG>/ skip, so a rerun resumes.
#             Per id: vqa/raw/<TAG>/<id>.json (answers + frame times + tokens), vqa/sheets/<id>.jpg (the
#             frames the model saw, timestamped) and vqa/sheets/<id>-dense.jpg (a frame every 2 s, for the
#             hand audit). Summary with timings to <RUN>summary.json.
# MODE=ask    one video, any question (ask.json: id, question, channel); free-text answer to <RUN>answer.json.
#
# Frames: dense in the hook (0, 0.5, 1, 1.5, 2, 3 s), then 6 spread over the rest, then the last second.
# No identity or demographic inference: the prompt asks for counts only and forbids the rest.
import base64, io, json, os, sys, time, threading, queue
from concurrent.futures import ThreadPoolExecutor

import av
import boto3
from PIL import Image, ImageDraw

BUCKET = os.environ["BUCKET"]
RUN = os.environ["RUN"]                      # s3 prefix for this run, ends with /
MODE = os.environ.get("MODE", "batch")
MODEL = os.environ.get("MODEL", "Qwen/Qwen3-VL-4B-Instruct")
TAG = os.environ.get("TAG", "qwen3-vl-4b-p3")  # model + prompt version; results under vqa/raw/<TAG>/
LIMIT = int(os.environ.get("LIMIT", "0"))
CHUNK = int(os.environ.get("CHUNK", "48"))
MAX_SIDE = 640
s3 = boto3.client("s3", region_name="us-east-1")
T_START = time.time()

HOOK = [0.0, 0.5, 1.0, 1.5, 2.0, 3.0]

def targets(dur, rest=6):
    ts = [t for t in HOOK if t < dur - 0.05]
    if dur > 5:
        a, b = 4.0, max(4.0, dur - 1.5)
        ts += [round(a + (b - a) * i / max(rest - 1, 1), 2) for i in range(rest)]
        ts.append(round(max(dur - 0.5, 0), 2))
    return sorted(set(ts))

def decode(path, want):
    """First frame at or after each wanted time; returns [(t, PIL)] in order."""
    got, i = [], 0
    with av.open(path) as c:
        st = c.streams.video[0]
        st.thread_type = "AUTO"
        last = None
        for fr in c.decode(st):
            t = float(fr.pts * st.time_base) if fr.pts is not None else 0.0
            last = (t, fr)
            while i < len(want) and t >= want[i] - 0.02:
                got.append((round(t, 2), fr.to_image())); i += 1
            if i >= len(want): break
        while i < len(want) and last is not None:   # past the end: the last frame stands in
            got.append((round(last[0], 2), last[1].to_image())); i += 1
    return got

def fit(im, side=MAX_SIDE):
    w, h = im.size
    k = min(1.0, side / max(w, h))
    return im.convert("RGB").resize((max(1, int(w * k)), max(1, int(h * k)))) if k < 1 else im.convert("RGB")

def sheet(frames, width, cols):
    if not frames: return None
    th = [fit(im, width) for _, im in frames]
    w = max(i.size[0] for i in th); h = max(i.size[1] for i in th)
    rows = (len(th) + cols - 1) // cols
    S = Image.new("RGB", (cols * w, rows * (h + 16)), "white")
    d = ImageDraw.Draw(S)
    for k, ((t, _), im) in enumerate(zip(frames, th)):
        x, y = (k % cols) * w, (k // cols) * (h + 16)
        S.paste(im, (x, y + 16)); d.text((x + 3, y + 2), f"{t:.1f}s", fill="black")
    b = io.BytesIO(); S.save(b, "JPEG", quality=80); return b.getvalue()

def prep(item):
    vid, channel = item
    path = f"/work/media/{vid}.mp4"
    try:
        s3.download_file(BUCKET, f"catalog-media/{vid}.mp4", path)
        with av.open(path) as c:
            st = c.streams.video[0]
            dur = float(c.duration / 1e6) if c.duration else float(st.duration * st.time_base)
        want = targets(dur) if MODE == "batch" else targets(dur, rest=14)
        frames = decode(path, want)
        out = {"id": vid, "channel": channel, "dur": round(dur, 2), "frames": frames}
        if MODE == "batch":
            dense = decode(path, [i * 2.0 for i in range(int(dur // 2) + 1)][:48])
            s3.put_object(Bucket=BUCKET, Key=f"vqa/sheets/{vid}.jpg", Body=sheet(frames, 240, 7), ContentType="image/jpeg")
            s3.put_object(Bucket=BUCKET, Key=f"vqa/sheets/{vid}-dense.jpg", Body=sheet(dense, 144, 8), ContentType="image/jpeg")
        return out
    except Exception as e:
        return {"id": vid, "error": repr(e)[-300:]}
    finally:
        try: os.remove(path)
        except OSError: pass

SYSTEM = ("You are a careful video annotator. You see frames sampled from one short vertical video, each preceded by "
          "its timestamp in seconds. Answer only from what is visible in the frames. Never identify who anyone is, and "
          "never judge anyone's age, gender, race, ethnicity or any other personal attribute; only count people.")

# p3 (2026-10-22): after the 20-video verification of p2 — 4B and 8B both counted one person almost everywhere,
# read static headlines as captions and missed word-by-word ones, and flagged channels' own logos and mic flags.
QUESTIONS = """The video was posted by the channel "{channel}". Answer in JSON with these keys:
- people_per_frame: exactly {nframes} numbers, one per frame in order. Count each frame separately: every real person or photo of a person visible, whole or partial, including people in the background, in split screens and in inset videos; a crowd counts as its visible people up to 20.
- captions_burned_in: true if the spoken words appear as on-screen text that changes along with the speech from frame to frame (a word, a few words or a line at a time). A headline or title that stays the same across frames is not captions.
- on_screen_text: true if any frame shows readable text added in editing (captions, titles, headlines, graphics, lower thirds, chyrons).
- call_to_action: true if the picture shows an explicit ask of the viewer: subscribe, follow, like, share, comment, donate, vote, register, sign, call, listen, watch more, visit a link or website, join.
- cta_seconds: the timestamp of the first frame showing that ask, else null.
- cta_text: the ask's words as shown, else null.
- format: the dominant one of "talking head" (one person speaking straight to the camera), "graphic card" (text or graphics fill the frame with little or no live footage), "b-roll" (footage of places, objects or events with no one addressing the camera), "rally" (a speech from a podium or stage, or a campaign event), "news clip" (broadcast or cable TV footage: anchors, chyrons, network graphics, talk shows), "interview" (two or more people in conversation or debate, or a person answering an off-screen interviewer, often holding or facing a microphone), "other".
- setting: the dominant one of "indoor" (including a car's interior), "outdoor", "studio" (a built set, backdrop or recording studio), "archival" (old or historical footage or photos), "graphics only" (no physical scene).
- product_shown: true if a commercial product, merchandise or branded package is a subject of the video (held up, displayed, advertised).
- third_party_watermark: true only for a logo, handle or watermark overlaid on the picture (usually in a corner, or a TV network's chyron) that belongs to a different platform, outlet or creator than "{channel}": a TikTok logo with an @handle, a TV network's corner logo. The posting channel's own logo, show name or handle is not third-party. Logos on microphones, podiums, backdrops or clothing are not watermarks.
- watermark_source: the name that watermark shows, else null."""

FORMATS = ["talking head", "graphic card", "b-roll", "rally", "news clip", "interview", "other"]
SETTINGS = ["indoor", "outdoor", "studio", "archival", "graphics only"]
SCHEMA = {
    "type": "object",
    "properties": {
        "people_per_frame": {"type": "array", "items": {"type": "integer", "minimum": 0, "maximum": 20}},
        "captions_burned_in": {"type": "boolean"},
        "on_screen_text": {"type": "boolean"},
        "call_to_action": {"type": "boolean"},
        "cta_seconds": {"type": ["number", "null"]},
        "cta_text": {"type": ["string", "null"], "maxLength": 120},
        "format": {"type": "string", "enum": FORMATS},
        "setting": {"type": "string", "enum": SETTINGS},
        "product_shown": {"type": "boolean"},
        "third_party_watermark": {"type": "boolean"},
        "watermark_source": {"type": ["string", "null"], "maxLength": 60},
    },
    "required": ["people_per_frame", "captions_burned_in", "on_screen_text", "call_to_action", "cta_seconds", "cta_text",
                 "format", "setting", "product_shown", "third_party_watermark", "watermark_source"],
    "additionalProperties": False,
}

def schema_for(n):
    # The first verification looped on this list until max_tokens (15 of 20 unparsed); its length is pinned per video.
    s = json.loads(json.dumps(SCHEMA))
    s["properties"]["people_per_frame"].update(minItems=n, maxItems=n)
    return s

def data_url(im):
    b = io.BytesIO(); fit(im).save(b, "JPEG", quality=90)
    return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()

def messages(p, text):
    content = []
    for t, im in p["frames"]:
        content.append({"type": "text", "text": f"[{t:.1f}s]"})
        content.append({"type": "image_url", "image_url": {"url": data_url(im)}})
    content.append({"type": "text", "text": text})
    return [{"role": "system", "content": SYSTEM}, {"role": "user", "content": content}]

def sampling(max_tokens, schema=None):
    from vllm import SamplingParams
    kw = dict(temperature=0.0, max_tokens=max_tokens, seed=0)
    if schema is None: return SamplingParams(**kw), "none"
    try:
        from vllm.sampling_params import StructuredOutputsParams
        return SamplingParams(structured_outputs=StructuredOutputsParams(json=schema), **kw), "structured_outputs"
    except Exception:
        pass
    try:
        from vllm.sampling_params import GuidedDecodingParams
        return SamplingParams(guided_decoding=GuidedDecodingParams(json=schema), **kw), "guided_decoding"
    except Exception:
        return SamplingParams(**kw), "none"

def load():
    from vllm import LLM
    t0 = time.time()
    # The 8B on a 24 GB L4 leaves no KV room at the 4B's settings (first 8B box); env narrows them.
    e = lambda k, d: type(d)(os.environ.get(k, d))
    llm = LLM(model=MODEL, max_model_len=e("MAX_LEN", 16384), limit_mm_per_prompt={"image": 32, "video": 0},
              gpu_memory_utilization=e("GPU_UTIL", 0.88), max_num_seqs=e("MAX_SEQS", 64),
              max_num_batched_tokens=e("MAX_BATCHED", 16384), seed=0)
    return llm, round(time.time() - t0, 1)

def put_json(key, obj):
    s3.put_object(Bucket=BUCKET, Key=key, Body=json.dumps(obj).encode(), ContentType="application/json")

def batch():
    ids = [l.rstrip("\n").split("\t") for l in open("/work/ids.tsv") if l.strip()]
    done = set()
    pg = s3.get_paginator("list_objects_v2")
    for page in pg.paginate(Bucket=BUCKET, Prefix=f"vqa/raw/{TAG}/"):
        done |= {o["Key"].rsplit("/", 1)[-1][:-5] for o in page.get("Contents", [])}
    todo = [(r[0], r[1] if len(r) > 1 else "") for r in ids if r[0] not in done]
    if LIMIT: todo = todo[:LIMIT]
    print(f"set {len(ids)}, done {len(done)}, to do {len(todo)}, model {MODEL}, tag {TAG}", flush=True)
    # Load first: threads alive when vLLM forks its engine process hung the second verification box.
    llm, load_s = load()
    how = sampling(500, SCHEMA)[1]
    print(f"model loaded in {load_s}s; structured decoding: {how}", flush=True)
    pool = ThreadPoolExecutor(int(os.environ.get("PREP_THREADS", "6")))
    chunks = [todo[i:i + CHUNK] for i in range(0, len(todo), CHUNK)]
    futs = [pool.map(prep, c) for c in chunks[:2]]
    t0 = time.time(); n = ok = errs = parse_errs = 0; gen_s = 0.0; tin = tout = 0; nframes = 0
    for k, c in enumerate(chunks):
        preps = list(futs[k])
        if k + 2 < len(chunks): futs.append(pool.map(prep, chunks[k + 2]))
        good = [p for p in preps if "error" not in p and p["frames"]]
        for p in preps:
            if "error" in p or not p.get("frames"):
                errs += 1; print(f"{p['id']}: {p.get('error', 'no frames')}", flush=True)
        if good:
            g0 = time.time()
            sps = [sampling(500, schema_for(len(p["frames"])))[0] for p in good]
            outs = llm.chat([messages(p, QUESTIONS.format(channel=p["channel"], nframes=len(p["frames"]))) for p in good], sps, use_tqdm=False)
            gen_s += time.time() - g0
            for p, o in zip(good, outs):
                text = o.outputs[0].text
                tin += len(o.prompt_token_ids); tout += len(o.outputs[0].token_ids); nframes += len(p["frames"])
                try: ans = json.loads(text)
                except Exception: ans = None; parse_errs += 1
                put_json(f"vqa/raw/{TAG}/{p['id']}.json", {"id": p["id"], "model": MODEL, "tag": TAG, "dur": p["dur"],
                         "frameTimes": [t for t, _ in p["frames"]], "answers": ans, "raw": text if ans is None else None,
                         "tokensIn": len(o.prompt_token_ids), "tokensOut": len(o.outputs[0].token_ids),
                         "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
                ok += 1
        n += len(c)
        el = time.time() - t0
        print(f"{n}/{len(todo)} ok {ok} errors {errs} parse {parse_errs} | {n / el * 60:.1f}/min, gpu {gen_s:.0f}s of {el:.0f}s", flush=True)
    summary = {"model": MODEL, "tag": TAG, "set": len(ids), "alreadyDone": len(done), "attempted": len(todo), "ok": ok,
               "errors": errs, "parseErrors": parse_errs, "structured": how, "loadSec": load_s, "wallSec": round(time.time() - t0, 1),
               "gpuSec": round(gen_s, 1), "tokensIn": tin, "tokensOut": tout, "frames": nframes,
               "sinceScriptStartSec": round(time.time() - T_START, 1)}
    put_json(f"{RUN}summary.json", summary)
    print("SUMMARY " + json.dumps(summary), flush=True)
    return 0 if ok == len(todo) else 2

def ask():
    a = json.loads(s3.get_object(Bucket=BUCKET, Key=f"{RUN}ask.json")["Body"].read())
    llm, load_s = load()   # before any download threads exist (see batch)
    t_dl = time.time()
    p = prep((a["id"], a.get("channel", "")))
    if "error" in p: put_json(f"{RUN}answer.json", {"error": p["error"]}); return 1
    t_frames = time.time()
    sp, _ = sampling(600)
    q = (f'The video was posted by the channel "{p["channel"]}". Question: {a["question"]}\n'
         "Answer from what the frames show, plainly; say so when the frames cannot answer it.")
    g0 = time.time()
    o = llm.chat([messages(p, q)], sp, use_tqdm=False)[0]
    out = {"id": a["id"], "question": a["question"], "answer": o.outputs[0].text.strip(), "model": MODEL,
           "frameTimes": [t for t, _ in p["frames"]], "tokensIn": len(o.prompt_token_ids), "tokensOut": len(o.outputs[0].token_ids),
           "sec": {"framesPrep": round(t_frames - t_dl, 1), "modelLoad": load_s, "generate": round(time.time() - g0, 1),
                   "sinceScriptStart": round(time.time() - T_START, 1)}}
    put_json(f"{RUN}answer.json", out)
    print("ANSWER " + json.dumps(out), flush=True)
    return 0

if __name__ == "__main__":
    os.makedirs("/work/media", exist_ok=True)
    sys.exit(batch() if MODE == "batch" else ask())
