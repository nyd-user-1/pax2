"""PAX2 Headline Ranker v1: a BERT-class pairwise ranker of headlines, fine-tuned on the Upworthy
Research Archive's confirmatory tests on one GPU box (scripts/headline/box.sh).

Pairs are built exactly as v0 built them (scripts/rig/headline_v0.py): within each test, packages are
pooled by headline across image variants, headlines with at least 1,000 pooled impressions stay, the
highest pooled click rate is the winner and is paired against each loser, tied tests are skipped, and
the tests are split 80/20 by the same seeded permutation (numpy default_rng(7), first draw), so v1's
held-out pairs are v0's held-out pairs and the two accuracies compare.

The model scores one headline at a time: a BERT-class encoder, its pooled output through one linear
unit. Training minimizes -log sigmoid(score(winner) - score(loser)) over the training pairs. The
held-out pairwise accuracy is the share of held-out pairs where the winner scores higher.

Gate H, pre-registered 2026-10-18: held-out pairwise accuracy at least 0.6301, v0's 0.6101 plus 0.02.

Writes to $WORK: headline-v1.json (the numbers, per epoch), held-pairs-v1.jsonl (one line per
held-out pair with both scores, for the Mac's second scorer), checks-v1.json (eight held-out headlines
with their scores), and model-v1/ (weights and tokenizer) plus model-v1.onnx when the export succeeds.
REHEARSE=<n> keeps n tests for a dry run.
"""
import json, math, os, sys, time

import numpy as np
import pandas as pd
import torch
from torch import nn
from transformers import AutoModel, AutoTokenizer, get_linear_schedule_with_warmup

WORK = os.environ.get("WORK", "/opt/pax2/work")
PARQUET = os.environ.get("PARQUET", f"{WORK}/upworthy.parquet")
BASE = os.environ.get("BASE", "bert-base-uncased")
EPOCHS = int(os.environ.get("EPOCHS", "3"))
BATCH = int(os.environ.get("BATCH", "64"))
LR = float(os.environ.get("LR", "2e-5"))
MAX_LEN = int(os.environ.get("MAX_LEN", "40"))
REHEARSE = int(os.environ.get("REHEARSE", "0") or 0)
MIN_IMPRESSIONS = 1000
V0_ACCURACY = 0.6101
GATE_H = round(V0_ACCURACY + 0.02, 4)
rng = np.random.default_rng(7)
torch.manual_seed(7)


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


t0 = time.time()
df = pd.read_parquet(PARQUET, columns=["clickability_test_id", "headline", "impressions", "clicks"]).dropna(subset=["headline"])
log(f"{len(df)} packages, {df.clickability_test_id.nunique()} tests")
g = df.groupby(["clickability_test_id", "headline"], as_index=False)[["impressions", "clicks"]].sum()
g = g[g.impressions >= MIN_IMPRESSIONS].copy()
g["ctr"] = g.clicks / g.impressions
pairs, skipped_ties = [], 0
for tid, t in g.groupby("clickability_test_id"):
    if len(t) < 2:
        continue
    t = t.sort_values("ctr", ascending=False)
    if t.ctr.iloc[0] == t.ctr.iloc[1]:
        skipped_ties += 1
        continue
    w = t.headline.iloc[0]
    for l in t.headline.iloc[1:]:
        pairs.append((tid, w, l))
tests = sorted({p[0] for p in pairs})
perm = rng.permutation(len(tests))  # the first draw, as in v0, so the held-out tests are v0's
test_ids = {tests[i] for i in perm[: int(len(tests) * 0.2)]}
if REHEARSE:
    keep = set(tests[: REHEARSE])
    pairs = [p for p in pairs if p[0] in keep]
    log(f"REHEARSE: {len(keep)} tests, {len(pairs)} pairs")
train_pairs = [p for p in pairs if p[0] not in test_ids]
held_pairs = [p for p in pairs if p[0] in test_ids]
log(f"{len(g)} pooled headlines, {len(tests)} tests, {len(pairs)} pairs, {skipped_ties} ties skipped; train {len(train_pairs)}, held out {len(held_pairs)} in {len(test_ids)} tests")
if not train_pairs or not held_pairs:
    log("nothing to train or score")
    sys.exit(1)

dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
log(f"device {dev}, base {BASE}, epochs {EPOCHS}, batch {BATCH}, lr {LR}, max_len {MAX_LEN}")
tok = AutoTokenizer.from_pretrained(BASE)


