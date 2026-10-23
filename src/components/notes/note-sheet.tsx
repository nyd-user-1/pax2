"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { Copy, EllipsisVertical, Loader2, MessagesSquare, NotebookPen, Trash2, X } from "lucide-react"

import { openNote, removeNote, saveNote } from "@/app/note-actions"
import { KebabMenu, MenuRow, MenuSeparator } from "@/components/kebab-menu"
import { NotesEditor, type NotesEditorHandle } from "@/components/notes/notes-editor"
import { useShellPanel } from "@/components/shell"
import type { Note } from "@/lib/notes"
import { Button } from "@/ui/components/nova/button"
import { cn } from "@/ui/lib/utils"

// Ported from Leuk's NoteSheet (components/notes/note-sheet.tsx, 2026-10-23) in pax2 blue: a
// Gmail-compose-style floating document window. A navy title strip (minimize · expand/restore · close),
// the video and the note's date over the editor, Save on the right, and a page-like markdown editor with a
// hover menu on the sheet (Ask PAX, Copy as Markdown, Delete). Three sizes, all from the title strip:
// compact (default, docked bottom-right), big (~1200px, centered on a scrim) and minimized (the strip
// alone). Leuk's clinical parts (sign, lock, amendments, the session transcript rail) stay behind.

// Diagonal outward arrows: expand to the big size.
const ExpandIcon = () => (
  <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="15 4 20 4 20 9" />
    <line x1="20" y1="4" x2="14" y2="10" />
    <polyline points="9 20 4 20 4 15" />
    <line x1="4" y1="20" x2="10" y2="14" />
  </svg>
)

// Diagonal inward arrows: restore the big size to compact.
const RestoreIcon = () => (
  <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="9 4 9 9 4 9" />
    <line x1="9" y1="9" x2="3" y2="3" />
    <polyline points="15 20 15 15 20 15" />
    <line x1="15" y1="15" x2="21" y2="21" />
  </svg>
)

// A single dash: minimize.
const MinimizeIcon = () => (
  <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const STRIP_BUTTON = "inline-flex size-8 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white"
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })

