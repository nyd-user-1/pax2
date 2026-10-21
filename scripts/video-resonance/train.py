"""PAX2 Video Resonance, box side (window MM-B): a projection head trained on frozen stock VideoPrism
embeddings with the resonance recipe, then scored.

Head: Linear(d, hidden) -> GELU -> Linear(hidden, 512), output L2-normalized; d is the stock dimension.
Loss: InfoNCE at temperature 0.02 per term, L = L_sem + lambda * L_con, lambda 0.144 — the text recipe's
shape (FlagEmbedding's single InfoNCE over semantic plus co-occurrence groups, weighted by their ratio),
written as an explicit weight so the group counts do not move it. Each step draws a batch of semantic
groups and a batch of behavioral groups; each group contributes its anchor, one positive drawn at random
from its positives, and its 7 negatives; every passage in the batch is a candidate (in-batch negatives),
as FlagEmbedding scores them. Query and passage share the head.

Semantic groups (the preserving term), mined here on the stock embedding, the text recipe's phase1.py
rule restricted to the train split of groups.json: positives = the 3 nearest train shorts of the same
channel and tier; hard negatives = the 5 nearest train shorts of a different tier, any train channel;
2 random train shorts. Anchors with no same-channel, same-tier neighbor are skipped and counted.

Scoring, every arm (stock, rung 0 when given, each trained head):
  M1     MM-A's Gate M1 protocol: PCA-32 fit on the videos of the training pairs (every non-held pair),
         components standardized by their mean and spread over those pairs' shorts, Bradley-Terry
         logistic on winner-minus-loser differences, no intercept, L2 0.001, 600 steps of gradient
         descent at 0.5 (scripts/pairwise/train.mjs, unchanged); accuracy on the 590 held-out pairs with a
         channel-block bootstrap 95% interval (2,000 draws, seed 20261020); a tie counts half
  5x/10x the same held-out read on the pairs whose winner reached 5x / 10x, subset sizes stated
  val    the same protocol fit on train-split pairs only, read on the validation-channel pairs; the only
         number variant selection may use
  gateB  the Gate B analog on held-out media shorts (scripts/plum/gate_b.py's rule: outlier vs non-outlier
         within 45 days, mean cosine to the 5 most similar prior outliers of the channel, at least 3)

Usage: python3 train.py --groups groups.json --stock base.jsonl [--rung0 clip.jsonl] --variants variants.json
       --names v1[,v2] --out DIR [--slice 20] [--standin 768]
"""
import argparse, json, math, os, random, time
from datetime import datetime
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

SEED = 20261020
TEMP = 0.02
PCA_K = 32
BT_L2, BT_ITERS, BT_LR = 1e-3, 600, 0.5
BOOT = 2000
WINDOW = 45 * 86400


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def load_jsonl(p):
    out = {}
    for l in open(p):
        if l.strip():
            r = json.loads(l)
            out[r['id']] = np.asarray(r['vector'], dtype=np.float32)
    return out


def l2n(X):
    return X / np.maximum(np.linalg.norm(X, axis=1, keepdims=True), 1e-12)


# ── scoring ──────────────────────────────────────────────────────────────────
def bt_fit(D):
    w = np.zeros(D.shape[1])
    for _ in range(BT_ITERS):
        p = 1 / (1 + np.exp(-(D @ w)))
        g = ((p - 1)[:, None] * D).mean(0)
        w -= BT_LR * (g + 2 * BT_L2 * w)
    return w


def m1_read(E, fit_pairs, read_pairs, pca_ids=None):
    """gate_m1.py's rule exactly: PCA on the distinct embedded videos of the fit pairs, components standardized
    over the embedded sides of the fit pairs, a pair's difference 0 unless both sides are embedded."""
    fit_ids = sorted(pca_ids) if pca_ids is not None else sorted({x for p in fit_pairs for x in (p['winner'], p['loser']) if x in E})
    X = np.stack([E[i] for i in fit_ids]).astype(np.float64)
    mu = X.mean(0)
    _, _, Vt = np.linalg.svd(X - mu, full_matrices=False)
    V = Vt[:PCA_K].T
    proj = {i: (v.astype(np.float64) - mu) @ V for i, v in E.items()}
    side = np.stack([proj[x] for p in fit_pairs for x in (p['winner'], p['loser']) if x in proj])
    cs = np.sqrt(np.maximum(side.var(0), 1e-12))
    def diff(p):
        a, b = proj.get(p['winner']), proj.get(p['loser'])
        return np.zeros(PCA_K) if a is None or b is None else (a - b) / cs
    w = bt_fit(np.stack([diff(p) for p in fit_pairs]))
    z = np.array([diff(p) @ w for p in read_pairs]) if read_pairs else np.zeros(0)
    return z, {'trainAccuracy': float(np.mean(correct(np.array([diff(p) @ w for p in fit_pairs]))))}


