"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, Upload } from "lucide-react"

import { uploadUrl } from "@/app/actions"
import { ownerPublish, review, scoreOriginal, submitEnhanced, watchOnYouTube } from "@/app/original-actions"
import { cn } from "@/ui/lib/utils"

const primary = "press inline-flex items-center gap-1.5 rounded-full bg-hermes-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
const secondary = "press inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-hermes-ink disabled:opacity-40"

function useRun() {
  const router = useRouter()
  const [busy, setBusy] = React.useState<string | null>(null)
  const [err, setErr] = React.useState<string | null>(null)
  const run = (key: string, fn: () => Promise<unknown>) => async () => {
    setBusy(key)
    setErr(null)
    try {
      await fn()
      router.refresh()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(null)
    }
  }
  return { busy, err, run }
}

const Spin = ({ on }: { on: boolean }) => (on ? <Loader2 className="size-4 animate-spin" /> : null)

export function ScoreButton({ id }: { id: string }) {
  const { busy, err, run } = useRun()
  return (
    <div className="flex flex-col gap-2">
      <button type="button" disabled={!!busy} onClick={run("score", () => scoreOriginal(id))} className={cn(primary, "w-fit")}>
        <Spin on={busy === "score"} /> Score
      </button>
      {err && <p className="text-sm text-below">{err}</p>}
    </div>
  )
}

/** The admin's review: notes, then Re-Record, Approved or Enhance. While enhancing, the plan and the
 *  upload for the enhanced cut, which comes back as the next version. */
export function OriginalAdmin({ id, enhancing, plan = [] }: { id: string; enhancing: boolean; plan?: string[] }) {
  const router = useRouter()
  const { busy, err, run } = useRun()
  const [note, setNote] = React.useState("")
  const file = React.useRef<HTMLInputElement>(null)

  const upload = (f: File) =>
    run("upload", async () => {
      const seconds = await new Promise<number>((resolve) => {
        const v = document.createElement("video")
        v.preload = "metadata"
        v.onloadedmetadata = () => resolve(Math.round(v.duration || 0))
        v.onerror = () => resolve(0)
        v.src = URL.createObjectURL(f)
      })
      const u = await uploadUrl(f.type || "video/mp4")
      const r = await fetch(u.url, { method: "PUT", body: f, headers: { "Content-Type": f.type || "video/mp4" } })
      if (!r.ok) throw new Error(`Upload failed (${r.status})`)
      const { id: next } = await submitEnhanced({ parent: id, id: u.id, key: u.key, seconds })
      router.push(`/v/${next}`)
    })()

  if (enhancing)
    return (
      <div className="surface flex flex-col gap-4 p-5">
        <p className="font-semibold text-slate-900">Hermes Enrichment Engine</p>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-slate-700">
          {plan.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
        <div>
          <button type="button" disabled={!!busy} onClick={() => file.current?.click()} className={primary}>
            {busy === "upload" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Upload the enhanced cut
          </button>
          <input ref={file} type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </div>
        {err && <p className="text-sm text-below">{err}</p>}
      </div>
    )

  return (
    <div className="surface flex flex-col gap-4 p-5">
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Notes" className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-hermes-plum" />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!!busy} onClick={run("rerecord", () => review(id, "rerecord", note))} className={secondary}>
          <Spin on={busy === "rerecord"} /> Re-Record
        </button>
        <button type="button" disabled={!!busy} onClick={run("approved", () => review(id, "approved", note))} className={secondary}>
          <Spin on={busy === "approved"} /> Approved
        </button>
        <button type="button" disabled={!!busy} onClick={run("enhance", () => review(id, "enhance", note))} className={primary}>
          <Spin on={busy === "enhance"} /> Enhance
        </button>
      </div>
      {err && <p className="text-sm text-below">{err}</p>}
    </div>
  )
}

/** The owner, arriving from the findings email's "Nah, publish it". */
export function OwnerPublish({ id }: { id: string }) {
  const { busy, err, run } = useRun()
  return (
    <div className="surface flex flex-wrap items-center justify-between gap-4 p-5">
      <p className="font-semibold text-slate-900">Publish it as it is?</p>
      <div className="flex gap-2">
        <a href={`/record/camera?again=${id}`} className={secondary}>
          Re-record
        </a>
        <button type="button" disabled={!!busy} onClick={run("publish", () => ownerPublish(id))} className={primary}>
          <Spin on={busy === "publish"} /> Nah, publish it
        </button>
      </div>
      {err && <p className="w-full text-sm text-below">{err}</p>}
    </div>
  )
}

/** Once it is live on YouTube: its link hands it to the poller. */
export function WatchForm({ id }: { id: string }) {
  const { busy, err, run } = useRun()
  const [url, setUrl] = React.useState("")
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="YouTube link" className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-hermes-plum" />
        <button type="button" disabled={!!busy || !url.trim()} onClick={run("watch", () => watchOnYouTube(id, url))} className={primary}>
          <Spin on={busy === "watch"} /> Start polling
        </button>
      </div>
      {err && <p className="text-sm text-below">{err}</p>}
    </div>
  )
}
