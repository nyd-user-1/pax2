"""PAX2 worker job 7: code each library script on the Swayable archive's features, so a script gets a
research prior before anyone records it. Claude on Bedrock does the coding (AI-assessed, labeled so).

Output: s3://pax-2-638175140432/model/script-codes.json
"""
import json, os, re
import boto3

B = "pax-2-638175140432"
s3 = boto3.client("s3")
br = boto3.client("bedrock-runtime", region_name="us-east-1")
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lib = json.load(open(f"{REPO}/data/library.json"))
model = json.load(open(f"{REPO}/data/generated/model/reference-model.json"))
labels = model["featureLabels"]

PROMPT = """Code this short advocacy video script the way the Swayable archive's coders coded campaign ads.
For each feature give the share of trained coders you would expect to mark it present, from 0 to 1.
The video will be a volunteer reading the script to a phone camera, with captions.
Features:
{features}

Script ({title}):
{text}

Return JSON only: {{"codes": {{feature_key: number}}, "notes": {{feature_key: "one short reason"}}}}. Notes only for features above 0.5."""

out = {"model": "us.anthropic.claude-sonnet-4-6", "source": "ai", "scripts": {}}
for s in lib["scripts"]:
    msg = PROMPT.format(features="\n".join(f"- {k}: {v}" for k, v in labels.items()), title=s["title"], text=s["text"])
    r = br.converse(modelId=out["model"], messages=[{"role": "user", "content": [{"text": msg}]}], inferenceConfig={"maxTokens": 1500, "temperature": 0})
    text = r["output"]["message"]["content"][0]["text"]
    j = json.loads(re.search(r"\{.*\}", text, re.S).group(0))
    codes = {k: max(0.0, min(1.0, float(v))) for k, v in j.get("codes", {}).items() if k in labels}
    pred = {}
    for outcome, o in model["outcomes"].items():
        p = o["prediction"]
        mean = p["intercept"] + sum(p["coefficients"].get(k, 0) * v for k, v in codes.items())
        pred[outcome] = {"expected": round(mean, 2), "low": round(mean - 1.96 * o["tau"], 2), "high": round(mean + 1.96 * o["tau"], 2), "average": o["meanEffect"]}
    out["scripts"][s["id"]] = {"codes": codes, "notes": j.get("notes", {}), "prior": pred}
    print(s["id"], pred.get("votechoice"), flush=True)
s3.put_object(Bucket=B, Key="model/script-codes.json", Body=json.dumps(out, indent=1).encode())
print("done", flush=True)
