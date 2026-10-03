"""PAX worker job 6: the reference model, from the Swayable archive (Hewitt et al., APSR 2024).

What it produces (s3://pax-638175140432/model/):
  reference-model.json  per-feature persuasion differences (random-effects meta-regression, ours),
                        the authors' own meta-regression rows for the same features, the spread of
                        true effects (tau), and a leave-one-study-out check of how predictable an
                        ad's effect is from its coded features.
  ads.json              one row per ad and outcome: measured effect, its standard error, and the
                        coded features PAX uses, for the explorer.
Effects are in percentage points against the study's control group.
"""
import json, os
import boto3, numpy as np, pandas as pd

B = "pax-638175140432"
s3 = boto3.client("s3")
C = "/opt/pax/curated/swayable"

FEATURES = {
    "technique_plain_folks": "Plain-folks appeal",
    "technique_pos_testimonial": "Positive testimonial",
    "technique_neg_testimonial": "Negative testimonial",
    "messenger_every_people": "Everyday people as messengers",
    "messenger_politician": "Politician as messenger",
    "messenger_celebrity": "Celebrity as messenger",
    "messenger_veteran": "Veteran as messenger",
    "narration_personal_story": "Personal story",
    "narration_explain_facts": "Explains facts",
    "narration_advocate_opinions": "Advocates an opinion",
    "policy_facts": "Policy facts",
    "fact_cite_yes": "Cites a source for its facts",
    "fact_new_yes": "Offers a fact the viewer likely hasn't heard",
    "emotion_anger": "Anger",
    "emotion_enthusiasm": "Enthusiasm",
    "emotion_fear": "Fear",
    "emotion_hope_pride": "Pride",
    "emotion_humor": "Humor",
    "emotion_somber": "Somber",
    "tone_positive": "Positive tone",
    "tone_negative": "Negative tone",
    "tone_contrast": "Contrast",
    "explicit_vote_for": "Explicit ask to vote for",
    "production_value_high": "High production value",
    "style_amateur": "Amateur, phone-shot style",
    "style_text_on_screen": "Text on screen",
    "style_animation": "Animation",
    "how_scripted": "Sounds scripted",
}

ates = pd.read_parquet(f"{C}/regression_ates.parquet")
t18 = pd.read_parquet(f"{C}/tagging_2018.parquet")
t20 = pd.read_parquet(f"{C}/tagging_2020.parquet")
studies = pd.read_parquet(f"{C}/studies.parquet")
tags = pd.concat([t18.assign(year=2018), t20.assign(year=2020)], ignore_index=True)
if "emotion_pride" in tags.columns:
    tags["emotion_hope_pride"] = tags["emotion_pride"]
feat_cols = [f for f in FEATURES if f in tags.columns]
tags = tags.drop_duplicates("content_id")
df = ates.merge(tags[["content_id", "year"] + feat_cols], on="content_id", how="left")
df = df[df["std.error"] > 0].copy()


def dl_tau2(y, v):
    """DerSimonian–Laird between-ad variance."""
    w = 1 / v
    mu = np.sum(w * y) / np.sum(w)
    q = np.sum(w * (y - mu) ** 2)
    c = np.sum(w) - np.sum(w ** 2) / np.sum(w)
    return max(0.0, (q - (len(y) - 1)) / c), mu


def wls(X, y, w):
    W = np.diag(w)
    XtWX = X.T @ W @ X
    beta = np.linalg.solve(XtWX, X.T @ W @ y)
    cov = np.linalg.inv(XtWX)
    return beta, np.sqrt(np.diag(cov))


out = {"source": "Hewitt, Broockman, Coppock, Tappin, Slezak, Coffman, Lubin, Hamidian. How Experiments Help Campaigns Persuade Voters. APSR 2024. Dataverse doi:10.7910/DVN/LBPSSV (CC0).",
       "units": "percentage points vs. control", "outcomes": {}}