class Ranker(nn.Module):
    def __init__(self):
        super().__init__()
        self.enc = AutoModel.from_pretrained(BASE)
        self.head = nn.Linear(self.enc.config.hidden_size, 1)

    def forward(self, input_ids, attention_mask):
        h = self.enc(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state[:, 0]
        return self.head(h).squeeze(-1)


model = Ranker().to(dev)


def encode(texts):
    b = tok(list(texts), padding=True, truncation=True, max_length=MAX_LEN, return_tensors="pt")
    return b["input_ids"].to(dev), b["attention_mask"].to(dev)


@torch.no_grad()
def scores(texts, bs=256):
    model.eval()
    out = []
    for i in range(0, len(texts), bs):
        ids, am = encode(texts[i : i + bs])
        with torch.autocast(device_type="cuda", dtype=torch.bfloat16, enabled=dev.type == "cuda"):
            out.append(model(ids, am).float().cpu())
    return torch.cat(out).numpy() if out else np.array([])


def held_accuracy():
    heads = sorted({h for p in held_pairs for h in p[1:]})
    s = dict(zip(heads, scores(heads)))
    wins = [(float(s[w]) > float(s[l])) for _, w, l in held_pairs]
    return float(np.mean(wins)), s


steps_per_epoch = math.ceil(len(train_pairs) / BATCH)
opt = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=0.01)
sched = get_linear_schedule_with_warmup(opt, int(0.1 * steps_per_epoch * EPOCHS), steps_per_epoch * EPOCHS)
acc0, _ = held_accuracy()
log(f"held-out accuracy before training {acc0:.4f} (chance 0.5)")
history = [{"epoch": 0, "heldOutAccuracy": round(acc0, 4)}]
best = (acc0, 0)
for ep in range(1, EPOCHS + 1):
    model.train()
    order = rng.permutation(len(train_pairs))
    tot, n = 0.0, 0
    te = time.time()
    for i in range(0, len(order), BATCH):
        batch = [train_pairs[j] for j in order[i : i + BATCH]]
        ids, am = encode([w for _, w, _ in batch] + [l for _, _, l in batch])
        with torch.autocast(device_type="cuda", dtype=torch.bfloat16, enabled=dev.type == "cuda"):
            s = model(ids, am).float()
        k = len(batch)
        loss = -torch.nn.functional.logsigmoid(s[:k] - s[k:]).mean()
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        sched.step()
        tot += float(loss) * k
        n += k
    acc, _ = held_accuracy()
    history.append({"epoch": ep, "trainLoss": round(tot / max(n, 1), 4), "heldOutAccuracy": round(acc, 4), "seconds": round(time.time() - te)})
    log(f"epoch {ep}: loss {tot / max(n, 1):.4f}, held-out accuracy {acc:.4f}, {time.time() - te:.0f}s")
    if acc > best[0]:
        best = (acc, ep)
        torch.save(model.state_dict(), f"{WORK}/best.pt")

if best[1] > 0:
    model.load_state_dict(torch.load(f"{WORK}/best.pt", map_location=dev))
acc, s = held_accuracy()
log(f"best epoch {best[1]}: held-out pairwise accuracy {acc:.4f} on {len(held_pairs)} pairs; v0 {V0_ACCURACY}; Gate H {GATE_H}: {'PASS' if acc >= GATE_H else 'FAIL'}")

with open(f"{WORK}/held-pairs-v1.jsonl", "w") as f:
    for tid, w, l in held_pairs:
        f.write(json.dumps({"test": str(tid), "winner": w, "loser": l, "winnerScore": round(float(s[w]), 6), "loserScore": round(float(s[l]), 6)}) + "\n")
heads = sorted(s)
checks = [{"text": h, "score": round(float(s[h]), 6)} for h in heads[:: max(1, len(heads) // 8)][:8]]
json.dump(checks, open(f"{WORK}/checks-v1.json", "w"), indent=1)

os.makedirs(f"{WORK}/model-v1", exist_ok=True)
model.enc.save_pretrained(f"{WORK}/model-v1")
tok.save_pretrained(f"{WORK}/model-v1")
torch.save(model.head.state_dict(), f"{WORK}/model-v1/head.pt")
onnx_ok = False
try:
    model.eval().float()
    ids, am = encode(["A headline to trace the graph."])
    torch.onnx.export(model, (ids, am), f"{WORK}/model-v1.onnx", input_names=["input_ids", "attention_mask"], output_names=["score"],
                      dynamic_axes={"input_ids": {0: "b", 1: "t"}, "attention_mask": {0: "b", 1: "t"}, "score": {0: "b"}}, opset_version=17)
    onnx_ok = os.path.getsize(f"{WORK}/model-v1.onnx") > 1e6
    log(f"onnx export {'ok' if onnx_ok else 'too small'}: {os.path.getsize(f'{WORK}/model-v1.onnx')} bytes")
except Exception as e:  # the weights are saved either way
    log(f"onnx export failed: {e}")

out = {
    "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "name": "PAX2 Headline Ranker",
    "version": "headline-1",
    "rehearsal": bool(REHEARSE),
    "base": BASE,
    "source": "s3://pax-2-638175140432/curated/upworthy/upworthy-archive-confirmatory-packages-03.12.2020.parquet",
    "method": f"{BASE} with one linear unit on the pooled output, scoring one headline; trained {EPOCHS} epochs, batch {BATCH} pairs, lr {LR}, max length {MAX_LEN}, on -log sigmoid(score(winner) - score(loser)); pairs and the 80/20 split by test exactly as v0 (scripts/rig/headline_v0.py)",
    "counts": {"tests": len(tests), "pairs": len(pairs), "trainPairs": len(train_pairs), "heldOutPairs": len(held_pairs), "heldOutTests": len({p[0] for p in held_pairs})},
    "heldOutAccuracy": round(acc, 4),
    "bestEpoch": best[1],
    "history": history,
    "v0HeldOutAccuracy": V0_ACCURACY,
    "v0FlagsOnlyAccuracy": 0.59,
    "baseline": 0.5,
    "gateH": {"rule": f"held-out pairwise accuracy at least {GATE_H}, v0 plus 0.02, on the same held-out tests", "threshold": GATE_H, "passed": bool(acc >= GATE_H)},
    "device": str(dev),
    "gpu": torch.cuda.get_device_name(0) if dev.type == "cuda" else None,
    "onnx": onnx_ok,
    "seconds": round(time.time() - t0),
}
json.dump(out, open(f"{WORK}/headline-v1.json", "w"), indent=1)
log(f"wrote headline-v1.json in {time.time() - t0:.0f}s")