def correct(z):
    return np.where(z > 0, 1.0, np.where(z == 0, 0.5, 0.0))


def block_ci(c, chans, seed=SEED):
    if not len(c):
        return None
    u = sorted(set(chans))
    idx = {ch: np.where(np.array(chans) == ch)[0] for ch in u}
    rng = np.random.default_rng(seed)
    boots = []
    for _ in range(BOOT):
        pick = rng.integers(len(u), size=len(u))
        m = np.concatenate([idx[u[k]] for k in pick])
        boots.append(c[m].mean())
    lo, hi = np.percentile(boots, [2.5, 97.5])
    return [round(float(lo), 4), round(float(hi), 4)]


def gate_b(E, shorts):
    ts = lambda s: datetime.strptime(s[:19], '%Y-%m-%dT%H:%M:%S').timestamp()
    by = {}
    for s in shorts:
        if s['split'] == 'held' and s['id'] in E:
            by.setdefault(s['channelId'], []).append((ts(s['published']), s['id'], s['breakout']))
    rng = np.random.default_rng(SEED)
    pairs = []
    for ch in sorted(by):
        v = sorted(by[ch])
        cand = []
        for i in range(len(v)):
            for j in range(i + 1, len(v)):
                if v[j][0] - v[i][0] > WINDOW:
                    break
                if v[i][2] == v[j][2]:
                    continue
                ex = [x for t, x, b in v if b == 1 and t < v[i][0]]
                if len(ex) < 3:
                    continue
                o, n = (v[i], v[j]) if v[i][2] == 1 else (v[j], v[i])
                cand.append((ch, o[1], n[1], ex))
        if len(cand) > 4000:
            cand = [cand[k] for k in sorted(rng.choice(len(cand), 4000, replace=False))]
        pairs.extend(cand)
    return pairs


def gate_b_scores(E, gpairs):
    out = []
    for ch, o, n, ex in gpairs:
        X = np.stack([E[x] for x in ex])
        so = float(np.sort(X @ E[o])[-5:].mean())
        sn = float(np.sort(X @ E[n])[-5:].mean())
        out.append((so, sn))
    return out


def score_arm(name, E, G, gpairs):
    P = G['m1Pairs']
    fit_all = [p for p in P if p['split'] != 'held']
    held = [p for p in P if p['split'] == 'held']
    z, info = m1_read(E, fit_all, held)
    c = correct(z)
    chans = [p['channelId'] for p in held]
    res = {'m1': {'heldOutPairs': len(held), 'accuracy': round(float(c.mean()), 4) if len(c) else None, 'ci95': block_ci(c, chans),
                  'fitPairs': len(fit_all), **info}}
    for k in (5, 10):
        m = np.array([p['winnerRatio'] >= k for p in held])
        res[f'outperformed{k}x'] = {'pairs': int(m.sum()), 'accuracy': round(float(c[m].mean()), 4) if m.any() else None,
                                    'ci95': block_ci(c[m], [ch for ch, mm in zip(chans, m) if mm]) if m.any() else None}
    tr = [p for p in P if p['split'] == 'train']
    va = [p for p in P if p['split'] == 'val']
    zv, _ = m1_read(E, tr, va)
    res['val'] = {'pairs': len(va), 'fitPairs': len(tr), 'accuracy': round(float(correct(zv).mean()), 4) if len(va) else None}
    gs = gate_b_scores(E, gpairs)
    gc = np.array([1.0 if a > b else 0.5 if a == b else 0.0 for a, b in gs])
    res['gateB'] = {'pairs': len(gpairs), 'channels': len({g[0] for g in gpairs}),
                    'pooled': round(float(gc.mean()), 4) if len(gc) else None}
    preds = [{'arm': name, 'bench': 'm1', 'split': 'held', 'winner': p['winner'], 'loser': p['loser'], 'channelId': p['channelId'],
              'winnerRatio': p['winnerRatio'], 'z': float(zz)} for p, zz in zip(held, z)]
    preds += [{'arm': name, 'bench': 'm1', 'split': 'val', 'winner': p['winner'], 'loser': p['loser'], 'channelId': p['channelId'],
               'winnerRatio': p['winnerRatio'], 'z': float(zz)} for p, zz in zip(va, zv)]
    preds += [{'arm': name, 'bench': 'gateB', 'split': 'held', 'winner': g[1], 'loser': g[2], 'channelId': g[0], 'so': a, 'sn': b}
              for g, (a, b) in zip(gpairs, gs)]
    log(name, json.dumps({k: (v.get('accuracy', v.get('pooled')) if isinstance(v, dict) else v) for k, v in res.items()}))
    return res, preds, gc


