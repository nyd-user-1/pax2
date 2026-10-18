// pax2-analyze: the worker's replacement for requirements 4b and 5. Fired by S3 ObjectCreated under
// uploads/ with the .mp4 suffix (the pax2-transcode Lambda writes that mp4 from the browser's webm; the
// Studio and direct uploads write it themselves). For uploads/<workspace>/<id>.mp4 it starts one
// self-terminating c7i.large that runs scripts/rig/analyze_upload.py on the file: Whisper transcript
// with word timings, the measured audio features, CLIP frame embeddings and ResMem memorability, written
// to features/<id>.json and as an "analyzed" event on the original in DynamoDB. The box installs the rig's
// Python, about five minutes, then measures, about two; roughly 1.5 cents at $0.085 an hour. Nothing
// heavy runs here. A marker, features/<id>.launched, stops a second box for the same upload; an existing
// features/<id>.json stops any box. One JSON line per object.
import { EC2Client, RunInstancesCommand, DescribeSubnetsCommand, DescribeSecurityGroupsCommand, DescribeVpcsCommand } from "@aws-sdk/client-ec2"
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm"

const REGION = process.env.AWS_REGION ?? "us-east-1"
const TABLE = process.env.PAX2_LEDGER_TABLE ?? "pax2-ledger"
const PROFILE = process.env.PAX2_BOX_PROFILE ?? "nsr-embed"
const SG_NAME = process.env.PAX2_BOX_SG ?? "nsr-embed-sg"
const TYPES = (process.env.PAX2_BOX_TYPES ?? "c7i.large,c6i.large,m7i.large").split(",")
const WATCHDOG_MIN = Number(process.env.PAX2_BOX_WATCHDOG_MIN ?? 30)
const s3 = new S3Client({ region: REGION })
const ec2 = new EC2Client({ region: REGION })
const ssm = new SSMClient({ region: REGION })

const exists = async (Bucket, Key) => {
  try {
    await s3.send(new HeadObjectCommand({ Bucket, Key }))
    return true
  } catch (e) {
    if (e.$metadata?.httpStatusCode === 404 || e.name === "NotFound") return false
    throw e
  }
}

async function network() {
  const vpc = (await ec2.send(new DescribeVpcsCommand({ Filters: [{ Name: "is-default", Values: ["true"] }] }))).Vpcs?.[0]?.VpcId
  const sg = (await ec2.send(new DescribeSecurityGroupsCommand({ Filters: [{ Name: "group-name", Values: [SG_NAME] }, { Name: "vpc-id", Values: [vpc] }] }))).SecurityGroups?.[0]?.GroupId
  const subnets = (await ec2.send(new DescribeSubnetsCommand({ Filters: [{ Name: "vpc-id", Values: [vpc] }, { Name: "default-for-az", Values: ["true"] }] }))).Subnets?.map((s) => s.SubnetId) ?? []
  const ami = (await ssm.send(new GetParameterCommand({ Name: "/aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id" }))).Parameter?.Value
  return { sg, subnets, ami }
}

const userData = (bucket, key, id, logKey) => `#!/bin/bash
shutdown -h +${WATCHDOG_MIN}
exec >> /var/log/analyze.log 2>&1
set -uo pipefail
export AWS_DEFAULT_REGION=${REGION} DEBIAN_FRONTEND=noninteractive
echo "boot $(date -u +%FT%TZ) $(curl -s http://169.254.169.254/latest/meta-data/instance-type) key=${key} original=${id}"
apt-get update -q && apt-get install -y -q python3-venv awscli ffmpeg >/dev/null
mkdir -p /work/code && aws s3 cp --only-show-errors --recursive s3://${bucket}/code/rig/ /work/code/
python3 -m venv /opt/rig
/opt/rig/bin/pip install -q --upgrade pip
/opt/rig/bin/pip install -q torch torchvision --index-url https://download.pytorch.org/whl/cpu
grep -v -E '^(#|resmem|$)' /work/code/requirements.txt > /work/req-core.txt
/opt/rig/bin/pip install -q -r /work/req-core.txt
/opt/rig/bin/pip install -q resmem || echo "resmem install FAILED; memorability will be null"
echo "installed $(date -u +%FT%TZ)"
aws s3 cp --only-show-errors /var/log/analyze.log s3://${bucket}/${logKey}
cd /work/code && BUCKET=${bucket} KEY=${key} ORIGINAL=${id} TABLE=${TABLE} /opt/rig/bin/python analyze_upload.py
echo "EXIT=$? $(date -u +%FT%TZ)"
aws s3 cp --only-show-errors /var/log/analyze.log s3://${bucket}/${logKey}
shutdown -h now
`

async function launch(bucket, key, id) {
  const { sg, subnets, ami } = await network()
  const logKey = `logs/analyze-${id}-${new Date().toISOString().replace(/[:.]/g, "").slice(0, 15)}Z.log`
  const ud = Buffer.from(userData(bucket, key, id, logKey)).toString("base64")
  let last = null
  for (const type of TYPES) {
    for (const subnet of subnets) {
      try {
        const r = await ec2.send(new RunInstancesCommand({
          ImageId: ami, InstanceType: type, MinCount: 1, MaxCount: 1, SubnetId: subnet, SecurityGroupIds: [sg],
          IamInstanceProfile: { Name: PROFILE }, InstanceInitiatedShutdownBehavior: "terminate", UserData: ud,
          BlockDeviceMappings: [{ DeviceName: "/dev/sda1", Ebs: { VolumeSize: 30, VolumeType: "gp3", DeleteOnTermination: true } }],
          TagSpecifications: [{ ResourceType: "instance", Tags: [{ Key: "Name", Value: `pax2-analyze-${id}` }, { Key: "RigMode", Value: "analyze" }] }],
        }))
        return { instance: r.Instances?.[0]?.InstanceId, type, subnet, logKey }
      } catch (e) {
        last = e
        if (/InsufficientInstanceCapacity|Unsupported/.test(String(e.name) + String(e.message))) continue
        throw e
      }
    }
  }
  throw last ?? new Error("no capacity")
}

export const handler = async (event) => {
  const out = []
  for (const rec of event.Records ?? []) {
    const bucket = rec.s3?.bucket?.name
    const key = decodeURIComponent((rec.s3?.object?.key ?? "").replace(/\+/g, " "))
    const m = /^uploads\/([^/]+)\/([^/]+)\.mp4$/.exec(key)
    const line = { key, at: new Date().toISOString() }
    try {
      if (!m) { out.push({ ...line, skipped: "not uploads/<workspace>/<id>.mp4" }); continue }
      const [, workspace, id] = m
      if (workspace === "test") { out.push({ ...line, skipped: "test upload" }); continue }
      if (await exists(bucket, `features/${id}.json`)) { out.push({ ...line, skipped: "features exist" }); continue }
      if (await exists(bucket, `features/${id}.launched`)) { out.push({ ...line, skipped: "a box is already on it" }); continue }
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: `features/${id}.launched`, Body: `${key} ${line.at}\n`, ContentType: "text/plain" }))
      const box = await launch(bucket, key, id)
      out.push({ ...line, id, ...box })
    } catch (e) {
      out.push({ ...line, error: `${e.name}: ${e.message}`.slice(0, 300) })
    }
  }
  for (const l of out) console.log(JSON.stringify(l))
  return out
}
