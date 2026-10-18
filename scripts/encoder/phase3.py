"""PAX2 Reranker, Phase 3 benchmark: for every held-out document, PAX2 Encoder's 50 nearest training
documents, re-scored by the trained cross-encoder (query = the held-out document's text to 600
characters, passage = the neighbor's to 900, as 44b train.py trained it), the top 20 kept, and the same
kNN-AUC recomputed.

Gate R, pre-registered: pooled kNN-AUC at least PAX2 Encoder's, within-channel not below.
"""
import json, os, sys, time
import numpy as np
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from common import WORK, K, log, load_corpus, topk, write_bench

MODEL = sys.argv[1]
POOL = 50
docs, _ = load_corpus()
train = np.array([d['i'] for d in docs if d['split'] == 'train'])
held = np.array([d['i'] for d in docs if d['split'] == 'held'])
src = 'pax2' if os.path.exists(f'{WORK}/embeddings-pax2.npy') else 'stock'
E = np.load(f'{WORK}/embeddings-{src}.npy').astype(np.float32)
log(f'candidates from embeddings-{src}.npy')
cand = topk(E, held, train, min(POOL, len(train)))

dev = 'cuda'
tok = AutoTokenizer.from_pretrained(MODEL)
model = AutoModelForSequenceClassification.from_pretrained(MODEL).to(dev).eval()
texts = [d['text'] for d in docs]
kept = []
t0 = time.time()
with torch.inference_mode():
    for n, (h, row) in enumerate(zip(held, cand)):
        c = [train[j] for j in row]
        enc = tok([texts[h][:600]] * len(c), [texts[j][:900] for j in c], padding=True, truncation=True,
                  max_length=256, return_tensors='pt').to(dev)
        with torch.amp.autocast('cuda', dtype=torch.bfloat16):
            s = model(**enc).logits.float().view(-1).cpu().numpy()
        kept.append([c[j] for j in np.argsort(-s, kind='stable')[:K]])
        if (n + 1) % 500 == 0:
            log(f'reranked {n + 1}/{len(held)} ({(n + 1) / (time.time() - t0):.1f}/s)')
log(f'reranked {len(held)} in {time.time() - t0:.0f}s')

enc_path = f'{WORK}/bench-encoder.json'
base = json.load(open(enc_path)) if os.path.exists(enc_path) else json.load(open(f'{WORK}/bench-stock.json'))
bench = write_bench('reranker', docs, list(held), kept,
                    {'model': 'PAX2 Reranker', 'candidates': f'top {POOL} by embeddings-{src}', 'baseArm': base['arm']})
ok = lambda v: v is not None
bench['gate'] = {
    'name': 'R',
    'rule': 'pooled kNN-AUC at least PAX2 Encoder\'s, within-channel kNN-AUC not below',
    'base': {'arm': base['arm'], 'pooled': base['pooled'], 'within': base['within']},
    'reranker': {'pooled': bench['pooled'], 'within': bench['within']},
    'pass': bool(ok(bench['pooled']) and ok(base['pooled']) and bench['pooled'] >= base['pooled']
                 and ok(bench['within']) and ok(base['within']) and bench['within'] >= base['within']),
}
json.dump(bench, open(f'{WORK}/bench-reranker.json', 'w'), indent=1)
log(f'GATE R {"PASS" if bench["gate"]["pass"] else "FAIL"}: {bench["gate"]}')
