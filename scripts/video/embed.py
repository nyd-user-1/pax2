"""Window MM-A (2026-10-20): stock VideoPrism over every catalog-media short, plus the rung-0 control.
Runs on the GPU box (scripts/video/box.sh) in the JAX venv; CLIP runs beside it in the DLAMI's torch
(scripts/video/clip_embed.py) and reads the frames this process leaves in /work/clipq.

Registered sampling (docs/briefs/MM-A-videoprism-stock.md, one attempt, no tuning): per video, frames at
the centers of N equal slices of the full duration, N = 16 for the base model and 8 for large; each frame
resized so its shorter side is 288, center-cropped to 288x288, RGB in [0, 1]. One embedding per video per
arm, L2-normalized. VideoPrism reads no audio. Rung 0 is mean-pooled CLIP ViT-B-32 over the base arm's 16
frames (shorter side 224, center crop 224, the openai preprocessing).

Streams: media comes down in batches of BATCH, is decoded by a process pool, embedded, and deleted. Frames
live only in memory and, for CLIP, in /work/clipq until clip_embed.py has read them.

Env: BUCKET, RUN (s3 prefix model/video-embeddings/<runid>/), MEDIA_LIST (file of mp4 keys), SLICE (every
Nth video; 20 in the rehearsal, 1 for the full pass), BATCH (default 200), OUT (default /work/out)
Writes OUT/videoprism-base.jsonl, OUT/videoprism-large.jsonl ({id, vector}), OUT/embed-failures.json
"""
import collections
import concurrent.futures as cf
import json
import multiprocessing as mp
import os
import shutil
import sys
import itertools
import threading
import time

import av
import boto3
import numpy as np
from PIL import Image

BUCKET = os.environ["BUCKET"]
RUN = os.environ["RUN"]
OUT = os.environ.get("OUT", "/work/out")
SLICE = int(os.environ.get("SLICE", "1"))
BATCH = int(os.environ.get("BATCH", "200"))
MEDIA = "/work/media"
CLIPQ = "/work/clipq"
INFLIGHT = 24  # decoded videos waiting for the GPU, at most
GPU_BATCH = 2  # 8 ran out of memory on the 24 GB L4 (12 GiB for one base batch)
for d in (OUT, MEDIA, CLIPQ):
    os.makedirs(d, exist_ok=True)
s3 = boto3.client("s3", region_name="us-east-1")


def log(*a):
    print(time.strftime("%H:%M:%S"), "embed:", *a, flush=True)


def mem():
    m = dict(l.split(":", 1) for l in open("/proc/meminfo"))
    rss = next((l.split()[1] for l in open("/proc/self/status") if l.startswith("VmRSS")), "0")
    return f"host available {int(m['MemAvailable'].split()[0]) / 1e6:.1f} GB, this process {int(rss) / 1e6:.1f} GB"


def centers(duration, n):
    return [(i + 0.5) * duration / n for i in range(n)]


def crop(img, side):
    w, h = img.size
    s = side / min(w, h)
    img = img.resize((max(side, round(w * s)), max(side, round(h * s))), Image.BICUBIC)
    w, h = img.size
    left, top = (w - side) // 2, (h - side) // 2
    return np.asarray(img.crop((left, top, left + side, top + side)).convert("RGB"), dtype=np.uint8)


def grab(path, times):
    """The first frame at or after each time (seek to the keyframe before it, decode forward)."""
    out = []
    with av.open(path) as c:
        st = c.streams.video[0]
        st.thread_type = "AUTO"
        tb = float(st.time_base)
        last = None
        for t in times:
            c.seek(int(t / tb), stream=st, backward=True, any_frame=False)
            got = None
            for fr in c.decode(st):
                last = fr
                if fr.pts is not None and fr.pts * tb >= t - 1e-3:
                    got = fr
                    break
            got = got or last  # past the last frame: the last one decoded
            if got is None:
                raise RuntimeError(f"no frame at {t:.2f}s")
            out.append(got.to_image())
    return out


def decode(vid):
    path = f"{MEDIA}/{vid}.mp4"
    try:
        with av.open(path) as c:
            st = c.streams.video[0]
            dur = float(c.duration / 1e6) if c.duration else float(st.duration * st.time_base)
        f16 = grab(path, centers(dur, 16))
        f8 = grab(path, centers(dur, 8))
        base = np.stack([crop(im, 288) for im in f16])
        large = np.stack([crop(im, 288) for im in f8])
        clip = np.stack([crop(im, 224) for im in f16])
        np.save(f"{CLIPQ}/{vid}.tmp.npy", clip)
        os.rename(f"{CLIPQ}/{vid}.tmp.npy", f"{CLIPQ}/{vid}.npy")
        return vid, dur, base, large, None
    except Exception as e:  # noqa: BLE001
        return vid, None, None, None, f"{type(e).__name__}: {e}"
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


