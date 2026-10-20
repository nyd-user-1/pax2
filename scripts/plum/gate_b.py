"""Gate B, pre-registered 2026-10-20 07:15 UTC before the resonance run launched: held-out same-channel pair
ranking by resemblance to the channel's own known outliers.

Pairs: inside each held-out channel (data/generated/model/plum/holdout.json), every (outlier,
non-outlier) pair of corpus shorts published within 45 days of each other (scripts/pairwise/train.mjs's
window), capped at 4,000 per channel by a seeded sample. Exemplars: that channel's outliers published
strictly before the earlier of the two; a pair needs at least 3. A short's resonance score is the mean
cosine to its 5 most similar exemplars (all of them when fewer). The pair is right when the outlier
scores higher; a tie counts half.

Reported: pooled pair accuracy; the per-channel accuracies and their pair-weighted mean; and, when two
arms are given, the paired delta with a channel-block bootstrap (2,000 draws, seed 20261020).
Ship rule for the resonance encoder: pooled accuracy at least 0.01 above the pure-semantic encoder's
(run 20261019-094112-train, 0.5618) on the identical pairs, and Gate E passed. The bootstrap interval is
reported, not required: with 7 scorable channels it spans about 0.06, wide enough that the semantic
encoder's own +0.031 over stock does not exclude zero. Two arms are trained; if both pass, the one with
the higher pooled Gate B ships, a one-bit selection on the held-out pairs, stated in the ledger.

Usage: python3 scripts/plum/gate_b.py <ids.json> <name>=<embeddings.npy> [<name>=<embeddings.npy> ...]
Prints JSON; --out <file> also writes it.
"""
import json, os, sys, time
from datetime import datetime
import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
WINDOW = 45 * 86400
CAP = 4000
MIN_EX = 3
TOP = 5
SEED = 20261020


def ts(s):
    return datetime.strptime(s[:19], '%Y-%m-%dT%H:%M:%S').timestamp()


def main(argv):
    out_path = None
    if '--out' in argv:
        i = argv.index('--out'); out_path = argv[i + 1]; argv = argv[:i] + argv[i + 2:]
    ids = json.load(open(argv[0]))
    arms = {}
    for a in argv[1:]:
        name, p = a.split('=', 1)
        E = np.load(p).astype(np.float32)
        E /= np.linalg.norm(E, axis=1, keepdims=True)
        assert len(E) == len(ids), (p, E.shape, len(ids))
        arms[name] = E
    pos = {x: i for i, x in enumerate(ids)}
    rows = {}
    for l in open(os.path.join(ROOT, 'data/generated/model/training-set.jsonl')):
        if l.strip():
            r = json.loads(l)
            rows[r['id']] = r
    held = set(json.load(open(os.path.join(ROOT, 'data/generated/model/plum/holdout.json')))['ids'])
    by_ch = {}
    for x in ids:
        r = rows.get(x)
        if x in held and r and r.get('breakout') in (0, 1) and r.get('published'):
            by_ch.setdefault(r['channelId'], []).append((ts(r['published']), x, r['breakout']))
    rng = np.random.default_rng(SEED)
    pairs = []  # (channel, outlier idx, other idx, exemplar idx list)
    for ch in sorted(by_ch):
        v = sorted(by_ch[ch])
        cand = []
        for i in range(len(v)):
            for j in range(i + 1, len(v)):
                if v[j][0] - v[i][0] > WINDOW:
                    break
                if v[i][2] == v[j][2]:
                    continue
                first = v[i][0]
                ex = [pos[x] for t, x, b in v if b == 1 and t < first]
                if len(ex) < MIN_EX:
                    continue
                o, n = (v[i], v[j]) if v[i][2] == 1 else (v[j], v[i])
                cand.append((ch, pos[o[1]], pos[n[1]], ex))
        if len(cand) > CAP:
            cand = [cand[k] for k in sorted(rng.choice(len(cand), CAP, replace=False))]
        pairs.extend(cand)
    chs = sorted({p[0] for p in pairs})
    res = {'builtAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'pairs': len(pairs),
           'channels': len(chs), 'heldOutChannelsInCorpus': len(by_ch),
           'protocol': __doc__.strip().split('\n\n')[1].replace('\n', ' '), 'arms': {}}
    correct = {}
    for name, E in arms.items():
        c = np.empty(len(pairs))
        for k, (ch, o, n, ex) in enumerate(pairs):
            X = E[ex]
            so = np.sort(X @ E[o])[-TOP:].mean()
            sn = np.sort(X @ E[n])[-TOP:].mean()
            c[k] = 1.0 if so > sn else (0.5 if so == sn else 0.0)
        correct[name] = c
        per = []
        for ch in chs:
            m = np.array([p[0] == ch for p in pairs])
            per.append({'channelId': ch, 'pairs': int(m.sum()), 'accuracy': round(float(c[m].mean()), 4)})
        res['arms'][name] = {'pooled': round(float(c.mean()), 4), 'perChannel': per}
    names = list(arms)
    if len(names) >= 2:
        chi = np.array([chs.index(p[0]) for p in pairs])
        res['deltas'] = {}
        for b in names[1:]:
            for a in names[:names.index(b)]:
                d = correct[b] - correct[a]
                boots = []
                br = np.random.default_rng(SEED)
                for _ in range(2000):
                    pick = br.integers(len(chs), size=len(chs))
                    m = np.concatenate([np.where(chi == c)[0] for c in pick])
                    boots.append(d[m].mean())
                lo, hi = np.percentile(boots, [2.5, 97.5])
                res['deltas'][f'{b}-{a}'] = {'delta': round(float(d.mean()), 4), 'ci95': [round(float(lo), 4), round(float(hi), 4)]}
    s = json.dumps(res, indent=1)
    if out_path:
        open(out_path, 'w').write(s)
    print(s)


if __name__ == '__main__':
    main(sys.argv[1:])
