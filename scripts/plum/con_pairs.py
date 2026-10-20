"""The resonance encoder's co-occurrence term, box side (PLUM, arXiv 2510.07784 eq. 1: pull behavioral
neighbors together, push the batch apart).

FlagEmbedding's loss is InfoNCE over each group (1 positive, 7 negatives) and the batch. Appending
co-occurrence groups to Phase 1's semantic groups makes the objective L = L_sem + lambda * L_con with
lambda = con groups / semantic groups, both terms the same InfoNCE; lambda stays at or under 0.25 so the
semantic objective dominates.

  arm "behavior"  anchors: every training short with a co-outlier neighbor or a co-surge neighbor whose two
                  crossings the poller measured (co-occurrence.json lists a and bm)
  arm "full"      the behavior anchors, plus anchors with only a publish-week co-surge neighbor (list b)
                  sampled to bring the arm to lambda = 0.25; the two arms differ by the proxy alone

Each group: query = the anchor's text, pos = up to 3 neighbors (a first, then bm, then b), neg = 7 random
training documents that are not the anchor and not among its neighbors. Both ends of every group are
training documents; held-out documents are asserted absent.

Usage (on the box, after phase1.py): python3 con_pairs.py <arm>
Reads  $WORK/pairs.jsonl, $WORK/corpus.jsonl, $WORK/holdout.json, $CODE/co-occurrence.json
Writes $WORK/pairs-<arm>.jsonl (semantic + co-occurrence groups), $WORK/con-<arm>.json (counts)
"""
import json, os, random, sys
from common import WORK, log, load_corpus

ARM = sys.argv[1]
assert ARM in ('behavior', 'full'), ARM
LAMBDA = 0.25
CODE = os.path.dirname(os.path.abspath(__file__))

docs, holdout = load_corpus()
held = set(holdout['ids'])
train = {d['id']: d for d in docs if d['split'] == 'train'}
train_ids = sorted(train)
co = json.load(open(f'{CODE}/co-occurrence.json'))['neighbors']
n_sem = sum(1 for l in open(f'{WORK}/pairs.jsonl') if l.strip())

def nb(e, keys):
    out = []
    for k in keys:
        for x in e.get(k, []):
            if x in train and x not in out:
                out.append(x)
    return out

narrow, proxy_only = [], []
for a in sorted(co):
    if a not in train:
        continue
    e = co[a]
    if nb(e, ('a', 'bm')):
        narrow.append(a)
    elif nb(e, ('b',)):
        proxy_only.append(a)
rng = random.Random(20261020)
cap = int(LAMBDA * n_sem)
anchors = list(narrow[:cap])
if ARM == 'full' and len(anchors) < cap:
    anchors += rng.sample(proxy_only, min(cap - len(anchors), len(proxy_only)))
keys = ('a', 'bm') if ARM == 'behavior' else ('a', 'bm', 'b')

src = {'a': 0, 'bm': 0, 'b': 0}
held_seen = 0
with open(f'{WORK}/pairs-{ARM}.jsonl', 'w') as f:
    for l in open(f'{WORK}/pairs.jsonl'):
        if l.strip():
            f.write(l if l.endswith('\n') else l + '\n')
    for a in anchors:
        e = co[a]
        pos = nb(e, keys)[:3]
        for x in pos:
            src[next(k for k in keys if x in e.get(k, []))] += 1
        taken = {a, *nb(e, ('a', 'bm', 'b'))}
        neg = []
        while len(neg) < 7:
            x = train_ids[rng.randrange(len(train_ids))]
            if x not in taken:
                neg.append(x)
                taken.add(x)
        held_seen += sum(x in held for x in [a, *pos, *neg])
        f.write(json.dumps({'query': train[a]['text'], 'pos': [train[x]['text'] for x in pos],
                            'neg': [train[x]['text'] for x in neg]}, ensure_ascii=False) + '\n')
assert held_seen == 0, f'{held_seen} held-out documents in the co-occurrence groups'
stats = {'arm': ARM, 'semanticGroups': n_sem, 'conGroups': len(anchors), 'lambda': round(len(anchors) / n_sem, 4),
         'narrowAnchorsAvailable': len(narrow), 'proxyOnlyAnchorsAvailable': len(proxy_only),
         'positivesBySignal': src, 'heldOutInGroups': held_seen}
json.dump(stats, open(f'{WORK}/con-{ARM}.json', 'w'), indent=1)
log(f'con pairs {ARM}: {stats}')
