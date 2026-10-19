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
# Then: node scripts/catalog-audio/merge.mjs    # folds finished transcripts into transcripts.json
set -euo pipefail
REGION=us-east-1; ROLE=nsr-embed
AMI=ami-012ba162b9cd2729c
BUCKET=pax-2-638175140432
RUN=whisper-$(date -u +%Y%m%d-%H%M%S)
WATCHDOG_MIN=${WATCHDOG_MIN:-90}

N_AUDIO=$(aws s3 ls s3://$BUCKET/catalog-media/ --region $REGION | grep -c '\.m4a$' || true)
N_DONE=$(aws s3 ls s3://$BUCKET/catalog-media-transcripts/ --region $REGION 2>/dev/null | grep -c '\.json$' || true)
# Rule 6: minutes and dollars. Catalog shorts average about 45 seconds; faster-whisper large-v3 on an
# L4 runs well above 10x real time, so minutes ~ files * 45 / 600 plus about 8 of boot and install.
EST_MIN=$(( (N_AUDIO - N_DONE) * 45 / 600 + 8 ))
echo "audio files $N_AUDIO, transcribed $N_DONE, to do $((N_AUDIO - N_DONE))"
echo "plan: g6.xlarge (L4) \$0.8048/h, about $EST_MIN min, about \$$(echo "$EST_MIN" | awk '{printf "%.2f", $1/60*0.8048}'); watchdog $WATCHDOG_MIN min caps \$$(echo "$WATCHDOG_MIN" | awk '{printf "%.2f", $1/60*0.8048}')"
[ "${APPLY:-}" = 1 ] || { echo "dry run; APPLY=1 launches"; exit 0; }

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
\$PY -m pip install -q faster-whisper 2>&1 | tail -2
mkdir -p /opt/work && cd /opt/work
aws s3 ls s3://$BUCKET/catalog-media/ | awk '{print \$4}' | grep '\.m4a\$' > audio.txt
aws s3 ls s3://$BUCKET/catalog-media-transcripts/ 2>/dev/null | awk '{print \$4}' | sed 's/\.json\$//' > done.txt || true
\$PY - <<'PYEOF'
import json, os, subprocess, time, datetime
from faster_whisper import WhisperModel
bucket = "$BUCKET"
done = set(open("done.txt").read().split())
todo = [l.strip() for l in open("audio.txt") if l.strip() and l.strip()[:-4] not in done]
print(f"{len(todo)} to transcribe", flush=True)
model = WhisperModel("large-v3", device="cuda", compute_type="float16")
t0 = time.time(); n = 0
for f in todo:
    vid = f[:-4]
    try:
        subprocess.run(["aws", "s3", "cp", "--only-show-errors", f"s3://{bucket}/catalog-media/{f}", f], check=True)
        segments, info = model.transcribe(f, language="en", word_timestamps=True, vad_filter=True)
        words = []
        for seg in segments:
            for w in seg.words or []:
                words.append({"t": round(w.start, 2), "w": w.word.strip()})
        text = " ".join(w["w"] for w in words).strip()
        out = {"id": vid, "text": text or None, "words": words, "source": "whisper-catalog", "model": "large-v3",
               "durationSec": round(info.duration, 1), "at": datetime.datetime.utcnow().isoformat() + "Z"}
        with open(f"{vid}.json", "w") as fh: json.dump(out, fh)
        subprocess.run(["aws", "s3", "cp", "--only-show-errors", f"{vid}.json", f"s3://{bucket}/catalog-media-transcripts/{vid}.json"], check=True)
        os.remove(f); os.remove(f"{vid}.json")
        n += 1
        if n % 50 == 0: print(f"{n}/{len(todo)} at {n/((time.time()-t0)/60):.1f}/min", flush=True)
    except Exception as e:
        print(f"{vid}: {e}", flush=True)
print(f"DONE {n} of {len(todo)} in {time.time()-t0:.0f}s", flush=True)
PYEOF
echo "EXIT=\$?"
aws s3 cp --only-show-errors /var/log/pax2-whisper.log s3://$BUCKET/logs/pax2-$RUN.log
shutdown -h now
EOS
)

for TYPE in g6.xlarge g5.xlarge; do
  for SUBNET in "${SUBNETS[@]}"; do
    if OUT=$(aws ec2 run-instances --region $REGION --image-id "$AMI" --instance-type "$TYPE" --count 1 \
      --subnet-id "$SUBNET" --iam-instance-profile Name=$ROLE --security-group-ids "$SG" \
      --instance-initiated-shutdown-behavior terminate \
      --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":100,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
      --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=pax2-$RUN}]" \
      --user-data "$USERDATA" --query 'Instances[0].InstanceId' --output text 2>&1); then
      echo "$(date -u +%FT%TZ) launched $OUT $TYPE $SUBNET run=$RUN"
      echo "log: s3://$BUCKET/logs/pax2-$RUN.log"
      exit 0
    fi
    grep -q -E 'InsufficientInstanceCapacity|Unsupported' <<<"$OUT" && { echo "no $TYPE in $SUBNET"; continue; }
    echo "run-instances failed: $OUT"; exit 1
  done
done
echo "no capacity on the menu"; exit 1
