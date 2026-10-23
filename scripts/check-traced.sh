#!/usr/bin/env bash
# Runs in CI after the build: every repo data file the server reads from disk must be inside the
# standalone output, or production reads null. Files served through src/lib/generated-store.ts and
# src/lib/feed-data.ts come from S3 in production and are exempt.
set -u
EXEMPT='data/generated/question-bank.json|data/generated/codebook.json|data/generated/model/vqa-census.json|data/generated/feed-index.json'
missing=0
# Only paths read from disk (process.cwd() joins); a static JSON import is compiled into the code.
for f in $(grep -rhoE 'cwd\(\), "data/[A-Za-z0-9_./-]+\.(json|jsonl|csv)"' src | grep -oE 'data/[^"]+' | sort -u); do
  [ -f "$f" ] || continue
  git ls-files --error-unmatch "$f" >/dev/null 2>&1 || continue
  echo "$f" | grep -qE "^($EXEMPT)$" && continue
  if [ ! -f ".next/standalone/$f" ]; then echo "::error::not in the build: $f"; missing=$((missing+1)); fi
done
echo "data files in standalone: $(find .next/standalone/data -type f 2>/dev/null | wc -l | tr -d ' '); missing: $missing"
[ "$missing" -eq 0 ]
