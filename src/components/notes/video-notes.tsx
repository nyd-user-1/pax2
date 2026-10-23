"use client"

import * as React from "react"
import { PenLine } from "lucide-react"

import { createNote, videoNotes } from "@/app/note-actions"
import { NoteSheet } from "@/components/notes/note-sheet"
import { Skeleton } from "@/ui/components/nova/skeleton"
import type { Note } from "@/lib/notes"

// The Notes tab's cards (Brendan, 2026-10-23), in the scripts catalog's card dress in blue: New note first
// (the dashed card), then the reader's notes on this video, newest edit first, three to a row. Each opens
// in the note window (components/notes/note-sheet.tsx), a markdown editor ported from Leuk.

/** The body's first words, markdown syntax and the title line stripped. */
function snippet(md: string): string {
  const lines = md.split("\n").map((l) => l.trim()).filter(Boolean)
  const text = lines.slice(1).join(" ").replace(/[#*_`>|-]/g, "").replace(/\s+/g, " ").trim()
  return text.length > 110 ? `${text.slice(0, 110)}…` : text
}
const words = (md: string) => md.replace(/[#*_`>|-]/g, " ").split(/\s+/).filter(Boolean).length
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })

export function VideoNotes({ video }: { video: { id: string; title: string } }) {
  const [notes, setNotes] = React.useState<Note[] | null>(null)
  const [kept, setKept] = React.useState(true)
  const [open, setOpen] = React.useState<{ id: string; fresh: boolean } | null>(null)
  const [creating, setCreating] = React.useState(false)

  const load = React.useCallback(() => {
    videoNotes(video.id)
      .then((r) => {
        setNotes(r.notes)
        setKept(r.kept)
      })
      .catch(() => setNotes([]))
  }, [video.id])
  React.useEffect(load, [load])

  const create = async () => {
    setCreating(true)
    try {
      const n = await createNote(video.id)
      if (n) {
        load()
        setOpen({ id: n.id, fresh: true })
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mt-5 grid gap-6 p-1 sm:grid-cols-2 lg:grid-cols-3">
      <button
        type="button"
        onClick={create}
        disabled={!kept || creating}
        className="lift flex flex-col justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 p-5 text-left hover:border-pax2-light-blue/50 disabled:cursor-default disabled:opacity-60"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-pax2-lavender text-pax2-blue">
          <PenLine className="size-4" />
        </span>
        <span className="font-display text-[17px] leading-snug text-slate-900">New note</span>
        <span className="text-[13px] leading-relaxed text-slate-500">{kept ? "Markdown, headings, lists and tables. Type / for the menu." : "Sign in to keep notes on this video."}</span>
      </button>
      {notes === null &&
        [0, 1].map((i) => <Skeleton key={i} className="h-[150px] rounded-2xl" />)}
      {notes?.map((n) => (
        <button key={n.id} type="button" onClick={() => setOpen({ id: n.id, fresh: false })} className="lift surface flex flex-col gap-2 p-5 text-left">
          <span className="flex w-full items-center justify-between gap-2">
            <span className="rounded-full bg-pax2-lavender px-2.5 py-0.5 text-[11px] font-semibold text-pax2-blue">{day(n.updatedAt)}</span>
            <span className="tabular rounded-full px-2 py-0.5 text-xs font-bold text-pax2-blue outline outline-1 outline-slate-200">{words(n.bodyMd)}</span>
          </span>
          <span className="font-display text-[17px] leading-snug text-slate-800">{n.title}</span>
          <span className="line-clamp-2 flex-1 text-[13px] leading-relaxed text-slate-500">{snippet(n.bodyMd)}</span>
          <span className="tabular text-xs text-slate-400">Edited {time(n.updatedAt)}</span>
        </button>
      ))}
      {open && <NoteSheet noteId={open.id} video={video} defaultBig={open.fresh} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  )
}
