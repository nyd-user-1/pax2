#!/usr/bin/env bash
# Stage the four Hugging Face repositories' files in S3 for scripts/encoder/publish.sh, each with its card
# as README.md. Models come straight from the run's model directories; the two datasets are assembled under
# s3://nsr-embed-v2/pax2/publish/<run>/.
#   ./scripts/encoder/stage.sh <run-id>
set -euo pipefail
cd "$(dirname "$0")/../.."
RUN=${1:?run id}
R="--region us-east-1 --only-show-errors"
B=s3://nsr-embed-v2/pax2
RUNS=$B/runs/$RUN
PUB=$B/publish/$RUN
D=data/generated/model/encoder
aws s3 cp $R docs/cards/pax2-encoder-bge-m3.md $B/models/$RUN/encoder/README.md
aws s3 cp $R docs/cards/pax2-reranker-gte-modernbert.md $B/models/$RUN/reranker/README.md
for f in bench-stock.json bench-encoder.json bench-reranker.json; do
  aws s3 cp $R $D/runs/$RUN/$f $PUB/benchmark/$f
done
node -e 'console.log(require("./'$D'/holdout.json").ids.join("\n"))' > /tmp/pax2-heldout-ids.txt
aws s3 cp $R /tmp/pax2-heldout-ids.txt $PUB/benchmark/heldout-ids.txt
aws s3 cp $R $D/holdout.json $PUB/benchmark/holdout.json
aws s3 cp $R docs/cards/pax2-breakout-benchmark.md $PUB/benchmark/README.md
aws s3 cp $R $D/corpus.jsonl $PUB/training-set/corpus.jsonl
aws s3 cp $R $D/holdout.json $PUB/training-set/holdout.json
aws s3 cp $R data/generated/model/training-set.manifest.json $PUB/training-set/training-set.manifest.json
aws s3 cp $R docs/cards/pax2-shorts-training-set.md $PUB/training-set/README.md
for p in $B/models/$RUN/encoder/ $B/models/$RUN/reranker/ $PUB/benchmark/ $PUB/training-set/; do
  echo "$p"; aws s3 ls --recursive --region us-east-1 "$p" | grep -v '/checkpoint-' | awk '{print "  " $3, $4}'
done