# ── training ─────────────────────────────────────────────────────────────────
class Head(nn.Module):
    def __init__(self, d, hidden, out=512):
        super().__init__()
        self.f = nn.Sequential(nn.Linear(d, hidden), nn.GELU(), nn.Linear(hidden, out))

    def forward(self, x):
        return F.normalize(self.f(x), dim=-1)


def mine_semantic(E, G):
    tr = [s for s in G['shorts'] if s['split'] == 'train' and s['id'] in E]
    ids = [s['id'] for s in tr]
    X = l2n(np.stack([E[i] for i in ids]))
    ch = np.array([s['channelId'] for s in tr])
    ti = np.array([s['tier'] for s in tr])
    S = X @ X.T
    np.fill_diagonal(S, -np.inf)
    rng = random.Random(20261017)
    groups, skipped, few = [], 0, 0
    for a in range(len(ids)):
        same = (ch == ch[a]) & (ti == ti[a])
        same[a] = False
        cand = np.where(same)[0]
        if not len(cand):
            skipped += 1
            continue
        pos = cand[np.argsort(-S[a, cand])[:3]].tolist()
        few += len(pos) < 3
        other = np.where(ti != ti[a])[0]
        neg = other[np.argsort(-S[a, other])[:5]].tolist()
        taken = {a, *pos, *neg}
        while len(neg) < 7:
            j = rng.randrange(len(ids))
            if j not in taken:
                neg.append(j)
                taken.add(j)
        groups.append({'anchor': ids[a], 'pos': [ids[j] for j in pos], 'neg': [ids[j] for j in neg]})
    return groups, {'groups': len(groups), 'anchors': len(ids), 'skippedNoPositive': skipped, 'fewerThan3Positives': few}


def batches(groups, bs, rng):
    while True:
        order = list(range(len(groups)))
        rng.shuffle(order)
        for k in range(0, len(order) - bs + 1, bs):
            yield [groups[i] for i in order[k:k + bs]]


def infonce(head, X, idx, batch, rng):
    q = torch.tensor([idx[g['anchor']] for g in batch])
    psg = []
    for g in batch:
        psg.append(idx[g['pos'][rng.randrange(len(g['pos']))]])
        psg += [idx[x] for x in g['neg']]
    Q = head(X[q])
    P = head(X[torch.tensor(psg)])
    logits = Q @ P.T / TEMP
    target = torch.arange(len(batch)) * 8
    return F.cross_entropy(logits, target)


