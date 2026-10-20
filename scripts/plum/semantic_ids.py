"""PLUM baseline, Part 1: hierarchical semantic IDs over the serving index (arXiv 2510.07784, section 3.1).

Residual k-means, three levels: level 1 clusters the unit-norm embeddings, level 2 clusters what level 1's
centroid leaves unexplained, level 3 what level 2 leaves. Codebook sizes 40 / 64 / 64 by default, so
level 1 has the cluster map's k=40 and stays legible beside it.

Measured, all on the Mac, no spend:
  uniqueness      share of shorts whose (c1, c2, c3) is held by no other short; collisions by size
  agreement       for each short, its 10 nearest by raw cosine; the share of them sharing its c1,
                  its (c1, c2), its full ID, each beside the share a random pair would by chance
  recall@10       the 10 nearest by cosine on the reconstructed vectors (sum of the three centroids)
                  against the 10 nearest on the raw vectors
  map agreement   NMI and adjusted Rand between level 1 and the cluster map's k=40 assignment

Usage: python3 scripts/plum/semantic_ids.py [--sizes 40,64,64]
Reads  data/plum/{embeddings.npy, rows.json, map.json, meta.json} (aws s3 cp from
       s3://pax-2-638175140432/model/encoder-index/<run>/, the run current.json names)
Writes data/generated/model/semantic-ids.json
"""
import argparse, json, math, os, time
import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SRC = os.path.join(ROOT, 'data/plum')
OUT = os.path.join(ROOT, 'data/generated/model/semantic-ids.json')
SEED = 20261020
NB = 10


def kmeans(X, k, rng, iters=50):
    """Lloyd's with k-means++ seeding, Euclidean. Returns (centroids, labels, inertia)."""
    n = len(X)
    x2 = (X * X).sum(1)
    C = np.empty((k, X.shape[1]), dtype=X.dtype)
    C[0] = X[rng.integers(n)]
    d = x2 - 2 * X @ C[0] + C[0] @ C[0]
    for j in range(1, k):
        p = np.maximum(d, 0)
        C[j] = X[rng.choice(n, p=p / p.sum())]
        d = np.minimum(d, x2 - 2 * X @ C[j] + C[j] @ C[j])
    lab = None
    for it in range(iters):
        D = x2[:, None] - 2 * X @ C.T + (C * C).sum(1)[None, :]
        new = D.argmin(1)
        if lab is not None and (new == lab).all():
            break
        lab = new
        for j in range(k):
            m = lab == j
            if m.any():
                C[j] = X[m].mean(0)
            else:  # an empty cluster takes the point farthest from its centroid
                far = D[np.arange(n), lab].argmax()
                C[j] = X[far]
                lab[far] = j
    inertia = float(D[np.arange(n), lab].sum())
    return C, lab, inertia, it + 1


def topk_cos(A, k):
    """Each row's k nearest other rows by cosine (A unit-norm), in blocks."""
    out = np.empty((len(A), k), dtype=np.int64)
    for s in range(0, len(A), 2048):
        S = A[s:s + 2048] @ A.T
        S[np.arange(len(S)), np.arange(s, s + len(S))] = -np.inf
        idx = np.argpartition(-S, k, axis=1)[:, :k]
        part = np.take_along_axis(S, idx, 1)
        out[s:s + len(S)] = np.take_along_axis(idx, np.argsort(-part, 1), 1)
    return out


def comb2(x):
    return x * (x - 1) / 2


def nmi_ari(a, b):
    ua, ia = np.unique(a, return_inverse=True)
    ub, ib = np.unique(b, return_inverse=True)
    M = np.zeros((len(ua), len(ub)))
    np.add.at(M, (ia, ib), 1)
    n = M.sum()
    pa, pb = M.sum(1) / n, M.sum(0) / n
    P = M / n
    nz = P > 0
    mi = (P[nz] * np.log(P[nz] / (pa[:, None] * pb[None, :])[nz])).sum()
    ha = -(pa[pa > 0] * np.log(pa[pa > 0])).sum()
    hb = -(pb[pb > 0] * np.log(pb[pb > 0])).sum()
    nmi = mi / ((ha + hb) / 2)
    sij = comb2(M).sum()
    sa, sb = comb2(M.sum(1)).sum(), comb2(M.sum(0)).sum()
    exp = sa * sb / comb2(n)
    ari = (sij - exp) / ((sa + sb) / 2 - exp)
    return float(nmi), float(ari)


