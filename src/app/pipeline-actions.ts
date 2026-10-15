"use server"

import { DescribeInstancesCommand, EC2Client, StartInstancesCommand } from "@aws-sdk/client-ec2"
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3"
import { DescribeInstanceInformationCommand, SendCommandCommand, SSMClient } from "@aws-sdk/client-ssm"

import { requireAdmin } from "@/lib/auth"

// A pipeline run on the worker box: every video in s3://…/videos/ without a features/ file yet goes
// through worker/analyze_organic.py (transcript, Pegasus notes, measured sound — no Rekognition).
// The box shuts itself down after about 30 idle minutes.

const REGION = process.env.PAX2_REGION ?? "us-east-1"
const BUCKET = "pax-2-638175140432"
const BOX = "i-029959fd31bba9a75"
const PER_VIDEO = 0.04
const s3 = new S3Client({ region: REGION })
const ec2 = new EC2Client({ region: REGION })
const ssm = new SSMClient({ region: REGION })

async function ids(prefix: string, ext: string): Promise<Set<string>> {
  const out = new Set<string>()
  let token: string | undefined
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token }))
    for (const o of r.Contents ?? []) if (o.Key?.endsWith(ext)) out.add(o.Key.slice(prefix.length, -ext.length))
    token = r.NextContinuationToken
  } while (token)
  return out
}

export type PipelineQueue = { queued: string[]; cost: number; box: string }

export async function pipelineQueue(): Promise<PipelineQueue> {
  const [videos, features, box] = await Promise.all([ids("videos/", ".mp4"), ids("features/", ".json"), ec2.send(new DescribeInstancesCommand({ InstanceIds: [BOX] }))])
  const queued = [...videos].filter((v) => !features.has(v)).sort()
  return { queued, cost: Math.round(queued.length * PER_VIDEO * 100) / 100, box: box.Reservations?.[0]?.Instances?.[0]?.State?.Name ?? "unknown" }
}

/** Start the box, wait for it to report in, and run the analyzer over the queue. Admins only. */
export async function runPipeline(): Promise<{ started: number; commandId: string }> {
  await requireAdmin()
  const { queued } = await pipelineQueue()
  if (!queued.length) throw new Error("Nothing is queued.")
  await ec2.send(new StartInstancesCommand({ InstanceIds: [BOX] }))
  for (let i = 0; ; i++) {
    const info = await ssm.send(new DescribeInstanceInformationCommand({ Filters: [{ Key: "InstanceIds", Values: [BOX] }] }))
    if (info.InstanceInformationList?.[0]?.PingStatus === "Online") break
    if (i >= 36) throw new Error("The worker box didn't come online within three minutes.")
    await new Promise((r) => setTimeout(r, 5000))
  }
  const r = await ssm.send(
    new SendCommandCommand({
      InstanceIds: [BOX],
      DocumentName: "AWS-RunShellScript",
      Comment: `pax2 pipeline run: ${queued.length} video(s)`,
      // The box's aws CLI is broken (no dateutil), so the code is pulled with boto3, which works.
      Parameters: { commands: [`python3 -c "import boto3; boto3.client('s3').download_file('${BUCKET}', 'code/analyze_organic.py', '/opt/pax2/analyze_organic.py')"`, `cd /opt/pax2 && python3 analyze_organic.py ${queued.join(" ")}`], executionTimeout: ["14400"] },
    }),
  )
  return { started: queued.length, commandId: r.Command?.CommandId ?? "" }
}
