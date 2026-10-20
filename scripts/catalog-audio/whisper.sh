#!/usr/bin/env bash
# Whisper over the catalog audio already in S3 (Brendan, 2026-10-19: "whatever audio we have we should
# run it through AWS"): one self-terminating GPU box transcribes every catalog-media/*.m4a that has no
# transcript yet under catalog-media-transcripts/, word times included, and shuts down. Incremental by
# design — rerun it as the downloader (or a future fleet) lands more audio; done files are skipped.
# Role nsr-embed (its pax2-rig policy covers the pax-2-* buckets), the PyTorch DLAMI, menu g6.xlarge
# then g5.xlarge across the default subnets (rule 8), watchdog first line (rule 3).
#
#   ./scripts/catalog-audio/whisper.sh          # prints the census and the plan, no launch
#   APPLY=1 ./scripts/catalog-audio/whisper.sh  # launches
#   IDS=path SHARDS=2 APPLY=1 ./scripts/catalog-audio/whisper.sh
#       # only the ids in the file (one per line), split round-robin over SHARDS boxes
# Then: node scripts/catalog-audio/merge.mjs    # folds finished transcripts into transcripts.json
set -euo pipefail
REGION=us-east-1; ROLE=nsr-embed
AMI=ami-012ba162b9cd2729c
BUCKET=pax-2-638175140432
RUN=whisper-$(date -u +%Y%m%d-%H%M%S)
WATCHDOG_MIN=${WATCHDOG_MIN:-90}
SHARDS=${SHARDS:-1}
AUDIO=$(mktemp); DONE=$(mktemp); TODO=$(mktemp)
aws s3 ls s3://$BUCKET/catalog-media/ --region $REGION | awk '{print $4}' | grep '\.m4a$' | sed 's/\.m4a$//' > "$AUDIO" || true
aws s3 ls s3://$BUCKET/catalog-media-transcripts/ --region $REGION 2>/dev/null | awk '{print $4}' | grep '\.json$' | sed 's/\.json$//' > "$DONE" || true
grep -vxF -f "$DONE" "$AUDIO" > "$TODO" || true
if [ -n "${IDS:-}" ]; then grep -xF -f "$IDS" "$TODO" > "$TODO.i" || true; mv "$TODO.i" "$TODO"; fi
N_TODO=$(wc -l < "$TODO" | tr -d ' ')
# Rule 6: minutes and dollars. Run whisper-20261019-075312 measured 9.5 files a minute on one L4
# (847 files in 5,306 s), so minutes ~ files / 9.5 per box plus about 10 of boot and install.
EST_MIN=$(( N_TODO / SHARDS * 10 / 95 + 10 ))
echo "audio files $(wc -l < "$AUDIO" | tr -d ' '), transcribed $(wc -l < "$DONE" | tr -d ' '), to do $N_TODO${IDS:+ (restricted to $IDS)}"
echo "plan: $SHARDS g6.xlarge (L4) \$0.8048/h, about $EST_MIN min each, about \$$(echo "$SHARDS $EST_MIN" | awk '{printf "%.2f", $1*$2/60*0.8048}'); watchdog $WATCHDOG_MIN min caps \$$(echo "$SHARDS $WATCHDOG_MIN" | awk '{printf "%.2f", $1*$2/60*0.8048}')"
[ "${APPLY:-}" = 1 ] || { echo "dry run; APPLY=1 launches"; rm -f "$AUDIO" "$DONE" "$TODO"; exit 0; }
for i in $(seq 0 $((SHARDS-1))); do
  awk -v n=$SHARDS -v b=$i '(NR-1)%n==b' "$TODO" > "$TODO.$i"
  aws s3 cp --only-show-errors "$TODO.$i" s3://$BUCKET/code/whisper/$RUN/ids$i.txt --region $REGION
  rm -f "$TODO.$i"
done
rm -f "$AUDIO" "$DONE" "$TODO"

VPC=$(aws ec2 describe-vpcs --region $REGION --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --region $REGION --filters Name=group-name,Values=nsr-embed-sg Name=vpc-id,Values=$VPC --query 'SecurityGroups[0].GroupId' --output text)
SUBNETS=($(aws ec2 describe-subnets --region $REGION --filters Name=vpc-id,Values=$VPC Name=default-for-az,Values=true --query 'Subnets[].SubnetId' --output text))

