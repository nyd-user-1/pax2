"""PAX2 Encoder, Phase 1: embed the corpus with stock bge-m3 through TEI, mine pairs, benchmark stock.

Pairs, for every training document (not held out, not paid) as the anchor:
  positives       its 3 nearest training documents from the same channel and the same tier, by cosine
  hard negatives  its 5 nearest training documents of a different tier, from any training channel
  random          2 training documents drawn at random (not the anchor, not a positive)
written as FlagEmbedding jsonl {"query","pos","neg"}, with the same pairs by id in pairs-ids.jsonl and as
44b train.py groups {"q","pos","negs","src"} for PAX2 Reranker. Anchors with no same-channel, same-tier
neighbor are skipped and counted. No held-out document appears anywhere; asserted, and the count written.
"""
import json, random
import numpy as np
from common import WORK, K, log, load_corpus, tei_start, tei_stop, tei_embed, topk, write_bench

docs, holdout = load_corpus()
texts = [d['text'] for d in docs]
log(f'corpus {len(docs)} documents: {sum(d["split"] == "train" for d in docs)} train, '
    f'{sum(d["split"] == "held" for d in docs)} held out, {sum(d["split"] == "paid" for d in docs)} paid')

tei_start('BAAI/bge-m3')
E = tei_embed(texts)
tei_stop()
np.save(f'{WORK}/embeddings-stock.npy', E.astype(np.float16))
json.dump([d['id'] for d in docs], open(f'{WORK}/ids.json', 'w'))

train = np.array([d['i'] for d in docs if d['split'] == 'train'])
held = np.array([d['i'] for d in docs if d['split'] == 'held'])

# ── mine ──────────────────────────────────────────────────────────────────────
import torch
dev = 'cuda' if torch.cuda.is_available() else 'cpu'
T = torch.from_numpy(E[train]).to(dev)
ch = np.array([docs[i]['channelId'] for i in train])
tier = np.array([docs[i]['tier'] for i in train])
_, ch_code = np.unique(ch, return_inverse=True)
_, tier_code = np.unique(tier, return_inverse=True)
CH = torch.from_numpy(ch_code).to(dev)
TI = torch.from_numpy(tier_code).to(dev)
rng = random.Random(20261017)
NEG_INF = torch.tensor(float('-inf'), device=dev)

n_pairs = skipped = few_pos = 0
held_ids = set(holdout['ids'])
held_seen = 0
fp = open(f'{WORK}/pairs.jsonl', 'w')
fi = open(f'{WORK}/pairs-ids.jsonl', 'w')
fg = open(f'{WORK}/train-groups.jsonl', 'w')
for s in range(0, len(train), 1024):
    rows = torch.arange(s, min(s + 1024, len(train)), device=dev)
    S = T[rows] @ T.T
    S[torch.arange(len(rows), device=dev), rows] = NEG_INF  # never the anchor itself
    same = (CH[rows][:, None] == CH[None, :]) & (TI[rows][:, None] == TI[None, :])
    Sp = torch.where(same, S, NEG_INF)
    pv, pi = torch.topk(Sp, 3, dim=1)
    Sn = torch.where(TI[rows][:, None] != TI[None, :], S, NEG_INF)
    nv, ni = torch.topk(Sn, 5, dim=1)
    pv, pi, nv, ni = pv.cpu().numpy(), pi.cpu().numpy(), nv.cpu().numpy(), ni.cpu().numpy()
    for r in range(len(rows)):
        a = train[s + r]
        pos = [train[j] for j, v in zip(pi[r], pv[r]) if np.isfinite(v)]
        if not pos:
            skipped += 1
            continue
        few_pos += len(pos) < 3
        neg = [train[j] for j, v in zip(ni[r], nv[r]) if np.isfinite(v)]
        taken = {a, *pos, *neg}
        while len(neg) < 7:
            j = train[rng.randrange(len(train))]
            if j not in taken:
                neg.append(j)
                taken.add(j)
        ids = [docs[x]['id'] for x in [a, *pos, *neg]]
        held_seen += sum(x in held_ids for x in ids)
        fp.write(json.dumps({'query': texts[a], 'pos': [texts[x] for x in pos], 'neg': [texts[x] for x in neg]},
                            ensure_ascii=False) + '\n')
        fi.write(json.dumps({'id': docs[a]['id'], 'pos': [docs[x]['id'] for x in pos],
                             'neg': [docs[x]['id'] for x in neg]}) + '\n')
        fg.write(json.dumps({'q': texts[a][:600], 'pos': texts[pos[0]][:900],
                             'negs': [texts[x][:900] for x in neg], 'src': 'pax2'}, ensure_ascii=False) + '\n')
        n_pairs += 1
for f in (fp, fi, fg):
    f.close()
assert held_seen == 0, f'{held_seen} held-out documents in the pairs'
stats = {'pairs': n_pairs, 'anchors': len(train), 'skippedNoPositive': skipped, 'fewerThan3Positives': few_pos,
         'negativesPerPair': 7, 'heldOutInPairs': held_seen, 'corpusRows': len(docs)}
json.dump(stats, open(f'{WORK}/pairs-stats.json', 'w'), indent=1)
log(f'pairs: {stats}')

# ── benchmark stock ───────────────────────────────────────────────────────────
nb = topk(E, held, train, K)
write_bench('stock', docs, list(held), [[train[j] for j in row] for row in nb], {'model': 'BAAI/bge-m3'})
