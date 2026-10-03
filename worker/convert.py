"""PAX worker job 2: turn the R archives into Parquet + CSV under curated/, and report every schema.

Reads /opt/pax/raw (left by fetch.py). Runs on the worker box only.
"""
import glob, json, os, sys, time, traceback
import boto3, pandas as pd, rdata

B = "pax-638175140432"
s3 = boto3.client("s3")
W = "/opt/pax/raw"
C = "/opt/pax/curated"
os.makedirs(C, exist_ok=True)
report = {}


def to_frames(path):
    parsed = rdata.parser.parse_file(path)
    obj = rdata.conversion.convert(parsed, default_encoding="utf8")
    if isinstance(obj, pd.DataFrame):
        return {"": obj}
    if isinstance(obj, dict):
        return {k: v for k, v in obj.items() if isinstance(v, pd.DataFrame)}
    if isinstance(obj, list):
        return {str(i): v for i, v in enumerate(obj) if isinstance(v, pd.DataFrame)}
    return {}


def clean(df):
    df = df.copy()
    for c in df.columns:
        if df[c].dtype == "object" or str(df[c].dtype) == "category":
            df[c] = df[c].astype("string")
    return df


def save(df, name):
    df = clean(df)
    pq = f"{C}/{name}.parquet"
    csv = f"{C}/{name}.csv"
    os.makedirs(os.path.dirname(pq), exist_ok=True)
    df.to_parquet(pq, index=False)
    df.to_csv(csv, index=False)
    s3.upload_file(pq, B, f"curated/{name}.parquet")
    s3.upload_file(csv, B, f"curated/{name}.csv")
    report[name] = {"rows": len(df), "cols": len(df.columns), "columns": {c: str(t) for c, t in df.dtypes.items()}, "head": json.loads(df.head(3).to_json(orient="records", default_handler=str))}
    s3.put_object(Bucket=B, Key="manifest/convert.json", Body=json.dumps(report, indent=1, default=str).encode())
    print("saved", name, len(df), flush=True)


rds = sorted(glob.glob(f"{W}/swayable/**/*.[Rr][Dd][Ss]", recursive=True)) + sorted(glob.glob(f"{W}/coppock2020/**/*.[Rr][Dd][Ss]", recursive=True))
# Smallest first; the respondent file and the model fits are huge R objects and go last (or are skipped).
rds.sort(key=os.path.getsize)
SKIP = {"regression_fits", "regression_fits_ipw", "regression_fits_subgroup"}
for path in rds:
    if os.path.basename(path).rsplit(".", 1)[0] in SKIP:
        report[os.path.basename(path)] = {"skipped": "fitted model objects, not data"}
        continue
    base = ("swayable/" if "/swayable/" in path else "coppock2020/") + os.path.basename(path).rsplit(".", 1)[0]
    if "appendix_in_cycle" in path:
        continue
    try:
        frames = to_frames(path)
        if not frames:
            report[base] = {"skipped": "not a data frame"}
        for k, df in frames.items():
            save(df, base + (f"__{k}" if k else ""))
    except Exception as e:
        report[base] = {"error": repr(e)[:300]}

# Plain tables already in text form: copy through with their schema.
for path in sorted(glob.glob(f"{W}/coppock2020/**/*", recursive=True)) + sorted(glob.glob(f"{W}/upworthy/*.csv")) + sorted(glob.glob(f"{W}/swayable/**/*.csv", recursive=True)):
    if not os.path.isfile(path) or not path.lower().endswith((".csv", ".tab")):
        continue
    name = ("upworthy/" if "/upworthy/" in path else "coppock2020/" if "/coppock2020/" in path else "swayable/") + os.path.basename(path).rsplit(".", 1)[0]
    try:
        with open(path, "r", errors="replace") as f:
            head = f.readline()
        sep = "\t" if head.count("\t") > head.count(",") else ","
        save(pd.read_csv(path, sep=sep, low_memory=False), name)
    except Exception as e:
        report[name] = {"error": repr(e)[:300]}

report["_other_files"] = sorted(os.path.relpath(p, W) for p in glob.glob(f"{W}/coppock2020/**/*", recursive=True) if os.path.isfile(p))
s3.put_object(Bucket=B, Key="manifest/convert.json", Body=json.dumps(report, indent=1, default=str).encode())
print("done", len(report), flush=True)