ads_rows = []
for outcome, g in df.groupby("outcome"):
    g = g.dropna(subset=["estimate"])
    y = g["estimate"].to_numpy()
    v = g["std.error"].to_numpy() ** 2
    tau2, mu_fe = dl_tau2(y, v)
    w = 1 / (v + tau2)
    mu = float(np.sum(w * y) / np.sum(w))
    se_mu = float(np.sqrt(1 / np.sum(w)))
    res = {"ads": int(g["content_id"].nunique()), "estimates": int(len(g)), "studies": int(g["study_id"].nunique()),
           "meanEffect": round(mu, 3), "meanEffectSe": round(se_mu, 3), "tau": round(float(np.sqrt(tau2)), 3),
           "shareAboveZero": round(float(np.mean(y > 0)), 3), "features": []}
    gg = g.dropna(subset=feat_cols)
    for f in feat_cols:
        x = gg[f].clip(0, 1).to_numpy()
        if np.std(x) < 0.02:
            continue
        yy = gg["estimate"].to_numpy()
        vv = gg["std.error"].to_numpy() ** 2
        X = np.column_stack([np.ones_like(x), x])
        beta, se = wls(X, yy, 1 / (vv + tau2))
        res["features"].append({"key": f, "label": FEATURES[f], "diff": round(float(beta[1]), 3), "se": round(float(se[1]), 3),
                                "low": round(float(beta[1] - 1.96 * se[1]), 3), "high": round(float(beta[1] + 1.96 * se[1]), 3),
                                "prevalence": round(float(np.mean(x > 0.5)), 3), "n": int(len(x))})
    res["features"].sort(key=lambda r: -abs(r["diff"] / max(r["se"], 1e-9)))
    # How predictable is an ad's effect from its features? Leave one study out, ridge on all features.
    X = gg[feat_cols].clip(0, 1).to_numpy()
    yy = gg["estimate"].to_numpy()
    vv = gg["std.error"].to_numpy() ** 2
    ww = 1 / (vv + tau2)
    preds = np.zeros_like(yy)
    lam = 5.0
    for sid in gg["study_id"].unique():
        tr = (gg["study_id"] != sid).to_numpy()
        Xt = np.column_stack([np.ones(tr.sum()), X[tr]])
        W = ww[tr]
        A = Xt.T @ (Xt * W[:, None]) + lam * np.diag([0] + [1] * X.shape[1])
        b = np.linalg.solve(A, Xt.T @ (W * yy[tr]))
        preds[~tr] = np.column_stack([np.ones((~tr).sum()), X[~tr]]) @ b
    base = np.sum(ww * yy) / np.sum(ww)
    r2 = 1 - np.sum(ww * (yy - preds) ** 2) / np.sum(ww * (yy - base) ** 2)
    corr = float(np.corrcoef(preds, yy)[0, 1])
    Xa = np.column_stack([np.ones(len(yy)), X])
    A = Xa.T @ (Xa * ww[:, None]) + lam * np.diag([0] + [1] * X.shape[1])
    b = np.linalg.solve(A, Xa.T @ (ww * yy))
    res["prediction"] = {"method": "ridge (lambda 5), inverse-variance weights, leave one study out",
                         "outOfSampleR2": round(float(r2), 3), "correlation": round(corr, 3),
                         "intercept": round(float(b[0]), 4), "coefficients": {f: round(float(c), 4) for f, c in zip(feat_cols, b[1:])}}
    out["outcomes"][outcome] = res
    for _, r in g.iterrows():
        ads_rows.append({"ad": r["content_id"], "study": r["study_id"], "year": None if pd.isna(r.get("year")) else int(r["year"]), "outcome": outcome,
                         "effect": round(float(r["estimate"]), 2), "se": round(float(r["std.error"]), 2), "n": None if pd.isna(r.get("n_obs")) else int(r["n_obs"]),
                         **{f: None if pd.isna(r.get(f)) else round(float(min(1, max(0, r[f]))), 2) for f in feat_cols}})

# The authors' own meta-regressions for the same features, as published in their archive.
mr = pd.read_parquet(f"{C}/tidied_metaregs.parquet")
out["authors"] = {"specifications": sorted(mr["specification"].dropna().unique().tolist())[:30],
                  "types": sorted(mr["type"].dropna().unique().tolist())[:30],
                  "datasets": sorted(mr["dataset"].dropna().unique().tolist())}
keep = mr[mr["term"].isin(feat_cols)]
out["authors"]["rows"] = json.loads(keep[["metareg_name", "term", "specification", "type", "dataset", "outcome", "estimate", "std.error", "conf.low", "conf.high"]].drop_duplicates().head(600).to_json(orient="records"))
try:
    tm = pd.read_csv(f"{C}/tau_over_mu_stats.csv")
    out["authors"]["tauOverMu"] = json.loads(tm.to_json(orient="records"))
except Exception as e:
    out["authors"]["tauOverMu"] = repr(e)
out["studies"] = {"count": int(len(studies)), "years": studies["dataset_year"].value_counts().to_dict() if "dataset_year" in studies else None,
                  "raceLevels": studies["race_level"].value_counts().to_dict() if "race_level" in studies else None}
out["featureLabels"] = {f: FEATURES[f] for f in feat_cols}

s3.put_object(Bucket=B, Key="model/reference-model.json", Body=json.dumps(out, indent=1, default=str).encode())
s3.put_object(Bucket=B, Key="model/ads.json", Body=json.dumps(ads_rows, default=str).encode())
print("done", {k: (v["ads"], v["meanEffect"], v["tau"], v["prediction"]["outOfSampleR2"]) for k, v in out["outcomes"].items()}, flush=True)