USERDATA=$(cat <<EOS
#!/bin/bash
shutdown -h +$WATCHDOG_MIN
exec > /var/log/pax2-whisper.log 2>&1
set -ux
export AWS_DEFAULT_REGION=$REGION
PY=/opt/pytorch/bin/python3
# av pinned: newer PyAV (19.0.1 on run 073557, and the DLAMI preinstall on run 070759) rejects the
# metadata_errors argument faster-whisper passes to av.open(), so both runs died on file one. -U av was
# the wrong direction. faster-whisper 1.2.1 + av 15.1.0 decoded the exact failing m4a on the Mac
# (2026-10-19 07:53 UTC, -6iChOmLosA.m4a, 2,058,588 samples).
\$PY -m pip install -q -U faster-whisper 'av==15.1.0' 2>&1 | tail -2
\$PY -c 'import av, faster_whisper; print("av", av.__version__, "faster-whisper ok")'
mkdir -p /opt/work && cd /opt/work
aws s3 cp --only-show-errors s3://$BUCKET/code/whisper/$RUN/ids__SHARD__.txt ids.txt
sed 's/\$/.m4a/' ids.txt > audio.txt
aws s3 ls s3://$BUCKET/catalog-media-transcripts/ 2>/dev/null | awk '{print \$4}' | sed 's/\.json\$//' > done.txt || true
\$PY - <<'PYEOF'
import json, os, subprocess, time, datetime
from faster_whisper import WhisperModel
# Preflight on the decode path itself: runs 070759 and 073557 both passed the import check and then
# died inside av.open(), so the probe must make the same call decode makes — a bare import proves nothing.
import wave
with wave.open("./probe.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000); w.writeframes(b"\x00\x00" * 16000)
from faster_whisper.audio import decode_audio
decode_audio("./probe.wav")
os.remove("./probe.wav")
print("decode probe ok", flush=True)
bucket = "$BUCKET"
done = set(open("done.txt").read().split())
todo = [l.strip() for l in open("audio.txt") if l.strip() and l.strip()[:-4] not in done]
print(f"{len(todo)} to transcribe", flush=True)
model = WhisperModel("large-v3", device="cuda", compute_type="float16")
t0 = time.time(); n = 0
first_error = None
for f in todo:
    vid = f[:-4]
    try:
        # ./ on every local path: catalog ids can begin with a dash and the CLI reads a bare one as a flag
        # (measured: run 072514 died on -6iChOmLosA.m4a, "the following arguments are required: paths").
        subprocess.run(["aws", "s3", "cp", "--only-show-errors", f"s3://{bucket}/catalog-media/{f}", f"./{f}"], check=True)
        segments, info = model.transcribe(f"./{f}", language="en", word_timestamps=True, vad_filter=True)
        words = []
        for seg in segments:
            for w in seg.words or []:
                words.append({"t": round(w.start, 2), "w": w.word.strip()})
        text = " ".join(w["w"] for w in words).strip()
        out = {"id": vid, "text": text or None, "words": words, "source": "whisper-catalog", "model": "large-v3",
               "durationSec": round(info.duration, 1), "at": datetime.datetime.utcnow().isoformat() + "Z"}
        with open(f"./{vid}.json", "w") as fh: json.dump(out, fh)
        subprocess.run(["aws", "s3", "cp", "--only-show-errors", f"./{vid}.json", f"s3://{bucket}/catalog-media-transcripts/{vid}.json"], check=True)
        os.remove(f"./{f}"); os.remove(f"./{vid}.json")
        n += 1
        if n % 50 == 0: print(f"{n}/{len(todo)} at {n/((time.time()-t0)/60):.1f}/min", flush=True)
    except Exception as e:
        print(f"{vid}: {e}", flush=True)
        # Fail fast: if the very first file errors, the rig is broken, not the file (rule 14).
        if n == 0:
            first_error = e
            break
print(f"DONE {n} of {len(todo)} in {time.time()-t0:.0f}s", flush=True)
if first_error is not None:
    raise SystemExit(1)
PYEOF
echo "EXIT=\$?"
aws s3 cp --only-show-errors /var/log/pax2-whisper.log s3://$BUCKET/logs/pax2-$RUN-__SHARD__.log
shutdown -h now
EOS
)

launch() {
SHARD=$1
for TYPE in g6.xlarge g5.xlarge; do
  for SUBNET in "${SUBNETS[@]}"; do
    if OUT=$(aws ec2 run-instances --region $REGION --image-id "$AMI" --instance-type "$TYPE" --count 1 \
      --subnet-id "$SUBNET" --iam-instance-profile Name=$ROLE --security-group-ids "$SG" \
      --instance-initiated-shutdown-behavior terminate \
      --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":100,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
      --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=pax2-$RUN-$SHARD}]" \
      --user-data "${USERDATA//__SHARD__/$SHARD}" --query 'Instances[0].InstanceId' --output text 2>&1); then
      echo "$(date -u +%FT%TZ) launched $OUT $TYPE $SUBNET run=$RUN shard $SHARD"
      echo "log: s3://$BUCKET/logs/pax2-$RUN-$SHARD.log"
      return 0
    fi
    grep -q -E 'InsufficientInstanceCapacity|Unsupported' <<<"$OUT" && { echo "no $TYPE in $SUBNET"; continue; }
    echo "run-instances failed: $OUT"; exit 1
  done
done
echo "no capacity on the menu for shard $SHARD"; exit 1
}
for i in $(seq 0 $((SHARDS-1))); do launch $i; done
