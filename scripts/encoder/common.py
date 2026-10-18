"""PAX2 Encoder and PAX2 Reranker, box side: what the three phases share.

The corpus text is read from corpus.jsonl, never rebuilt (rig rule 15; scripts/encoder/corpus.mjs is the
one definition). The kNN benchmark: for every held-out document, the K nearest training documents by
cosine; its score is the share of those neighbors that broke out; AUC of that score against the held-out
document's own breakout label, pooled over every held-out document and within each held-out channel.

within = the mean of per-channel AUCs weighted by the channel's held-out document count, over channels
holding at least one breakout and one non-breakout. A second implementation of the same AUC reads the
uploaded neighbor lists on the Mac (scripts/encoder/rescore.mjs, rig rule 25).
"""
import json, os, subprocess, time, urllib.request
import numpy as np

WORK = os.environ.get('WORK', '/opt/pax2/work')
K = 20
TEI = 'http://127.0.0.1:8080'
CHUNK = 128


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def load_corpus():
    docs = [json.loads(l) for l in open(f'{WORK}/corpus.jsonl') if l.strip()]
    holdout = json.load(open(f'{WORK}/holdout.json'))
    held = set(holdout['ids'])
    lim = int(os.environ.get('REHEARSE', '0') or 0)
    if lim:
        docs = rehearsal_slice(docs, held, lim)
    for i, d in enumerate(docs):
        d['i'] = i
        d['text'].encode('utf-8')  # raises on a lone surrogate, which TEI rejects
        d['split'] = 'paid' if d['group'] == 'paid-ad' else ('held' if d['id'] in held else 'train')
    return docs, holdout


