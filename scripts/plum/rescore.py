"""The resonance run's Mac rescore: a second implementation of the kNN-AUC (rig rule 25), independent of
scripts/encoder/common.py — AUC by direct pair counting, not rank sums — on the box's uploaded neighbor
lists, against the pinned corpus and holdout of run 20261019-094112-train. Requires agreement with each
box bench to three decimals and checks every listed neighbor is a training document.

scripts/encoder/rescore.mjs does the same for the encoder's own runs but reads encoder/corpus.jsonl, which
corpus rebuilds overwrite; this reads data/plum/corpus.jsonl (aws s3 cp s3://nsr-embed-v2/pax2/plum/corpus/).

Usage: python3 scripts/plum/rescore.py <run dir holding bench-*.json and neighbors-*.json> <arm> [<arm> ...]
"""
import json, os, sys
import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')


def auc_pairs(y, s):
    y, s = np.asarray(y), np.asarray(s, dtype=float)
    p, n = s[y == 1], s[y == 0]
    if not len(p) or not len(n):
        return None
    gt = (p[:, None] > n[None, :]).sum()
    eq = (p[:, None] == n[None, :]).sum()
    return float((gt + 0.5 * eq) / (len(p) * len(n)))


def main(d, arms):
    corpus = {}
    for l in open(f'{ROOT}/data/plum/corpus.jsonl'):
        if l.strip():
            x = json.loads(l)
            corpus[x['id']] = x
    held = set(json.load(open(f'{ROOT}/data/generated/model/plum/holdout.json'))['ids'])
    out = {}
    for arm in arms:
        nb = json.load(open(f'{d}/neighbors-{arm}.json'))['rows']
        bench = json.load(open(f'{d}/bench-{arm}.json'))
        bad = sum(1 for r in nb for x in r['nbrs'] if x in held or corpus[x]['group'] == 'paid-ad')
        ids = [r['id'] for r in nb]
        assert set(ids) == held & {k for k, v in corpus.items() if v['group'] != 'paid-ad'}, 'held-out set differs'
        y = np.array([corpus[i]['breakout'] for i in ids])
        s = np.array([np.mean([corpus[x]['breakout'] for x in r['nbrs']]) for r in nb])
        pooled = auc_pairs(y, s)
        ch = {}
        for k, i in enumerate(ids):
            ch.setdefault(corpus[i]['channelId'], []).append(k)
        num = den = 0
        for ks in ch.values():
            a = auc_pairs(y[ks], s[ks])
            if a is not None:
                num += a * len(ks); den += len(ks)
        within = num / den
        agree = abs(pooled - bench['pooled']) < 5e-4 and abs(within - bench['within']) < 5e-4
        out[arm] = {'macPooled': round(pooled, 4), 'boxPooled': round(bench['pooled'], 4), 'macWithin': round(within, 4),
                    'boxWithin': round(bench['within'], 4), 'agree3dp': agree, 'nonTrainingNeighbors': bad, 'n': len(ids)}
    print(json.dumps(out, indent=1))
    return out


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2:])