def chance_share(codes):
    """Probability two distinct random shorts share this code."""
    _, cnt = np.unique(codes, return_counts=True)
    n = cnt.sum()
    return float(comb2(cnt).sum() / comb2(n))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sizes', default='40,64,64')
    ap.add_argument('--write', default='1')
    args = ap.parse_args()
    sizes = [int(s) for s in args.sizes.split(',')]
    t0 = time.time()
    meta = json.load(open(f'{SRC}/meta.json'))
    rows = json.load(open(f'{SRC}/rows.json'))
    E = np.load(f'{SRC}/embeddings.npy').astype(np.float32)
    E /= np.linalg.norm(E, axis=1, keepdims=True)
    assert E.shape == (meta['n'], meta['dim']) == (len(rows), 1024), E.shape
    rng = np.random.default_rng(SEED)

    R = E.copy()
    codes, books, levels = [], [], []
    for lv, k in enumerate(sizes, 1):
        C, lab, inertia, iters = kmeans(R, k, rng)
        before = float((R * R).sum())
        R = R - C[lab]
        codes.append(lab)
        books.append(C)
        _, cnt = np.unique(lab, return_counts=True)
        levels.append({'level': lv, 'k': k, 'used': int(len(cnt)), 'iters': iters,
                       'residualEnergyBefore': round(before / len(E), 5),
                       'residualEnergyAfter': round(float((R * R).sum()) / len(E), 5),
                       'largestCode': int(cnt.max()), 'medianCodeSize': float(np.median(cnt))})
        print(f'level {lv}: k={k} iters={iters} residual {levels[-1]["residualEnergyBefore"]} -> {levels[-1]["residualEnergyAfter"]}', flush=True)
    codes = np.stack(codes, 1)

    # uniqueness
    key = codes[:, 0] * (sizes[1] * sizes[2]) + codes[:, 1] * sizes[2] + codes[:, 2]
    u, inv, cnt = np.unique(key, return_inverse=True, return_counts=True)
    per = cnt[inv]
    uniq = {'distinctIds': int(len(u)), 'shortsWithUniqueId': int((per == 1).sum()),
            'uniqueness': round(float((per == 1).mean()), 4),
            'distinctShare': round(len(u) / len(E), 4),
            'largestCollision': int(cnt.max()),
            'collisionSizes': {str(s): int((cnt == s).sum()) for s in sorted(set(cnt.tolist())) if s > 1}}
    print('uniqueness', uniq, flush=True)

    # neighbor agreement against raw cosine
    nb = topk_cos(E, NB)
    k12 = codes[:, 0] * sizes[1] + codes[:, 1]
    agree = {}
    for name, c in (('c1', codes[:, 0]), ('c1c2', k12), ('c1c2c3', key)):
        agree[name] = {'shareOfRawTop10': round(float((c[nb] == c[:, None]).mean()), 4),
                       'chance': round(chance_share(c), 5)}
    recon = sum(books[i][codes[:, i]] for i in range(3))
    recon /= np.linalg.norm(recon, axis=1, keepdims=True)
    nb_r = topk_cos(recon, NB)
    hits = np.array([len(set(a) & set(b)) for a, b in zip(nb, nb_r)])
    agree['recall@10Reconstructed'] = round(float(hits.mean() / NB), 4)
    cos_recon = float((E * recon).sum(1).mean())
    print('agreement', agree, 'mean cos(raw, recon)', round(cos_recon, 4), flush=True)

    # level 1 against the cluster map
    mp = json.load(open(f'{SRC}/map.json'))
    pos = {p['id']: p['cluster'] for p in mp['points']}
    assert all(r['id'] in pos for r in rows)
    m = np.array([pos[r['id']] for r in rows])
    nmi, ari = nmi_ari(codes[:, 0], m)
    mapAgree = {'nmi': round(nmi, 4), 'ari': round(ari, 4),
                'note': 'the map clusters PCA-50 of the same index with its own k-means seed; 1.0 is identical'}
    print('map agreement', mapAgree, flush=True)

    # outlier rate per level-1 code beside the map's, to keep level 1 legible
    lab = np.array([r['breakout'] if r['breakout'] is not None else -1 for r in rows])
    l1 = []
    for j in range(sizes[0]):
        idx = np.where(codes[:, 0] == j)[0]
        lb = lab[idx][lab[idx] >= 0]
        dom = np.bincount(m[idx], minlength=mp['k'])
        l1.append({'c1': j, 'n': int(len(idx)), 'outlierRate': round(float(lb.mean()), 3) if len(lb) else None,
                   'mapCluster': int(dom.argmax()), 'mapClusterShare': round(float(dom.max() / len(idx)), 3),
                   'channels': int(len({rows[i]['channelId'] for i in idx})),
                   'central': [rows[int(i)]['label'][:90] for i in idx[np.argsort(((E[idx] - books[0][j]) ** 2).sum(1))[:3]]]})

    res = {
        'builtAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'method': 'residual k-means on the unit-norm serving-index embeddings, 3 levels, k-means++ seeding, '
                  f'Lloyd to convergence (max 50), Euclidean; seed {SEED}',
        'index': {'run': meta['run'], 'model': meta['model'], 'n': meta['n'], 'dim': meta['dim']},
        'sizes': sizes, 'idSpace': int(np.prod(sizes)), 'levels': levels,
        'uniqueness': uniq, 'neighborAgreement': agree, 'meanCosRawToReconstructed': round(cos_recon, 4),
        'level1VsClusterMap': mapAgree, 'level1': l1,
        'seconds': round(time.time() - t0, 1),
        'ids': {r['id']: [int(x) for x in c] for r, c in zip(rows, codes)},
    }
    if args.write == '1':
        json.dump(res, open(OUT, 'w'))
        print(f'wrote {OUT} ({os.path.getsize(OUT)} bytes) in {res["seconds"]}s')
    else:
        print(json.dumps({k: v for k, v in res.items() if k not in ('ids', 'level1')}))


if __name__ == '__main__':
    main()
