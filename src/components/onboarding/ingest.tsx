"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronDown, Loader2, TriangleAlert } from "lucide-react"

import { pollIngest, privateVideos, savePicks } from "@/app/onboarding-actions"
import type { Progress } from "@/lib/channel-ingest"
import { cn } from "@/ui/lib/utils"

// A connected channel on screen. The pax2-channel-ingest Lambda does the work (src/lib/channel-ingest.ts);
// this polls where the run stands, so the user can move on and come back to it.

export function useIngest(channelId: string, initial: Progress | null) {
  const router = useRouter()
  const [p, setP] = React.useState<Progress | null>(initial)
  const [error, setError] = React.useState<string | null>(null)
  const [tick, setTick] = React.useState(0)
  React.useEffect(() => {
    let live = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let prev = initial?.phase
    const poll = async () => {
      try {
        const cur = await pollIngest(channelId)
        if (!live) return
        setP(cur)
        setError(null)
        // The server-rendered page shows the videos once the catalog lands and the analysis once it ends.
        if (cur && cur.phase !== prev && (prev === "catalog" || prev == null || cur.phase === "done")) router.refresh()
        prev = cur?.phase
        if (cur?.phase !== "done") timer = setTimeout(poll, 3000)
      } catch (e) {
        if (!live) return
        setError((e as Error).message)
        timer = setTimeout(poll, 10000)
      }
    }
    poll()
    return () => {
      live = false
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, tick])
  return { progress: p, error: error ?? p?.error ?? null, restart: () => setTick((t) => t + 1) }
}

export function progressLabel(p: Progress | null) {
  if (!p || p.phase === "catalog") return "Connected · listing public videos"
  if (p.phase === "stats") return `Connected · reading YouTube Analytics for ${p.total} ${p.total === 1 ? "video" : "videos"}`
  if (p.phase === "curves") return `Connected · retention curves, ${p.done} of ${p.total}`
  return `${p.total} ${p.total === 1 ? "video" : "videos"} analyzed`
}

/** The channel's picture, or its initial when Google's image server won't serve it. */
export function Avatar({ src, name, className }: { src: string | null; name: string; className?: string }) {
  const [broken, setBroken] = React.useState(false)
  if (src && !broken) return <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={cn("size-9 shrink-0 rounded-full object-cover", className)} />
  return <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-pax2-lavender text-sm font-semibold text-pax2-blue", className)}>{name.trim().charAt(0).toUpperCase() || "?"}</span>
}

function Row({ title, thumbnail, progress, error }: { title: string; thumbnail: string | null; progress: Progress | null; error: string | null }) {
  const done = progress?.phase === "done"
  const name = progress?.channel?.title ?? title
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Avatar src={thumbnail} name={name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
        <p className={cn("truncate text-xs", error ? "text-pax2-red-deep" : "text-slate-500")}>{error ?? progressLabel(progress)}</p>
      </div>
      {error ? <TriangleAlert className="size-4 shrink-0 text-pax2-red-deep" /> : done ? <Check className="size-4 shrink-0 text-emerald-600" /> : <Loader2 className="size-4 shrink-0 animate-spin text-pax2-light-blue" />}
    </div>
  )
}

/** A connected channel as a compact chip (lists and links). */
export function ChannelChip({ channelId, title, thumbnail, initial, className }: { channelId: string; title: string; thumbnail: string | null; initial: Progress | null; className?: string }) {
  const { progress, error } = useIngest(channelId, initial)
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white", className)}>
      <Row title={title} thumbnail={thumbnail} progress={progress} error={error} />
    </div>
  )
}

/** A connected channel with its private and unlisted videos behind an accordion: one collapsed
 *  question row, the picker unfolding only when the user opens it. */
export function ChannelCard({ channelId, title, thumbnail, initial, className }: { channelId: string; title: string; thumbnail: string | null; initial: Progress | null; className?: string }) {
  const { progress, error, restart } = useIngest(channelId, initial)
  const [open, setOpen] = React.useState(false)
  const hidden = progress?.hidden ?? 0
  const listed = progress != null && progress.phase !== "catalog"
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white", className)}>
      <Row title={title} thumbnail={thumbnail} progress={progress} error={error} />
      {listed && hidden > 0 && (
        <div className="border-t border-slate-100">
          <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-[15px] text-slate-950 transition-colors hover:bg-slate-50">
            Include unlisted &amp; private videos?
            <ChevronDown className={cn("size-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <div className="px-3 pb-3">
              <Picker channelId={channelId} onCancel={() => setOpen(false)} onSaved={() => (setOpen(false), restart())} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type Vid = Awaited<ReturnType<typeof privateVideos>>[number]

const BOX = "size-[18px] shrink-0 accent-slate-950"

function Picker({ channelId, onCancel, onSaved }: { channelId: string; onCancel: (() => void) | null; onSaved: () => void }) {
  const [videos, setVideos] = React.useState<Vid[] | null>(null)
  const [picked, setPicked] = React.useState<Set<string>>(new Set())
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  React.useEffect(() => {
    privateVideos(channelId)
      .then((v) => {
        setVideos(v)
        setPicked(new Set(v.filter((x) => x.picked).map((x) => x.youtubeId)))
      })
      .catch((e) => setError((e as Error).message))
  }, [channelId])
  const before = new Set(videos?.filter((v) => v.picked).map((v) => v.youtubeId) ?? [])
  const changed = picked.size !== before.size || [...picked].some((id) => !before.has(id))
  const all = !!videos?.length && picked.size === videos.length
  const toggle = (id: string, on: boolean) =>
    setPicked((s) => {
      const n = new Set(s)
      if (on) n.add(id)
      else n.delete(id)
      return n
    })
  const save = async () => {
    setBusy(true)
    try {
      await savePicks(channelId, [...picked])
      onSaved()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }
  if (error) return <p className="text-sm text-pax2-red-deep">{error}</p>
  if (!videos) return <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" />Listing private and unlisted videos</p>
  return (
    <div className="flex flex-col gap-1">
      <label className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5 text-[15px] font-medium text-slate-950 hover:bg-slate-50">
        <input type="checkbox" checked={all} onChange={(e) => setPicked(e.target.checked ? new Set(videos.map((v) => v.youtubeId)) : new Set())} className={BOX} />
        Select all
      </label>
      <ul className="flex max-h-64 flex-col overflow-y-auto">
        {videos.map((v) => (
          <li key={v.youtubeId}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-slate-50">
              <input type="checkbox" checked={picked.has(v.youtubeId)} onChange={(e) => toggle(v.youtubeId, e.target.checked)} className={BOX} />
              {v.thumbnail ? <img src={v.thumbnail} alt="" referrerPolicy="no-referrer" className="h-9 w-16 shrink-0 rounded-md object-cover" /> : <span className="h-9 w-16 shrink-0 rounded-md bg-slate-100" />}
              <span className="min-w-0 flex-1 truncate text-[15px] text-slate-950">{v.title}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-end gap-2">
        {onCancel && <button type="button" onClick={onCancel} className="h-9 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>}
        <button type="button" disabled={busy || !changed} onClick={save} className="h-9 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white disabled:opacity-40">
          {busy ? "Saving" : picked.size || !before.size ? `Include ${picked.size} ${picked.size === 1 ? "video" : "videos"}` : "Leave them all out"}
        </button>
      </div>
    </div>
  )
}
