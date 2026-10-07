import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"

import { FEATURES, TAKES, scriptById, takeLabel, type Features } from "@/lib/catalog"

// The three checks every video goes through on the worker box (worker/analyze.py), what each
// produces, and where it shows up. Costs are estimates at AWS list prices, from each video's length.

export type StepId = "transcribe" | "pegasus" | "audio"
export type StepState = "done" | "failed" | "running" | "queued" | "missing"

export const STEPS: { id: StepId; n: number; name: string; service: string; makes: string; feeds: string; rate: string }[] = [
  { id: "transcribe", n: 1, name: "Speech to text", service: "Amazon Transcribe", makes: "Every spoken word with the second it starts", feeds: "Transcript", rate: "$0.024 a minute" },
  { id: "pegasus", n: 2, name: "Video notes", service: "TwelveLabs Pegasus 1.2 on Amazon Bedrock", makes: "Timestamped notes: the opening, what happens when, setting, pace, captions and text on screen, visual variety, call to action", feeds: "Formula, and the Assessment's evidence on captions and text on screen", rate: "$0.03 a minute, plus about $0.01 of written output" },
  { id: "audio", n: 3, name: "Sound", service: "Measured on the worker box", makes: "Loudness each second, pitch range, and pauses of 0.3 seconds or more", feeds: "The dB chart", rate: "a fraction of a cent of box time" },
]

const cost: Record<StepId, (sec: number) => number> = {
  transcribe: (s) => (Math.max(15, s) / 60) * 0.024,
  pegasus: (s) => s * 0.00049 + 0.0075,
  audio: (s) => (s / 3600) * 0.067,
}

export type Cell = { state: StepState; out: string | null; cost: number }
export type Row = { id: string; title: string; label: string; seconds: number; analyzedAt: string | null; cells: Record<StepId, Cell>; cost: number }

const fmtDb = (xs: number[]) => `${Math.round(Math.max(...xs) - Math.min(...xs))} dB range`

function outOf(id: StepId, f: Features | undefined): { state: StepState; out: string | null } {
  if (!f) return { state: "missing", out: null }
  if (id === "transcribe") {
    const t = f.transcript
    if (!t) return { state: "missing", out: null }
    if (t.error) return { state: "failed", out: t.error }
    return { state: "done", out: `${t.words.length} words${t.wpm ? ` · ${Math.round(t.wpm)} wpm` : ""}` }
  }
  if (id === "pegasus") {
    const p = f.pegasus
    if (!p) return { state: "missing", out: null }
    if (p.error || !p.result) return { state: "failed", out: p.error ?? "No notes came back" }
    const n = (p.result.observations?.length ?? 0) + (p.result.hook ? 1 : 0)
    return { state: "done", out: `${n} notes` }
  }
  const a = f.audio
  if (!a) return { state: "missing", out: null }
  if (a.error) return { state: "failed", out: a.error }
  return { state: "done", out: `${a.loudnessDb?.length ? fmtDb(a.loudnessDb) : "—"} · ${a.pauses.length} pauses` }
}

/** The batch the box is working on right now, if any (written by worker/analyze.py). */
export type Batch = { startedAt: string; updatedAt: string; finishedAt: string | null; videos: Record<string, Partial<Record<StepId, StepState>>> }

const s3 = new S3Client({ region: process.env.PAX_REGION ?? "us-east-1" })
const BUCKET = process.env.PAX_BUCKET ?? "pax-638175140432"

export async function currentBatch(): Promise<Batch | null> {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: "jobs/status.json" }))
    const b = JSON.parse(await r.Body!.transformToString()) as Batch
    // A batch that stopped reporting two hours ago is not running, whatever it last said.
    const stale = Date.now() - new Date(b.updatedAt).getTime() > 2 * 3600 * 1000
    return b.finishedAt || stale ? null : b
  } catch {
    return null
  }
}

export function rows(batch: Batch | null): Row[] {
  return TAKES.map((t) => {
    const f = FEATURES[t.id]
    const live = batch?.videos[t.id]
    const cells = Object.fromEntries(
      STEPS.map((s) => {
        const o = outOf(s.id, f)
        const state = live?.[s.id] && live[s.id] !== "done" ? live[s.id]! : o.state
        return [s.id, { ...o, state, cost: state === "done" || state === "failed" ? cost[s.id](t.durationSec) : 0 }]
      }),
    ) as Record<StepId, Cell>
    return {
      id: t.id,
      title: scriptById(t.scriptId)!.short,
      label: takeLabel(t),
      seconds: t.durationSec,
      analyzedAt: f?.analyzedAt ?? null,
      cells,
      cost: Object.values(cells).reduce((s, c) => s + c.cost, 0),
    }
  })
}