export function NoteSheet({
  noteId,
  video,
  onClose,
  onChanged,
  defaultBig = false,
}: {
  noteId: string
  /** The video the note is on, for the header link. */
  video: { id: string; title: string }
  onClose: () => void
  /** Called after save and delete so the cards refresh. */
  onChanged?: () => void
  /** Open at the big size: a new note starts expanded. */
  defaultBig?: boolean
}) {
  const { askAbout } = useShellPanel()
  const editorRef = React.useRef<NotesEditorHandle>(null)
  const [note, setNote] = React.useState<Note | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [bodyMd, setBodyMd] = React.useState("")
  const [dirty, setDirty] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [minimized, setMinimized] = React.useState(false)
  const [big, setBig] = React.useState(defaultBig)
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  React.useEffect(() => {
    let alive = true
    openNote(noteId)
      .then((n) => {
        if (!alive) return
        if (!n) return setError("This note could not be opened.")
        setNote(n)
        setBodyMd(n.bodyMd)
      })
      .catch(() => alive && setError("This note could not be opened."))
    return () => {
      alive = false
    }
  }, [noteId])

  const save = React.useCallback(async (): Promise<boolean> => {
    if (!note) return true
    setSaving(true)
    try {
      const n = await saveNote(note.id, bodyMd)
      if (!n) throw new Error("Save failed")
      setNote(n)
      setDirty(false)
      onChanged?.()
      return true
    } catch {
      setError("Save failed. The text is still here; try again.")
      return false
    } finally {
      setSaving(false)
    }
  }, [note, bodyMd, onChanged])

  // Closing keeps the words: unsaved changes save first.
  const close = async () => {
    if (dirty && !(await save())) return
    onClose()
  }

  async function remove() {
    if (!note) return
    await removeNote(note.id)
    onChanged?.()
    onClose()
  }

  const ask = () => {
    const picked = editorRef.current?.getSelectionText() ?? ""
    const text = (picked || bodyMd).slice(0, 8000)
    askAbout({ context: () => `ACTIVE CONTEXT — the user is writing a note on the short "${video.title}" (/v/yt-${video.id}) and asks about ${picked ? "this passage" : "the note"}:\n${text}`, chipVideo: video.id })
  }

  if (!mounted) return null
  const title = note?.title && note.title !== "Untitled note" ? note.title : "New note"

  // Minimized: the title strip alone, docked bottom-right. Click it to reopen at its last size.
  if (minimized)
    return createPortal(
      <div className="fixed bottom-0 right-4 z-50 w-full max-w-xs overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-e3 sm:right-6 sm:max-w-sm">
        <div className="flex h-11 w-full items-center justify-between gap-2 bg-pax2-blue pl-3 pr-1">
          <button type="button" onClick={() => setMinimized(false)} aria-label="Restore note" className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <NotebookPen className="size-[15px] shrink-0 text-white/80" />
            <span className="truncate text-[13px] font-medium text-white/90">{title}</span>
            {dirty && <span className="shrink-0 text-[11px] text-white/60">· unsaved</span>}
          </button>
          <span className="flex shrink-0 items-center gap-0.5">
            <button type="button" onClick={() => setMinimized(false)} aria-label="Restore note" className={STRIP_BUTTON}>
              <RestoreIcon />
            </button>
            <button type="button" onClick={close} aria-label="Close note" className={STRIP_BUTTON}>
              <X className="size-4" />
            </button>
          </span>
        </div>
      </div>,
      document.body,
    )

  // Compact: Gmail-compose size, no scrim, the page stays live around it. Big: centered on a scrim.
  const sizeClasses = big
    ? "inset-0 m-auto h-[85vh] max-h-[860px] w-[92vw] max-w-[1200px] rounded-2xl"
    : "bottom-0 right-4 sm:right-6 h-[560px] max-h-[80vh] w-full max-w-[520px] rounded-t-2xl"

  return createPortal(
    <>
      {big && <div className="fixed inset-0 z-40 bg-slate-950/40" aria-hidden onClick={() => setBig(false)} />}
      <div className={cn("fixed z-50 flex flex-col overflow-hidden border border-slate-200 bg-white shadow-e3 transition-[width,height,border-radius] duration-200 animate-in fade-in slide-in-from-bottom-4", sizeClasses)}>
        <div className="flex h-11 shrink-0 items-center justify-between gap-1 bg-pax2-blue pl-3 pr-1">
          <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-white/90">
            <NotebookPen className="size-[15px] shrink-0" />
            <span className="truncate">Note</span>
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            <button type="button" onClick={() => setMinimized(true)} aria-label="Minimize note" className={STRIP_BUTTON}>
              <MinimizeIcon />
            </button>
            <button type="button" onClick={() => setBig((b) => !b)} aria-label={big ? "Restore note" : "Expand note"} className={STRIP_BUTTON}>
              {big ? <RestoreIcon /> : <ExpandIcon />}
            </button>
            <button type="button" onClick={close} aria-label="Close note" className={STRIP_BUTTON}>
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-white">
          {error && <p className="px-6 pt-4 text-center text-sm text-below">{error}</p>}
          {!note && !error && (
            <div className="flex flex-1 items-center justify-center text-pax2-blue">
              <Loader2 className="size-7 animate-spin" />
            </div>
          )}
          {note && (
            <>
              {/* The video over the note's date, Save on the right. */}
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-6 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pax2-lavender text-pax2-blue">
                  <NotebookPen className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/v/yt-${video.id}`} className="block max-w-full truncate text-[15px] font-semibold text-slate-900 hover:text-pax2-blue">
                    {video.title}
                  </Link>
                  <p className="text-[13px] text-slate-500">Note · {when(note.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden text-[13px] text-slate-500 sm:block">{saving ? "Saving…" : dirty ? "Unsaved changes" : "Saved changes"}</span>
                  <Button size="sm" onClick={save} disabled={saving || !dirty}>
                    Save
                  </Button>
                </div>
              </div>

              <main className="min-h-0 flex-1 overflow-y-auto">
                {/* One continuous white sheet: the editor and its canvas are the same page. */}
                <div className="group relative mx-auto flex min-h-[70%] max-w-3xl flex-col bg-white px-8 py-6">
                  <div className="absolute right-3 top-3 z-10 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 has-[[aria-expanded=true]]:opacity-100">
                    <KebabMenu label="Note options" trigger={<EllipsisVertical className="size-4" />} triggerClassName="inline-flex size-8 items-center justify-center rounded-md text-slate-800 outline-none hover:bg-muted aria-expanded:bg-muted">
                      <MenuRow icon={<MessagesSquare />} label="Ask PAX" onClick={ask} />
                      <MenuRow icon={<Copy />} label="Copy as Markdown" onClick={() => void navigator.clipboard?.writeText(bodyMd)} />
                      <MenuSeparator />
                      <MenuRow icon={<Trash2 />} label="Delete note" danger onClick={remove} />
                    </KebabMenu>
                  </div>
                  <NotesEditor
                    key={note.id}
                    ref={editorRef}
                    value={bodyMd}
                    autoFocus
                    placeholder="Write, or type / for headings, lists and tables…"
                    onChange={(md) => {
                      setBodyMd(md)
                      setDirty(true)
                    }}
                    onSave={save}
                  />
                </div>
              </main>
            </>
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}
