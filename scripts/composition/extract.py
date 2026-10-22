# Composition extraction, one box (window C, 2026-10-20). Per short, measured features only, from the
# 360p mp4 and the m4a in s3://pax-2-638175140432/catalog-media/:
#   duration; every frame's scene score (cuts = score >= CUT, pace = cuts per second; visual activity =
#   mean score); the hook window (cuts and loudness in the first 2 s, on-screen text in the first 2 s);
#   the momentary loudness curve per second (EBU R128) with integrated loudness and loudness range;
#   frame brightness and saturation at FPS; on-screen text by OCR at FPS (words per frame, text area).
# Speech rate, speech share and headline traits are added on the Mac by scripts/composition/merge.mjs,
# from the word-timed transcripts and the catalog titles, so they never leave the one definition there.
# One JSON per id to s3://<bucket>/composition/raw/<id>.json; done ids skip, so a rerun resumes.
#
#   python3 extract.py <bucket> <limit or 0> <log s3 uri>
#   python3 extract.py <bucket> 0 <log s3 uri> --upload <uploads/... key> <id>
#     one submitted take: the single file carries video and audio; the measurements land at
#     s3://<bucket>/composition/uploads/<id>.json. A copy of this file serves the app's worker box
#     from s3://<bucket>/code/composition/current/extract.py; re-upload it when this changes.
import json, os, re, subprocess, sys, time, tempfile, shutil, datetime
from multiprocessing import Pool

BUCKET, LIMIT, LOGURI = sys.argv[1], int(sys.argv[2]), sys.argv[3]
CUT = 0.3          # a provisional cut list only; merge.mjs derives cuts from every frame's score
FPS = float(os.environ.get("FPS", "1"))  # frames sampled per second for OCR and frame stats
OCR_CONF = 60      # tesseract word confidence floor
VERSION = "composition-1"

def run(args, **kw):
    return subprocess.run(args, capture_output=True, text=True, **kw)

def scene_scores(mp4):
    # every frame's scene score, with its time; metadata=print writes pts_time then the score
    p = run(["ffmpeg", "-hide_banner", "-nostats", "-i", mp4, "-an", "-vf", "select='gte(scene,0)',metadata=print:file=-", "-f", "null", "-"])
    out, t = [], None
    for line in p.stdout.splitlines():
        m = re.search(r"pts_time:([\d.]+)", line)
        if m:
            t = float(m.group(1)); continue
        m = re.search(r"lavfi\.scene_score=([\d.]+)", line)
        if m and t is not None:
            out.append((round(t, 3), round(float(m.group(1)), 4)))
    return out

def loudness(m4a):
    # EBU R128 momentary loudness every 100 ms, integrated loudness and loudness range from the summary.
    # The per-frame lines log at ffmpeg's info level by default; framelog=verbose hid them (rehearsal
    # composition-20261020-070540 came back with empty curves).
    p = run(["ffmpeg", "-hide_banner", "-nostats", "-i", m4a, "-af", "ebur128", "-f", "null", "-"])
    mom, integ, lra = [], None, None
    for line in p.stderr.splitlines():
        m = re.search(r"t:\s*([\d.]+)\s+TARGET.*?M:\s*(-?[\d.]+|-inf)", line)
        if m:
            v = m.group(2)
            mom.append((float(m.group(1)), -120.0 if v == "-inf" else float(v)))
    m = re.search(r"Integrated loudness:\s*I:\s*(-?[\d.]+) LUFS", p.stderr)
    if m: integ = float(m.group(1))
    m = re.search(r"Loudness range:\s*LRA:\s*(-?[\d.]+) LU", p.stderr)
    if m: lra = float(m.group(1))
    return mom, integ, lra

def frames(mp4, tmp):
    d = os.path.join(tmp, "f"); os.makedirs(d)
    run(["ffmpeg", "-hide_banner", "-nostats", "-i", mp4, "-an", "-vf", f"fps={FPS}", os.path.join(d, "%04d.png")])
    files = sorted(os.listdir(d))
    from PIL import Image, ImageStat
    rows = []
    for i, f in enumerate(files):
        path = os.path.join(d, f)
        im = Image.open(path).convert("RGB")
        w, h = im.size
        y = ImageStat.Stat(im.convert("L")).mean[0]
        s = ImageStat.Stat(im.convert("HSV")).mean[1]
        t = run(["tesseract", path, "stdout", "--psm", "11", "tsv"], env={**os.environ, "OMP_THREAD_LIMIT": "1"})
        words, area = 0, 0
        for line in t.stdout.splitlines()[1:]:
            c = line.split("\t")
            if len(c) < 12: continue
            try: conf = float(c[10])
            except ValueError: continue
            txt = c[11].strip()
            if conf >= OCR_CONF and len(re.sub(r"[^A-Za-z0-9]", "", txt)) >= 2:
                words += 1; area += int(c[8]) * int(c[9])
        rows.append({"t": round(i / FPS, 2), "y": round(y, 1), "sat": round(s, 1), "words": words, "textArea": round(area / (w * h), 4)})
    return rows, (w, h) if files else None

