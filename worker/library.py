"""PAX2 worker job: the Library's dataset cards. For each dataset: its files in S3 with sizes,
and for every table a schema, a row count and a handful of sample rows.

Output: s3://pax-2-638175140432/library/catalog.json (published to data/generated/library.json).
"""
import io, json, os
import boto3, pandas as pd

B = "pax-2-638175140432"
s3 = boto3.client("s3")

# slug -> prefixes holding its files, and the tables worth previewing (S3 keys of parquet or csv).
DATASETS = {
    "swayable-archive": {"prefixes": ["raw/swayable/"], "tables": ["curated/swayable/regression_ates.parquet", "curated/swayable/tagging_2020.parquet", "curated/swayable/tagging_2018.parquet", "curated/swayable/studies.parquet", "curated/swayable/responses.parquet"]},
    "pax2-reference-model": {"prefixes": ["model/"], "tables": []},
    "emotional-ads": {"prefixes": ["raw/emotional-ads/"], "tables": []},
    "coppock-2020": {"prefixes": ["raw/coppock2020/"], "tables": ["curated/coppock2020/vote_choice_sates.parquet", "curated/coppock2020/exps.parquet"]},
    "upworthy-archive": {"prefixes": ["raw/upworthy/"], "tables": ["curated/upworthy/upworthy-archive-confirmatory-packages-03.12.2020.parquet", "curated/upworthy/upworthy-archive-exploratory-packages-03.12.2020.parquet"]},
    "wesleyan-codebook": {"prefixes": ["raw/wesleyan/"], "tables": []},
    "polis-opendata": {"prefixes": ["raw/polis-opendata/"], "tables": []},
    "hewitt-reproduction": {"prefixes": ["raw/hewitt-repro/"], "tables": []},
    "google-reform-ads": {"prefixes": ["athena/govblock/"], "tables": []},
    "pax2-takes": {"prefixes": ["videos/", "features/", "transcribe/", "takes/"], "tables": []},
}


def files(prefix):
    out, tok = [], None
    while True:
        r = s3.list_objects_v2(Bucket=B, Prefix=prefix, **({"ContinuationToken": tok} if tok else {}))
        out += [{"key": o["Key"], "bytes": o["Size"]} for o in r.get("Contents", []) if not o["Key"].endswith("/") and not o["Key"].endswith(".metadata")]
        tok = r.get("NextContinuationToken")
        if not tok:
            return out


def table(key):
    body = s3.get_object(Bucket=B, Key=key)["Body"].read()
    df = pd.read_parquet(io.BytesIO(body)) if key.endswith(".parquet") else pd.read_csv(io.BytesIO(body), low_memory=False)
    sample = df.head(8).copy()
    for c in sample.columns:
        sample[c] = sample[c].map(lambda v: None if pd.isna(v) else (str(v)[:80] if not isinstance(v, (int, float, bool)) else (round(v, 4) if isinstance(v, float) else v)))
    return {
        "key": key,
        "name": os.path.basename(key).rsplit(".", 1)[0],
        "rows": int(len(df)),
        "columns": [{"name": str(c), "type": str(t)} for c, t in df.dtypes.items()][:60],
        "columnCount": int(len(df.columns)),
        "sample": json.loads(sample.iloc[:, :12].to_json(orient="records")),
    }


out = {}
for slug, d in DATASETS.items():
    fs = [f for p in d["prefixes"] for f in files(p)]
    tabs = []
    for t in d["tables"]:
        try:
            tabs.append(table(t))
        except Exception as e:
            tabs.append({"key": t, "error": repr(e)[:200]})
    out[slug] = {"files": sorted(fs, key=lambda f: -f["bytes"])[:40], "fileCount": len(fs), "bytes": sum(f["bytes"] for f in fs), "tables": tabs}
    print(slug, len(fs), [t.get("rows") for t in tabs], flush=True)
s3.put_object(Bucket=B, Key="library/catalog.json", Body=json.dumps(out).encode())
print("done", flush=True)
