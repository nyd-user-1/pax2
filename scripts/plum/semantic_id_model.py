"""PLUM, Part 1b: the baseline PLUM model — the semantic-ID quantizer turned into a predictor.

Codebooks: the residual k-means of semantic_ids.py, fit on the training documents' serving-index
embeddings only (corpus split 'train': not held out, not paid); held-out documents are assigned to the
nearest centroid level by level, so no held-out vector shapes a codebook.

Score: a held-out document's score is the outlier share of the training documents sharing its (c1, c2)
cell; when that cell holds fewer than MIN_CELL training documents it backs off to the c1 cell. Benchmark:
scripts/encoder/common.py's summarize() on the same held-out documents (data/generated/model/plum/
holdout.json, the holdout run 20261019-094112-train was judged on), pooled AUC and count-weighted
within-channel AUC — the Gate E rows' protocol with the cell share in place of the 20-neighbor share.

Attempt 2 (--smooth 20, fixed before it ran): every c1c2 share shrunk toward its c1 share with 20
pseudo-documents, (outliers + 20 * c1 share) / (n + 20), in place of the hard backoff.

Gate S, pre-registered by the brief before this ran: pooled AUC above stock bge-m3's 0.5775. One more
measured attempt is allowed on a fail (codebook size from the sweep, backoff rule), same bar.

Usage: python3 scripts/plum/semantic_id_model.py [--sizes 40,64,64] [--min-cell 20] [--tag attempt1]
Reads  data/plum/{embeddings.npy, rows.json}, data/generated/model/encoder/runs/... none; corpus labels
       from data/plum/rows.json (breakout, channelId, family per index row)
Writes data/generated/model/semantic-id-model.json (with --write)
"""
import argparse, json, os, sys, time
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
sys.path.insert(0, os.path.join(ROOT, 'scripts/encoder'))
sys.path.insert(0, HERE)
from common import summarize  # noqa: E402
from semantic_ids import kmeans  # noqa: E402

SEED = 20261020
STOCK_POOLED = 0.5775310209691764  # run 20261019-094112-train, bench-stock.json


def assign(X, C):
    return ((X * X).sum(1)[:, None] - 2 * X @ C.T + (C * C).sum(1)[None, :]).argmin(1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sizes', default='40,64,64')
    ap.add_argument('--min-cell', type=int, default=20)
    ap.add_argument('--tag', default='attempt1')
    ap.add_argument('--smooth', type=float, default=0, help='shrink each c1c2 share toward its c1 share with this many pseudo-documents, in place of the hard backoff')
    ap.add_argument('--write', action='store_true')
    a = ap.parse_args()
    sizes = [int(s) for s in a.sizes.split(',')]
    rows = json.load(open(f'{ROOT}/data/plum/rows.json'))
    E = np.load(f'{ROOT}/data/plum/embeddings.npy').astype(np.float32)
    E /= np.linalg.norm(E, axis=1, keepdims=True)
    held_ids = set(json.load(open(f'{ROOT}/data/generated/model/plum/holdout.json'))['ids'])
    docs = [{'i': i, 'id': r['id'], 'channelId': r['channelId'], 'family': r['family'], 'breakout': r['breakout'],
             'split': 'paid' if r['breakout'] is None else ('held' if r['id'] in held_ids else 'train')}
            for i, r in enumerate(rows)]
    train = np.array([d['i'] for d in docs if d['split'] == 'train'])
    held = np.array([d['i'] for d in docs if d['split'] == 'held'])
    assert len(held) == len(held_ids), (len(held), len(held_ids))

    rng = np.random.default_rng(SEED)
    R = E[train].copy()
    Rh = E[held].copy()
    ct, ch = [], []
    for k in sizes:
        C, lab, _, _ = kmeans(R, k, rng)
        lh = assign(Rh, C)
        R -= C[lab]
        Rh -= C[lh]
        ct.append(lab)
        ch.append(lh)
    ct, ch = np.stack(ct, 1), np.stack(ch, 1)
    y = np.array([docs[i]['breakout'] for i in train], dtype=float)

    def cells(codes, depth):
        key = codes[:, 0].astype(np.int64)
        for l in range(1, depth):
            key = key * sizes[l] + codes[:, l]
        return key

    stats = {}
    for depth in (1, 2):
        kt = cells(ct, depth)
        u, inv = np.unique(kt, return_inverse=True)
        stats[depth] = dict(zip(u.tolist(), zip(np.bincount(inv).tolist(), np.bincount(inv, weights=y).tolist())))
    k1, k2 = cells(ch, 1), cells(ch, 2)
    scores, used = [], {'c1c2': 0, 'c1': 0, 'base': 0}
    base = float(y.mean())
    for a1, a2 in zip(k1.tolist(), k2.tolist()):
        n2, s2 = stats[2].get(a2, (0, 0))
        if a.smooth > 0:
            n1, s1 = stats[1].get(a1, (0, 0))
            p1 = s1 / n1 if n1 else base
            scores.append((s2 + a.smooth * p1) / (n2 + a.smooth)); used['c1c2' if n2 else 'c1'] += 1
            continue
        if n2 >= a.min_cell:
            scores.append(s2 / n2); used['c1c2'] += 1
            continue
        n1, s1 = stats[1].get(a1, (0, 0))
        if n1 > 0:
            scores.append(s1 / n1); used['c1'] += 1
        else:
            scores.append(base); used['base'] += 1
    res = summarize(docs, list(held), np.array(scores))
    gate = {'name': 'S', 'rule': 'pooled AUC on the held-out channels above stock bge-m3 kNN-AUC 0.5775',
            'stockPooled': STOCK_POOLED, 'pooled': res['pooled'], 'pooledDelta': res['pooled'] - STOCK_POOLED,
            'pass': bool(res['pooled'] > STOCK_POOLED)}
    out = {
        'name': 'PAX2 Semantic-ID Model (PLUM baseline)',
        'builtAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'tag': a.tag, 'sizes': sizes, 'minCell': a.min_cell, 'smooth': a.smooth, 'seed': SEED,
        'index': 'serving index 20261019-094112-train (PAX2 Encoder)',
        'method': __doc__.strip().split('\n\n')[1].replace('\n', ' ') + ' ' + __doc__.strip().split('\n\n')[2].replace('\n', ' '),
        'trainingDocs': int(len(train)), 'heldOutDocs': int(len(held)), 'scoredBy': used, 'trainBaseRate': round(base, 4),
        'gate': gate,
        'bench': {k: res[k] for k in ('n', 'breakouts', 'pooled', 'within', 'withinUnweighted', 'withinChannels', 'perChannel', 'perFamily')},
        'cells': {'c1': {str(k): {'n': n, 'outlierShare': round(s / n, 4)} for k, (n, s) in stats[1].items()},
                  'c1c2': {str(k): {'n': n, 'outlierShare': round(s / n, 4)} for k, (n, s) in stats[2].items() if a.smooth > 0 or n >= a.min_cell}},
        'codebooksNote': 'centroids are not stored; the cell table plus semantic_ids.py reproduce the model from the index and seed',
    }
    print(json.dumps({'tag': a.tag, 'sizes': sizes, 'minCell': a.min_cell, 'scoredBy': used, 'pooled': round(res['pooled'], 4),
                      'within': round(res['within'], 4), 'gateS': gate['pass'], 'delta': round(gate['pooledDelta'], 4)}))
    if a.write:
        json.dump(out, open(f'{ROOT}/data/generated/model/semantic-id-model.json', 'w'), indent=1)


if __name__ == '__main__':
    main()