def one(vid):
    tmp = tempfile.mkdtemp(dir="/opt/work/tmp")
    try:
        mp4, m4a = os.path.join(tmp, "v.mp4"), os.path.join(tmp, "a.m4a")
        got_v = run(["aws", "s3", "cp", "--only-show-errors", f"s3://{BUCKET}/catalog-media/{vid}.mp4", mp4]).returncode == 0
        got_a = run(["aws", "s3", "cp", "--only-show-errors", f"s3://{BUCKET}/catalog-media/{vid}.m4a", m4a]).returncode == 0
        if not got_v and not got_a:
            return vid, "no media"
        out = {"id": vid, "version": VERSION, "cutThreshold": CUT, "fps": FPS, "at": datetime.datetime.now(datetime.timezone.utc).isoformat()}
        src = mp4 if got_v else m4a
        d = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]).stdout.strip()
        out["durationSec"] = round(float(d), 2) if d and d != "N/A" else None
        if got_v:
            sc = scene_scores(mp4)
            out["scenes"] = sc  # [t, score] per frame; cuts and activity derive from this on the Mac too
            out["cuts"] = [t for t, s in sc if s >= CUT and t > 0.05]
            fr, size = frames(mp4, tmp)
            out["frames"] = fr
            out["size"] = size
        if got_a:
            mom, integ, lra = loudness(m4a)
            per = {}
            for t, v in mom:
                per.setdefault(int(t - 1e-9), []).append(v)
            # per-second mean of momentary loudness in the energy domain, back to LUFS
            import math
            curve = []
            for s in sorted(per):
                e = sum(10 ** (v / 10) for v in per[s]) / len(per[s])
                curve.append(round(10 * math.log10(e), 1) if e > 0 else -120.0)
            out["loudness"] = {"integrated": integ, "range": lra, "perSecond": curve}
        with open(os.path.join(tmp, "out.json"), "w") as fh:
            json.dump(out, fh)
        r = run(["aws", "s3", "cp", "--only-show-errors", os.path.join(tmp, "out.json"), f"s3://{BUCKET}/composition/raw/{vid}.json"])
        return vid, None if r.returncode == 0 else ("upload: " + r.stderr[-200:])
    except Exception as e:
        return vid, repr(e)[-300:]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

def one_upload(key, vid):
    tmp = tempfile.mkdtemp(dir="/opt/work/tmp")
    try:
        src = os.path.join(tmp, "take." + key.rsplit(".", 1)[-1])
        if run(["aws", "s3", "cp", "--only-show-errors", f"s3://{BUCKET}/{key}", src]).returncode != 0:
            return vid, "no upload at " + key
        out = {"id": vid, "key": key, "version": VERSION, "cutThreshold": CUT, "fps": FPS, "at": datetime.datetime.now(datetime.timezone.utc).isoformat()}
        d = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]).stdout.strip()
        out["durationSec"] = round(float(d), 2) if d and d != "N/A" else None
        sc = scene_scores(src)
        out["scenes"] = sc
        out["cuts"] = [t for t, s in sc if s >= CUT and t > 0.05]
        fr, size = frames(src, tmp)
        out["frames"] = fr
        out["size"] = size
        mom, integ, lra = loudness(src)
        per = {}
        for t, v in mom:
            per.setdefault(int(t - 1e-9), []).append(v)
        import math
        curve = []
        for s in sorted(per):
            e = sum(10 ** (v / 10) for v in per[s]) / len(per[s])
            curve.append(round(10 * math.log10(e), 1) if e > 0 else -120.0)
        out["loudness"] = {"integrated": integ, "range": lra, "perSecond": curve}
        with open(os.path.join(tmp, "out.json"), "w") as fh:
            json.dump(out, fh)
        r = run(["aws", "s3", "cp", "--only-show-errors", os.path.join(tmp, "out.json"), f"s3://{BUCKET}/composition/uploads/{vid}.json"])
        return vid, None if r.returncode == 0 else ("upload: " + r.stderr[-200:])
    except Exception as e:
        return vid, repr(e)[-300:]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

if __name__ == "__main__":
    os.makedirs("/opt/work/tmp", exist_ok=True)
    if "--upload" in sys.argv:
        i = sys.argv.index("--upload")
        vid, err = one_upload(sys.argv[i + 1], sys.argv[i + 2])
        print(f"{vid}: {err or 'ok'}", flush=True)
        sys.exit(1 if err else 0)
    have = set(l.strip()[:-4] for l in open("media.txt") if l.strip())
    done = set(l.strip()[:-5] for l in open("done.txt") if l.strip())
    ids = sorted(i for i in have if i not in done)
    if os.path.exists("order.txt"):
        order = [l.strip() for l in open("order.txt") if l.strip()]
        rank = {v: k for k, v in enumerate(order)}
        ids.sort(key=lambda i: rank.get(i, 10 ** 9))
    if LIMIT: ids = ids[:LIMIT]
    print(f"{len(have)} ids with media, {len(done)} done, {len(ids)} to do, {os.cpu_count()} cpus, fps {FPS}", flush=True)
    t0 = time.time(); n = 0; errs = 0
    with Pool(os.cpu_count()) as pool:
        for vid, err in pool.imap_unordered(one, ids):
            n += 1
            if err:
                errs += 1; print(f"{vid}: {err}", flush=True)
                if n >= 5 and errs == n: print("first five all failed; stopping", flush=True); pool.terminate(); sys.exit(1)
            if n % 100 == 0 or n == len(ids):
                el = time.time() - t0
                print(f"{n}/{len(ids)} errors {errs} at {n / el * 60:.1f}/min", flush=True)
                run(["aws", "s3", "cp", "--only-show-errors", "/var/log/pax2-composition.log", LOGURI])
    print(f"DONE {n - errs} of {len(ids)} in {time.time() - t0:.0f}s, errors {errs}", flush=True)
