"""PAX2 Encoder, Phase 2 after training: write the CLS pooling config the FlagEmbedding checkpoint lacks
(nsr/scripts/train-nsr/candidate-embed.py, ensure_pooling_config), re-embed the whole corpus with the
trained model through TEI with --pooling cls, and run the same kNN benchmark as stock.

Gate E, pre-registered: pooled kNN-AUC on held-out channels at least 0.02 above stock, and the
within-channel kNN-AUC not below stock.
"""
import json, os, sys
import numpy as np
from common import WORK, K, log, load_corpus, tei_start, tei_stop, tei_embed, topk, write_bench

CKPT = sys.argv[1]


def ensure_pooling_config(ckpt):
    os.makedirs(f'{ckpt}/1_Pooling', exist_ok=True)
    json.dump([{"idx": 0, "name": "0", "path": "", "type": "sentence_transformers.models.Transformer"},
               {"idx": 1, "name": "1", "path": "1_Pooling", "type": "sentence_transformers.models.Pooling"}],
              open(f'{ckpt}/modules.json', 'w'))
    json.dump({"word_embedding_dimension": 1024, "pooling_mode_cls_token": True,
               "pooling_mode_mean_tokens": False, "pooling_mode_max_tokens": False,
               "pooling_mode_mean_sqrt_len_tokens": False, "pooling_mode_weightedmean_tokens": False,
               "pooling_mode_lasttoken": False}, open(f'{ckpt}/1_Pooling/config.json', 'w'))
    json.dump({"max_seq_length": 256, "do_lower_case": False}, open(f'{ckpt}/sentence_bert_config.json', 'w'))
    log(f'wrote CLS pooling config into {ckpt}')


ensure_pooling_config(CKPT)
docs, _ = load_corpus()
tei_start('/model', mount=CKPT)
E = tei_embed([d['text'] for d in docs])
tei_stop()
np.save(f'{WORK}/embeddings-pax2.npy', E.astype(np.float16))

train = np.array([d['i'] for d in docs if d['split'] == 'train'])
held = np.array([d['i'] for d in docs if d['split'] == 'held'])
nb = topk(E, held, train, K)
stock = json.load(open(f'{WORK}/bench-stock.json'))
bench = write_bench('encoder', docs, list(held), [[train[j] for j in row] for row in nb], {'model': 'PAX2 Encoder'})

ok = lambda v: v is not None
pooled_ok = ok(bench['pooled']) and ok(stock['pooled']) and bench['pooled'] >= stock['pooled'] + 0.02
within_ok = ok(bench['within']) and ok(stock['within']) and bench['within'] >= stock['within']
bench['gate'] = {
    'name': 'E',
    'rule': 'pooled kNN-AUC on held-out channels at least 0.02 above stock bge-m3, and within-channel kNN-AUC not below stock',
    'stock': {'pooled': stock['pooled'], 'within': stock['within']},
    'encoder': {'pooled': bench['pooled'], 'within': bench['within']},
    'pooledDelta': None if not (ok(bench['pooled']) and ok(stock['pooled'])) else bench['pooled'] - stock['pooled'],
    'withinDelta': None if not (ok(bench['within']) and ok(stock['within'])) else bench['within'] - stock['within'],
    'pass': bool(pooled_ok and within_ok),
}
json.dump(bench, open(f'{WORK}/bench-encoder.json', 'w'), indent=1)
log(f'GATE E {"PASS" if bench["gate"]["pass"] else "FAIL"}: {bench["gate"]}')
