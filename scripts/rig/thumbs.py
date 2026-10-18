"""B1. Thumbnails for every id in the training set, for PAX2 Vision Encoder (CLIP and ResMem).

hqdefault.jpg from i.ytimg.com, 16 threads, 0.05 s pacing per thread, one retry, 404 skipped.
Writes /work/thumbs/<id>.jpg (kept on the box for encode_images.py) and uploads only the failures.
"""
import os, threading, time, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor

from common import dump, log, training_rows

JOB = "thumbs"
DIR = "/work/thumbs"
os.makedirs(DIR, exist_ok=True)

ids = sorted({r["id"] for r in training_rows()})
log(f"thumbs: {len(ids)} ids")
lock = threading.Lock()
state = {"done": 0, "fetched": 0, "cached": 0, "missing": 0}
failures = []


def get(vid):
    path = f"{DIR}/{vid}.jpg"
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return "cached", None
    url = f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"
    err = None
    for attempt in range(2):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=20) as r:
                body = r.read()
            with open(path + ".part", "wb") as f:
                f.write(body)
            os.replace(path + ".part", path)
            return "fetched", None
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return "missing", "404"
            err = f"HTTP {e.code}"
        except Exception as e:
            err = type(e).__name__ + ": " + str(e)[:120]
        time.sleep(0.5)
    return "failed", err


def work(vid):
    status, err = get(vid)
    time.sleep(0.05)
    with lock:
        state["done"] += 1
        if status in ("fetched", "cached"):
            state[status] += 1
        else:
            if status == "missing":
                state["missing"] += 1
            failures.append({"id": vid, "reason": err})
        if state["done"] % 500 == 0:
            log(f"thumbs: {state['done']}/{len(ids)} fetched={state['fetched']} cached={state['cached']} failures={len(failures)}")


t0 = time.time()
with ThreadPoolExecutor(16) as ex:
    list(ex.map(work, ids))
on_disk = sum(1 for f in os.listdir(DIR) if f.endswith(".jpg"))
log(f"thumbs: done in {time.time() - t0:.0f}s: {state['fetched']} fetched, {state['cached']} already on disk, {len(failures)} failures ({state['missing']} 404), {on_disk} jpgs on disk")
dump(JOB, "thumb-failures.json", {"ids": len(ids), "fetched": state["fetched"] + state["cached"], "failures": failures})
