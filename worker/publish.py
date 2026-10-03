"""PAX worker job: copy what the box produced in S3 into the repo's data/generated/ and push it.

Usage: python3 publish.py takes features model ...   (each name is a section below)
"""
import json, os, subprocess, sys
import boto3

B = "pax-638175140432"
s3 = boto3.client("s3")
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G = f"{REPO}/data/generated"


def objs(prefix, suffix=".json"):
    out, tok = [], None
    while True:
        r = s3.list_objects_v2(Bucket=B, Prefix=prefix, **({"ContinuationToken": tok} if tok else {}))
        out += [o["Key"] for o in r.get("Contents", []) if o["Key"].endswith(suffix)]
        tok = r.get("NextContinuationToken")
        if not tok:
            return out


def load(key):
    return json.loads(s3.get_object(Bucket=B, Key=key)["Body"].read())


def write(rel, data):
    path = f"{G}/{rel}"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)


def takes():
    write("takes.json", sorted((load(k) for k in objs("takes/")), key=lambda t: t["id"]))


def features():
    allf = {}
    for k in objs("features/"):
        f = load(k)
        # Word-level timings stay in S3; the app needs the transcript text and per-second series.
        if isinstance(f.get("transcript"), dict):
            f["transcript"]["words"] = [{"t": w["t"], "w": w["w"]} for w in f["transcript"].get("words", [])]
        allf[f["take"]] = f
    write("features.json", allf)


def model():
    for k in objs("model/"):
        write(f"model/{k.split('/')[-1]}", load(k))


def sections():
    for k in objs("sections/"):
        write(k, load(k))


TABLE = {"takes": takes, "features": features, "model": model, "sections": sections}
subprocess.run(["git", "-C", REPO, "pull", "-q", "--rebase"], check=True)
for s in sys.argv[1:]:
    TABLE[s]()
subprocess.run(["git", "-C", REPO, "add", "data/generated"], check=True)
if subprocess.run(["git", "-C", REPO, "diff", "--cached", "--quiet"]).returncode:
    subprocess.run(["git", "-C", REPO, "-c", "user.name=pax-worker", "-c", "user.email=pax-worker@users.noreply.github.com", "commit", "-q", "-m", f"data: {' '.join(sys.argv[1:])} from the worker box"], check=True)
    subprocess.run(["git", "-C", REPO, "push", "-q"], check=True)
    print("pushed", flush=True)
else:
    print("nothing new", flush=True)
