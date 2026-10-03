"""PAX worker job 1: fetch the reference datasets into s3://pax-638175140432/raw/.

Runs on the pax-worker box only (never on the Mac). Every step is independent:
a failure is recorded in the manifest and the next step runs.
"""
import json, os, subprocess, sys, time, zipfile, glob, traceback
import boto3, requests

B = "pax-638175140432"
s3 = boto3.client("s3")
W = "/opt/pax/raw"
os.makedirs(W, exist_ok=True)
manifest = {"started": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "steps": {}}
UA = {"User-Agent": "pax-research/0.1 (brendan@nysgpt.com)"}


def up(path, key):
    s3.upload_file(path, B, key)
    return {"key": key, "bytes": os.path.getsize(path)}


def get(url, dest, **kw):
    with requests.get(url, stream=True, timeout=600, headers=UA, **kw) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
    return dest


def dataverse(doi, name):
    """Every file in a Dataverse dataset, original format, into raw/<name>/."""
    meta = requests.get("https://dataverse.harvard.edu/api/datasets/:persistentId/", params={"persistentId": doi}, headers=UA, timeout=120).json()
    files = meta["data"]["latestVersion"]["files"]
    d = f"{W}/{name}"
    os.makedirs(d, exist_ok=True)
    out = []
    for f in files:
        df = f["dataFile"]
        label = f.get("directoryLabel", "")
        fn = os.path.join(d, label, df.get("originalFileName") or f["label"]) if label else os.path.join(d, df.get("originalFileName") or f["label"])
        os.makedirs(os.path.dirname(fn), exist_ok=True)
        url = f"https://dataverse.harvard.edu/api/access/datafile/{df['id']}"
        get(url, fn, params={"format": "original"} if df.get("originalFileName") else None)
        out.append(up(fn, f"raw/{name}/{os.path.relpath(fn, d)}"))
    return {"doi": doi, "title": meta["data"]["latestVersion"].get("metadataBlocks", {}).get("citation", {}).get("fields", [{}])[0].get("value"), "files": out}


def step(name, fn):
    t = time.time()
    try:
        manifest["steps"][name] = {"ok": True, "result": fn(), "seconds": round(time.time() - t)}
    except Exception as e:
        manifest["steps"][name] = {"ok": False, "error": repr(e), "trace": traceback.format_exc()[-1500:], "seconds": round(time.time() - t)}
    s3.put_object(Bucket=B, Key="manifest/fetch.json", Body=json.dumps(manifest, indent=1).encode())
    print(name, manifest["steps"][name]["ok"], flush=True)


def swayable():
    r = dataverse("doi:10.7910/DVN/LBPSSV", "swayable")
    # Unzip any archive in place so later jobs read plain files.
    for z in glob.glob(f"{W}/swayable/**/*.zip", recursive=True):
        with zipfile.ZipFile(z) as zf:
            zf.extractall(z[:-4])
    listing = sorted(os.path.relpath(p, f"{W}/swayable") for p in glob.glob(f"{W}/swayable/**/*", recursive=True) if os.path.isfile(p))
    r["unzipped"] = listing[:400]
    return r


def search_dataverse(q):
    j = requests.get("https://dataverse.harvard.edu/api/search", params={"q": q, "type": "dataset", "per_page": 10}, headers=UA, timeout=60).json()
    return [{"doi": i.get("global_id"), "name": i.get("name"), "published": i.get("published_at")} for i in j["data"]["items"]]


def coppock():
    hits = search_dataverse('"small effects of political advertising"')
    hits += search_dataverse("Coppock Hill Vavreck advertising")
    pick = next((h for h in hits if h["name"] and "advertis" in h["name"].lower()), None)
    if not pick:
        return {"hits": hits, "picked": None}
    r = dataverse(pick["doi"], "coppock2020")
    r["hits"] = hits
    return r


def upworthy():
    # The archive lives on OSF (project jd64p); list its storage and take every CSV.
    out = []
    url = "https://api.osf.io/v2/nodes/jd64p/files/osfstorage/"
    stack = [url]
    d = f"{W}/upworthy"
    os.makedirs(d, exist_ok=True)
    while stack:
        j = requests.get(stack.pop(), headers=UA, timeout=60).json()
        for it in j.get("data", []):
            a = it["attributes"]
            if a["kind"] == "folder":
                stack.append(it["relationships"]["files"]["links"]["related"]["href"])
            elif a["name"].endswith((".csv", ".zip", ".md", ".txt", ".pdf")):
                fn = os.path.join(d, a["name"])
                get(it["links"]["download"], fn)
                out.append(up(fn, f"raw/upworthy/{a['name']}"))
        nxt = j.get("links", {}).get("next")
        if nxt:
            stack.append(nxt)
    return {"files": out}


def wesleyan():
    fn = f"{W}/wmp-2020-codebook.pdf"
    get("https://mediaproject.wesleyan.edu/wp-content/uploads/2023/01/WMP-2020-releasecodebook_v1.0-1.pdf", fn)
    return up(fn, "raw/wesleyan/WMP-2020-releasecodebook_v1.0-1.pdf")


def git(repo, name):
    d = f"{W}/{name}"
    subprocess.run(["rm", "-rf", d])
    subprocess.run(["git", "clone", "--depth", "1", repo, d], check=True, capture_output=True)
    files = [p for p in glob.glob(f"{d}/**/*", recursive=True) if os.path.isfile(p) and "/.git/" not in p]
    out = [up(p, f"raw/{name}/{os.path.relpath(p, d)}") for p in files if os.path.getsize(p) < 200 << 20]
    return {"files": len(out), "bytes": sum(o["bytes"] for o in out)}


steps = sys.argv[1:] or ["swayable", "coppock", "upworthy", "wesleyan", "polis", "hewitt_repo"]
table = {
    "swayable": swayable,
    "coppock": coppock,
    "upworthy": upworthy,
    "wesleyan": wesleyan,
    "polis": lambda: git("https://github.com/compdemocracy/openData", "polis-opendata"),
    "emotional": lambda: dataverse("doi:10.7910/DVN/CB3LP1", "emotional-ads"),
    "hewitt_repo": lambda: git("https://github.com/active-maintenance-aec/hewitt_etal_2024", "hewitt-repro"),
}
for s in steps:
    step(s, table[s])
manifest["finished"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
s3.put_object(Bucket=B, Key="manifest/fetch.json", Body=json.dumps(manifest, indent=1).encode())
print("done", flush=True)
