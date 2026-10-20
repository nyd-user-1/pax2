"""How many shorts have a near-twin in the serving index (cosine at or above each threshold) — the ceiling
any semantic ID's uniqueness answers to, since twins should share an ID. Usage: python3 scripts/plum/dupes.py"""
import json, os
import numpy as np
SRC = os.path.join(os.path.dirname(__file__), '..', '..', 'data/plum')
E = np.load(f'{SRC}/embeddings.npy').astype(np.float32)
E /= np.linalg.norm(E, axis=1, keepdims=True)
best = np.empty(len(E), dtype=np.float32)
for s in range(0, len(E), 2048):
    S = E[s:s + 2048] @ E.T
    S[np.arange(len(S)), np.arange(s, s + len(S))] = -1
    best[s:s + len(S)] = S.max(1)
rows = json.load(open(f'{SRC}/rows.json'))
labels = [r['label'] for r in rows]
_, cnt = np.unique(labels, return_counts=True)
print(json.dumps({'n': len(E), 'nearestCos': {t: int((best >= t).sum()) for t in (0.999, 0.99, 0.98, 0.95, 0.9)},
                  'shortsSharingExactLabel': int(cnt[cnt > 1].sum()), 'medianNearestCos': float(np.median(best))}))