def download(ids):
    def one(v):
        s3.download_file(BUCKET, f"catalog-media/{v}.mp4", f"{MEDIA}/{v}.mp4")
    with cf.ThreadPoolExecutor(16) as ex:
        list(ex.map(one, ids))


def main():
    t0 = time.time()
    ids = sorted({l.strip().rsplit("/", 1)[-1][:-4] for l in open(os.environ["MEDIA_LIST"]) if l.strip().endswith(".mp4")})
    ids = ids[::SLICE]
    log(f"{len(ids)} videos (slice 1 in {SLICE})")

    import jax
    import jax.numpy as jnp
    from videoprism import models as vp

    log("jax devices", jax.devices())
    arms = {}
    for arm, name in (("base", "videoprism_lvt_public_v1_base"), ("large", "videoprism_lvt_public_v1_large")):
        model = vp.get_model(name)
        state = vp.load_pretrained_weights(name)

        def fwd(x, model=model, state=state):
            v, _, _ = model.apply(state, x, None, None, train=False)
            return v

        arms[arm] = jax.jit(fwd)
        log(f"loaded {name}, {mem()}")

    files = {a: open(f"{OUT}/videoprism-{a}.jsonl", "w") for a in arms}
    pending = {"base": [], "large": []}
    failures = []
    norms = {"base": [], "large": []}

    def flush(arm, force=False):
        q = pending[arm]
        while len(q) >= GPU_BATCH or (force and q):
            chunk, q[:] = q[:GPU_BATCH], q[GPU_BATCH:]
            x = np.stack([c[1] for c in chunk]).astype(np.float32) / 255.0
            n = len(chunk)
            if n < GPU_BATCH:  # fixed shape, one compile per arm
                x = np.concatenate([x, np.zeros((GPU_BATCH - n, *x.shape[1:]), np.float32)])
            v = np.asarray(arms[arm](jnp.asarray(x)))[:n].astype(np.float64)
            nv = np.linalg.norm(v, axis=1)
            norms[arm].extend(nv.tolist())
            v = v / np.maximum(nv[:, None], 1e-12)
            for (vid, _), vec in zip(chunk, v):
                files[arm].write(json.dumps({"id": vid, "vector": [round(float(a), 6) for a in vec]}) + "\n")
            files[arm].flush()

    batches = [ids[i : i + BATCH] for i in range(0, len(ids), BATCH)]
    nxt = threading.Thread(target=download, args=(batches[0],))
    nxt.start()
    done = 0
    with cf.ProcessPoolExecutor(max(1, os.cpu_count() - 1), mp_context=mp.get_context("spawn")) as pool:  # spawn: never fork a JAX process
        for bi, batch in enumerate(batches):
            nxt.join()
            if bi + 1 < len(batches):
                nxt = threading.Thread(target=download, args=(batches[bi + 1],))
                nxt.start()
            window, it = collections.deque(), iter(batch)
            for v in itertools.islice(it, INFLIGHT):
                window.append(pool.submit(decode, v))
            while window:
                vid, dur, base, large, err = window.popleft().result()
                nv = next(it, None)
                if nv is not None:
                    window.append(pool.submit(decode, nv))
                if err:
                    failures.append({"id": vid, "error": err})
                    log(f"fail {vid}: {err}")
                    continue
                pending["base"].append((vid, base))
                pending["large"].append((vid, large))
                flush("base")
                flush("large")
                done += 1
                if done in (1, 2, 10):
                    log(f"{done} embedded, {time.time() - t0:.0f}s, {mem()}")
            log(f"batch {bi + 1}/{len(batches)}: {done} embedded, {len(failures)} failed, {time.time() - t0:.0f}s, clipq {len(os.listdir(CLIPQ))}, disk free {shutil.disk_usage('/').free / 1e9:.0f} GB, {mem()}")
    for a in arms:
        flush(a, force=True)
        files[a].close()
    json.dump({"failures": failures, "embedded": done, "videos": len(ids), "rawNorm": {a: {"min": min(norms[a]), "max": max(norms[a]), "mean": float(np.mean(norms[a]))} for a in norms if norms[a]}, "seconds": round(time.time() - t0)}, open(f"{OUT}/embed-summary.json", "w"), indent=1)
    open(f"{CLIPQ}/DONE", "w").close()
    log(f"done: {done} of {len(ids)} in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