def train_head(E, sem, beh, cfg, log_rows):
    torch.manual_seed(cfg['seed'])
    rng = random.Random(cfg['seed'])
    ids = sorted(E)
    idx = {x: i for i, x in enumerate(ids)}
    X = torch.tensor(np.stack([E[i] for i in ids]))
    d = X.shape[1]
    head = Head(d, cfg['hidden'] if cfg['hidden'] != 'd' else d)
    opt = torch.optim.AdamW(head.parameters(), lr=cfg['lr'], weight_decay=cfg['weightDecay'])
    bs = cfg['batch']
    steps_per_epoch = max(1, len(sem) // bs)
    total = steps_per_epoch * cfg['epochs']
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1.0, (s + 1) / max(1, total // 10)) * 0.5 * (1 + math.cos(math.pi * min(s, total) / total)))
    sem_it = batches(sem, bs, rng)
    beh_it = batches(beh, min(bs, len(beh)), rng) if beh and cfg['lambda'] > 0 else None
    for step in range(total):
        ls = infonce(head, X, idx, next(sem_it), rng)
        lc = infonce(head, X, idx, next(beh_it), rng) if beh_it else torch.tensor(0.0)
        loss = ls + cfg['lambda'] * lc
        opt.zero_grad()
        loss.backward()
        opt.step()
        sched.step()
        if step % steps_per_epoch == 0 or step == total - 1:
            log_rows.append({'step': step, 'epoch': step // steps_per_epoch, 'lsem': round(ls.item(), 4), 'lcon': round(lc.item(), 4)})
            log(cfg['name'], log_rows[-1])
    head.eval()
    with torch.no_grad():
        Y = head(X).numpy()
    return head, {x: Y[i] for i, x in enumerate(ids)}, {'steps': total, 'stepsPerEpoch': steps_per_epoch, 'inputDim': d}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--groups', required=True)
    ap.add_argument('--stock', default=None)
    ap.add_argument('--rung0', default=None)
    ap.add_argument('--variants', required=True)
    ap.add_argument('--names', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--slice', type=int, default=0, help='keep 1 in N shorts (rehearsal)')
    ap.add_argument('--blind', default=None, help='label-blind sample, {id, vector} jsonl in the stock space')
    ap.add_argument('--splits', default=None, help='catalog-splits.json: id -> [channelId, split, breakout]')
    ap.add_argument('--standin', type=int, default=0, help='seeded random vectors of this dimension in place of --stock (plumbing rehearsal)')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    G = json.load(open(a.groups))
    V = {v['name']: v for v in json.load(open(a.variants))['variants']}
    names = a.names.split(',')

    if a.standin:
        r = np.random.default_rng(SEED)
        allids = sorted({s['id'] for s in G['shorts']} | {x for p in G['m1Pairs'] for x in (p['winner'], p['loser'])})
        stock = {x: v for x, v in zip(allids, r.standard_normal((len(allids), a.standin)).astype(np.float32))}
    else:
        stock = load_jsonl(a.stock)
    if a.slice:
        keep = {x for x in stock if (int.from_bytes(x.encode(), 'little') % a.slice) == 0}
        keep |= {x for k, p in enumerate(G['m1Pairs']) if k % a.slice == 0 for x in (p['winner'], p['loser'])}
        G['shorts'] = [s for s in G['shorts'] if s['id'] in keep]
        G['m1Pairs'] = [p for p in G['m1Pairs'] if p['winner'] in keep and p['loser'] in keep]
        stock = {x: v for x, v in stock.items() if x in keep}
    X = l2n(np.stack(list(stock.values())))
    stock = dict(zip(stock.keys(), X))
    need = {x for p in G['m1Pairs'] for x in (p['winner'], p['loser'])}
    missing = sorted(need - set(stock))
    log(f'stock {len(stock)} vectors dim {X.shape[1]}; M1 pair videos missing {len(missing)}')
    beh = [g for g in G['groups'] if g['anchor'] in stock and all(x in stock for x in g['pos'] + g['neg'])]
    if a.slice:
        # a slice keeps a group whose anchor and a positive survive, refilling negatives from the sliced train set
        tr_ids = sorted(s['id'] for s in G['shorts'] if s['split'] == 'train')
        r = random.Random(SEED)
        beh = []
        for g in G['groups']:
            pos = [x for x in g['pos'] if x in stock]
            if g['anchor'] not in stock or not pos:
                continue
            neg = [x for x in g['neg'] if x in stock]
            taken = {g['anchor'], *g['pos'], *neg}
            while len(neg) < 7:
                x = tr_ids[r.randrange(len(tr_ids))]
                if x not in taken:
                    neg.append(x)
                    taken.add(x)
            beh.append({'anchor': g['anchor'], 'pos': pos, 'neg': neg})
    sem, sem_stats = mine_semantic(stock, G)
    held_ids = {s['id'] for s in G['shorts'] if s['split'] != 'train'}
    held_in = sum(x in held_ids for g in sem + beh for x in [g['anchor'], *g['pos'], *g['neg']])
    assert held_in == 0, f'{held_in} held-out or validation ids in training groups'
    json.dump(sem, open(f'{a.out}/semantic-groups.json', 'w'))
    log(f'semantic {sem_stats}; behavioral {len(beh)}; held-out/val ids in groups {held_in}')

    blind, pool, blind_info = {}, [], None
    if a.blind:
        sp = json.load(open(a.splits))
        b = load_jsonl(a.blind)
        b = dict(zip(b.keys(), l2n(np.stack(list(b.values())))))
        blind = {x: v for x, v in b.items() if x not in stock}
        placed = {x: sp[x] for x in b if x in sp}
        pool = sorted(x for x, m in placed.items() if m[1] == 'train')
        blind_info = {'vectors': len(b), 'alreadyInMediaSet': len(b) - len(blind), 'inTrainingSet': len(placed),
                      'bySplit': {k: sum(m[1] == k for m in placed.values()) for k in ('train', 'val', 'held')},
                      'pool': len(pool), 'poolOutlierShare': round(float(np.mean([placed[x][2] == 1 for x in pool])), 4) if pool else None}
        log(f'blind {blind_info}')
    gpairs = gate_b(stock, G['shorts'])
    bench = {'builtAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'slice': a.slice, 'standin': a.standin,
             'stockDim': int(X.shape[1]), 'm1PairVideosMissing': len(missing),
             'groups': {'semantic': sem_stats, 'behavioral': len(beh), 'heldOutOrValIdsInGroups': held_in},
             'blind': blind_info,
             'protocol': __doc__.strip().split('\n\n')[3].replace('\n', ' '), 'arms': {}}
    preds = []
    corr = {}
    res, p, corr['stock'] = score_arm('stock', stock, G, gpairs)
    bench['arms']['stock'] = res
    preds += p
    if a.blind:
        sp = json.load(open(a.splits))
        pca_ids = [x for x in b if x in sp and sp[x][1] != 'held']
        P = G['m1Pairs']
        held = [p for p in P if p['split'] == 'held']
        zb, _ = m1_read(stock_all := {**stock, **blind}, [p for p in P if p['split'] != 'held'], held, pca_ids=pca_ids)
        cb = correct(zb)
        bench['benchBias'] = {'rule': 'stock base M1 with PCA-32 refit on the label-blind sample videos off the held-out channels; standardization, Bradley-Terry fit and the 590-pair read unchanged; reported, not gated',
                              'pcaVideos': len(pca_ids), 'accuracy': round(float(cb.mean()), 4), 'ci95': block_ci(cb, [p['channelId'] for p in held])}
        preds += [{'arm': 'stock-blindpca', 'bench': 'm1', 'split': 'held', 'winner': p['winner'], 'loser': p['loser'], 'channelId': p['channelId'],
                   'winnerRatio': p['winnerRatio'], 'z': float(zz)} for p, zz in zip(held, zb)]
        log('benchBias', bench['benchBias'])
    if a.rung0:
        r0 = load_jsonl(a.rung0)
        r0 = dict(zip(r0.keys(), l2n(np.stack(list(r0.values())))))
        if all(x in r0 for x in need & set(stock)):
            res, p, corr['rung0'] = score_arm('rung0', r0, G, gpairs)
            bench['arms']['rung0'] = res
            preds += p
    for n in names:
        cfg = V[n]
        rows = []
        beh_n = beh
        if cfg.get('negPool') == 'blind':
            assert pool, 'variant needs --blind'
            r = random.Random(cfg['seed'])
            beh_n = []
            for g in beh:
                taken = {g['anchor'], *g['pos']}
                neg = []
                while len(neg) < 7:
                    x = pool[r.randrange(len(pool))]
                    if x not in taken:
                        neg.append(x)
                        taken.add(x)
                beh_n.append({**g, 'neg': neg})
            held_ids_n = {s['id'] for s in G['shorts'] if s['split'] != 'train'}
            bad = sum(x in held_ids_n or sp[x][1] != 'train' for g in beh_n for x in g['neg'] if x in sp) + sum(x not in sp for g in beh_n for x in g['neg'])
            assert bad == 0, f'{bad} negatives off the train split'
            share = float(np.mean([sp[x][2] == 1 for g in beh_n for x in g['neg']]))
            log(n, f'blind negatives: {len(beh_n)} groups, outlier share {share:.4f}, off-train {bad}')
            cfg = {**cfg, 'negativesOutlierShare': round(share, 4)}
            json.dump(beh_n, open(f'{a.out}/behavioral-groups-{n}.json', 'w'))
        t0 = time.time()
        head, Y, tinfo = train_head({**stock, **blind}, sem, beh_n, cfg, rows)
        res, p, corr[n] = score_arm(n, Y, G, gpairs)
        res['config'] = cfg
        res['training'] = {**tinfo, 'wallSec': round(time.time() - t0, 1), 'curve': rows}
        bench['arms'][n] = res
        preds += p
        torch.save(head.state_dict(), f'{a.out}/head-{n}.pt')
        ids = sorted(Y)
        np.save(f'{a.out}/embeddings-{n}.npy', np.stack([Y[i] for i in ids]).astype(np.float16))
        json.dump(ids, open(f'{a.out}/ids-{n}.json', 'w'))
        with open(f'{a.out}/head-{n}.jsonl', 'w') as f:
            for i in ids:
                f.write(json.dumps({'id': i, 'vector': [round(float(v), 6) for v in Y[i]]}) + '\n')
    # Gate B analog deltas against stock, channel-block bootstrap
    chans = [g[0] for g in gpairs]
    bench['gateBDeltas'] = {k: {'delta': round(float((corr[k] - corr['stock']).mean()), 4), 'ci95': block_ci(corr[k] - corr['stock'], chans)}
                            for k in corr if k != 'stock' and len(chans)}
    with open(f'{a.out}/predictions.jsonl', 'w') as f:
        for r in preds:
            f.write(json.dumps(r) + '\n')
    json.dump(bench, open(f'{a.out}/bench.json', 'w'), indent=1)
    log('done', a.out)


if __name__ == '__main__':
    main()
