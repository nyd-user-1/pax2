"""PAX2 worker job 3: download the Question 3 campaign shorts to s3://pax-2-638175140432/videos/.

Input: data/raw/yt-videos.json (YouTube Data API listing, committed in the repo).
Keeps vertical-length videos (under two minutes) from the two Yes on 3 channels.
"""
import json, os, re, subprocess, sys, time
import boto3

B = "pax-2-638175140432"
s3 = boto3.client("s3")
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = "/opt/pax2/videos"
os.makedirs(D, exist_ok=True)


def seconds(iso):
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso or "")
    return int(m.group(1) or 0) * 3600 + int(m.group(2) or 0) * 60 + int(m.group(3) or 0) if m else 0


vids = json.load(open(f"{REPO}/data/raw/yt-videos.json"))["videos"]
pick = [v for v in vids if re.search(r"yes on 3", v["channel"], re.I) and 5 <= seconds(v["duration"]) <= 120]
limit = int(sys.argv[1]) if len(sys.argv) > 1 else 40
out = {}
for v in pick[:limit]:
    vid = v["id"]
    fn = f"{D}/{vid}.mp4"
    try:
        if not os.path.exists(fn):
            r = subprocess.run(
                ["yt-dlp", "-q", "--no-warnings", "-f", "bv*[height<=1280][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b", "--merge-output-format", "mp4", "--write-thumbnail", "--convert-thumbnails", "jpg", "-o", f"{D}/{vid}.%(ext)s", f"https://www.youtube.com/watch?v={vid}"],
                capture_output=True, text=True, timeout=300,
            )
            if r.returncode != 0:
                out[vid] = {"ok": False, "error": (r.stderr or r.stdout)[-400:]}
                print(vid, "fail", flush=True)
                continue
        s3.upload_file(fn, B, f"videos/{vid}.mp4", ExtraArgs={"ContentType": "video/mp4"})
        if os.path.exists(f"{D}/{vid}.jpg"):
            s3.upload_file(f"{D}/{vid}.jpg", B, f"videos/{vid}.jpg", ExtraArgs={"ContentType": "image/jpeg"})
        probe = json.loads(subprocess.run(["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", fn], capture_output=True, text=True).stdout)
        vs = next((s for s in probe["streams"] if s["codec_type"] == "video"), {})
        out[vid] = {"ok": True, "bytes": os.path.getsize(fn), "width": vs.get("width"), "height": vs.get("height"), "seconds": float(probe["format"]["duration"])}
        print(vid, "ok", flush=True)
    except Exception as e:
        out[vid] = {"ok": False, "error": repr(e)[:300]}
    s3.put_object(Bucket=B, Key="manifest/videos.json", Body=json.dumps(out, indent=1).encode())
print("done", sum(1 for o in out.values() if o["ok"]), "of", len(out), flush=True)