def rehearsal_slice(docs, held, n):
    """The longest texts, so every batch pads to the full passage length and the memory test is the
    worst case: 15% from the largest held-out channel, the rest from the two largest training channels."""
    by_ch = {}
    for d in docs:
        if d['group'] != 'paid-ad':
            by_ch.setdefault(d['channelId'], []).append(d)
    held_ch = sorted({d['channelId'] for d in docs if d['id'] in held}, key=lambda c: -len(by_ch[c]))
    train_ch = sorted([c for c in by_ch if c not in set(held_ch)], key=lambda c: -len(by_ch[c]))
    longest = lambda c, k: sorted(by_ch[c], key=lambda d: -len(d['text']))[:k]
    nh = n * 15 // 100
    out = longest(held_ch[0], nh)
    rest = n - nh
    out += longest(train_ch[0], rest // 2) + longest(train_ch[1], rest - rest // 2)
    return out


# ── TEI ───────────────────────────────────────────────────────────────────────
def tei_tag():
    cap = subprocess.run(['nvidia-smi', '--query-gpu=compute_cap', '--format=csv,noheader'],
                         capture_output=True, text=True).stdout.strip().split('\n')[0]
    return {'8.9': '89-1.8', '8.6': '86-1.8', '8.0': '1.8', '9.0': 'hopper-1.8'}.get(cap, '89-1.8')


def tei_start(model_id, mount=None):
    subprocess.run(['docker', 'rm', '-f', 'pax2-tei'], capture_output=True)
    cmd = ['docker', 'run', '-d', '--gpus', 'all', '-p', '8080:80', '--name', 'pax2-tei',
           '-v', '/opt/pax2/hf:/data']
    if mount:
        cmd += ['-v', f'{mount}:/model']
    cmd += [f'ghcr.io/huggingface/text-embeddings-inference:{tei_tag()}',
            '--model-id', model_id, '--pooling', 'cls', '--dtype', 'float16',
            '--max-client-batch-size', str(CHUNK * 2), '--max-batch-tokens', '131072']
    subprocess.run(cmd, check=True)
    for _ in range(120):
        try:
            urllib.request.urlopen(f'{TEI}/health', timeout=3)
            log(f'TEI healthy: {model_id} ({tei_tag()})')
            return
        except Exception:
            time.sleep(5)
    subprocess.run(['docker', 'logs', '--tail', '50', 'pax2-tei'])
    raise RuntimeError('TEI did not become healthy within 600s')


def tei_stop():
    subprocess.run(['docker', 'rm', '-f', 'pax2-tei'], capture_output=True)


def tei_embed(texts):
    out = []
    t0 = time.time()
    for i in range(0, len(texts), CHUNK):
        req = urllib.request.Request(f'{TEI}/embed',
                                     data=json.dumps({'inputs': texts[i:i + CHUNK], 'truncate': True}).encode(),
                                     headers={'content-type': 'application/json'})
        try:
            out.extend(json.loads(urllib.request.urlopen(req, timeout=300).read()))
        except urllib.error.HTTPError as e:
            log(f'TEI {e.code} on chunk at {i}: {e.read()[:500]!r}')
            raise
    E = np.asarray(out, dtype=np.float32)
    E /= np.linalg.norm(E, axis=1, keepdims=True)
    assert E.shape == (len(texts), 1024) and not np.isnan(E).any(), E.shape
    log(f'embedded {len(texts)} in {time.time() - t0:.1f}s ({len(texts) / (time.time() - t0):.0f}/s)')
    return E


# ── neighbors and the benchmark ───────────────────────────────────────────────
def topk(E, rows, cols, k):
    """Indices into `cols` of each row's k nearest by cosine (E is unit-norm)."""
    import torch
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    C = torch.from_numpy(E[cols]).to(dev)
    out = []
    for s in range(0, len(rows), 2048):
        Q = torch.from_numpy(E[rows[s:s + 2048]]).to(dev)
        out.append(torch.topk(Q @ C.T, k, dim=1).indices.cpu().numpy())
    return np.concatenate(out)


def auc(y, s):
    """Mann-Whitney AUC with average ranks for ties; None when a class is empty."""
    y = np.asarray(y, dtype=np.int64)
    s = np.asarray(s, dtype=np.float64)
    n1 = int(y.sum())
    n0 = len(y) - n1
    if n1 == 0 or n0 == 0:
        return None
    order = np.argsort(s, kind='mergesort')
    ranks = np.empty(len(s))
    ss = s[order]
    i = 0
    while i < len(s):
        j = i
        while j + 1 < len(s) and ss[j + 1] == ss[i]:
            j += 1
        ranks[order[i:j + 1]] = (i + j) / 2 + 1
        i = j + 1
    return float((ranks[y == 1].sum() - n1 * (n1 + 1) / 2) / (n1 * n0))


def score_neighbors(docs, held_idx, nbr_idx):
    """nbr_idx: per held-out document, corpus indices of its kept neighbors."""
    return np.array([np.mean([docs[j]['breakout'] for j in nb]) for nb in nbr_idx])


def summarize(docs, held_idx, scores):
    y = np.array([docs[i]['breakout'] for i in held_idx])
    out = {'n': len(held_idx), 'breakouts': int(y.sum()), 'pooled': auc(y, scores)}
    ch, fam = {}, {}
    for k, i in enumerate(held_idx):
        ch.setdefault(docs[i]['channelId'], []).append(k)
        fam.setdefault(docs[i]['family'], []).append(k)
    per = []
    for c, ks in sorted(ch.items()):
        a = auc(y[ks], scores[ks])
        per.append({'channelId': c, 'family': docs[held_idx[ks[0]]]['family'], 'n': len(ks),
                    'breakouts': int(y[ks].sum()), 'auc': a})
    scored = [p for p in per if p['auc'] is not None]
    w = sum(p['n'] for p in scored)
    out['within'] = sum(p['auc'] * p['n'] for p in scored) / w if w else None
    out['withinUnweighted'] = float(np.mean([p['auc'] for p in scored])) if scored else None
    out['withinChannels'] = len(scored)
    out['perChannel'] = per
    out['perFamily'] = [{'family': f, 'n': len(ks), 'breakouts': int(y[ks].sum()), 'auc': auc(y[ks], scores[ks])}
                        for f, ks in sorted(fam.items())]
    out['meanScore'] = float(scores.mean())
    return out


def write_bench(arm, docs, held_idx, nbr_idx, extra=None):
    scores = score_neighbors(docs, held_idx, nbr_idx)
    res = summarize(docs, held_idx, scores)
    bench = {
        'arm': arm,
        'k': K,
        'definition': __doc__.strip().split('\n\n', 1)[1],
        'builtAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'corpusRows': len(docs),
        'trainingDocs': sum(d['split'] == 'train' for d in docs),
        **res,
        **(extra or {}),
    }
    json.dump(bench, open(f'{WORK}/bench-{arm}.json', 'w'), indent=1)
    json.dump({'arm': arm, 'k': K, 'rows': [{'id': docs[i]['id'], 'nbrs': [docs[j]['id'] for j in nb]}
                                            for i, nb in zip(held_idx, nbr_idx)]},
              open(f'{WORK}/neighbors-{arm}.json', 'w'))
    f4 = lambda v: 'n/a' if v is None else f'{v:.4f}'
    log(f'bench {arm}: pooled {f4(res["pooled"])} within {f4(res["within"])} '
        f'({res["withinChannels"]} channels) n={res["n"]}')
    return bench
