"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { createPortal } from "react-dom"
import { Archive, ArchiveRestore, ChevronDown, ChevronRight, EllipsisVertical, Eye, EyeOff, Link2, Pencil, SlidersHorizontal, Star } from "lucide-react"

import { myChats, updateChat } from "@/app/chat-actions"
import { KebabMenu, MenuFoot, MenuHeader, MenuRow, MenuSeparator } from "@/components/kebab-menu"
import type { ChatMeta } from "@/lib/chats"
import { cn } from "@/ui/lib/utils"

// The sidebar's lower half: the reader's saved /chat conversations, newest first. Ported from Code/hq's
// Recents (app/ui/sidebar-recents.tsx) in the sidebar's own dress: rows truncate to one line, the
// whole title and its age show on hover, and each row's actions sit behind its kebab (Favorite, Rename,
// Hide, Archive). The sliders group the list by date or not at all; hidden chats show on request, and
// archived ones fold into their own group at the foot. Chat sends `pax2:chats` after each save.

type GroupBy = "none" | "date"
const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "none", label: "None" },
  { value: "date", label: "Date" },
]
const STORAGE_KEY = "pax2:chats-group"

function dateBucket(ts: number, now: number): string {
  const d = new Date(now)
  const startOfToday = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  if (ts >= startOfToday) return "Today"
  if (ts >= startOfToday - 86_400_000) return "Yesterday"
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** Buckets the newest-first list. Ungrouped, favorites lead; grouped, each bucket keeps its order and
 *  the star marks the favorites. */
function groupChats(chats: ChatMeta[], mode: GroupBy): { label: string; chats: ChatMeta[] }[] {
  if (mode === "none") return [{ label: "", chats: [...chats].sort((a, b) => Number(b.favorite) - Number(a.favorite)) }]
  const map = new Map<string, ChatMeta[]>()
  for (const c of chats) {
    const k = dateBucket(Date.parse(c.updatedAt), Date.now())
    map.set(k, [...(map.get(k) ?? []), c])
  }
  return [...map.entries()].map(([label, chats]) => ({ label, chats }))
}

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000)
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`
  if (s < 30 * 86_400) return `${Math.floor(s / 86_400)}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-slate-400"

export function SidebarChats() {
  const path = usePathname()
  const params = useSearchParams()
  const current = path === "/chat" ? params.get("c") : null
  const [chats, setChats] = React.useState<ChatMeta[]>([])
  const [loaded, setLoaded] = React.useState(false)
  const [groupBy, setGroupBy] = React.useState<GroupBy>("date")
  const [showHidden, setShowHidden] = React.useState(false)
  const [showArchived, setShowArchived] = React.useState(false)
  const [editing, setEditing] = React.useState<string | null>(null)
  const [editValue, setEditValue] = React.useState("")
  const [tip, setTip] = React.useState<{ x: number; y: number; text: string } | null>(null)

  React.useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === "date" || saved === "none") setGroupBy(saved)
  }, [])

  React.useEffect(() => {
    let alive = true
    const load = () =>
      myChats()
        .then((xs) => {
          if (!alive) return
          setChats(xs)
          setLoaded(true)
        })
        .catch(() => {})
    load()
    window.addEventListener("pax2:chats", load)
    window.addEventListener("focus", load)
    return () => {
      alive = false
      window.removeEventListener("pax2:chats", load)
      window.removeEventListener("focus", load)
    }
  }, [])

  const choose = (v: GroupBy) => {
    setGroupBy(v)
    try {
      localStorage.setItem(STORAGE_KEY, v)
    } catch {}
  }

  // Optimistic local patch, then the write; the next load reconciles with what was stored.
  const patch = (id: string, p: Partial<Pick<ChatMeta, "title" | "favorite" | "hidden" | "archived">>) => {
    setChats((xs) => xs.map((c) => (c.id === id ? { ...c, ...p } : c)))
    updateChat(id, p).catch(() => {})
  }
  const commitEdit = (c: ChatMeta) => {
    const title = editValue.trim()
    if (title && title !== c.title) patch(c.id, { title })
    setEditing(null)
  }

  const archived = chats.filter((c) => c.archived)
  const live = chats.filter((c) => !c.archived)
  const hiddenCount = live.filter((c) => c.hidden).length
  const visible = showHidden ? live : live.filter((c) => !c.hidden)
  const groups = groupChats(visible, groupBy)

  const renderRow = (c: ChatMeta) => {
    const on = c.id === current
    const href = `/chat?c=${c.id}`
    if (editing === c.id)
      return (
        <div key={c.id} className="flex items-center rounded-xl bg-white shadow-e1">
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit(c)
              if (e.key === "Escape") setEditing(null)
            }}
            onBlur={() => setEditing(null)}
            placeholder="Name this chat"
            aria-label="Name this chat"
            className="min-w-0 flex-1 bg-transparent px-3 py-1.5 text-[13px] text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
      )
    return (
      <div
        key={c.id}
        onMouseEnter={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setTip({ x: r.right + 8, y: r.top + r.height / 2, text: `${c.title} · ${ago(c.updatedAt)}` })
        }}
        onMouseLeave={() => setTip(null)}
        className={cn("group/item relative flex items-center rounded-xl transition-[color,background-color,box-shadow]", on ? "bg-white shadow-e1" : "hover:bg-white/70 hover:shadow-e1", c.hidden && "opacity-50")}
      >
        {on && <span aria-hidden className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-pax2-light-blue" />}
        <Link href={href} aria-current={on ? "page" : undefined} onClick={() => setTip(null)} className={cn("min-w-0 flex-1 truncate py-1.5 pl-3 text-[13px] outline-none", on ? "font-semibold text-pax2-blue" : "text-slate-500 group-hover/item:text-pax2-blue")}>
          {c.title}
        </Link>
        {c.favorite && <Star aria-label="Favorite" className="ml-1 size-3 shrink-0 fill-amber-400 text-amber-400" />}
        <KebabMenu
          label={`${c.title} options`}
          align="left"
          width="w-56"
          trigger={<EllipsisVertical className="size-4" />}
          triggerClassName="mr-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-slate-400 opacity-0 transition-opacity hover:bg-white hover:text-pax2-blue focus-visible:opacity-100 group-hover/item:opacity-100 aria-expanded:bg-white aria-expanded:opacity-100"
        >
          <MenuHeader text={href} copy={href} />
          <MenuSeparator />
          <MenuRow icon={<Star className={c.favorite ? "fill-amber-400 text-amber-400" : undefined} />} label={c.favorite ? "Unfavorite" : "Favorite"} onClick={() => patch(c.id, { favorite: !c.favorite })} />
          <MenuRow
            icon={<Pencil />}
            label="Rename"
            onClick={() => {
              setEditValue(c.title)
              setEditing(c.id)
            }}
          />
          <MenuRow icon={<Link2 />} label="Copy link" onClick={() => navigator.clipboard.writeText(`${window.location.origin}${href}`)} />
          <MenuRow icon={c.hidden ? <Eye /> : <EyeOff />} label={c.hidden ? "Unhide" : "Hide"} onClick={() => patch(c.id, { hidden: !c.hidden })} />
          <MenuRow icon={c.archived ? <ArchiveRestore /> : <Archive />} label={c.archived ? "Unarchive" : "Archive"} onClick={() => patch(c.id, { archived: !c.archived })} />
          <MenuSeparator />
          <MenuFoot title={c.title} sub={`Started ${new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${ago(c.updatedAt)}`} />
        </KebabMenu>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      {/* The first group's label sits beside the grouping control, so no separate heading repeats it. */}
      <div className="flex items-center justify-between px-3">
        <span className={LABEL}>{groups[0]?.label || "Chats"}</span>
        <KebabMenu
          label="Group chats"
          align="left"
          width="w-44"
          trigger={<SlidersHorizontal className="size-3.5" />}
          triggerClassName={cn("flex size-6 items-center justify-center rounded-md transition-colors hover:bg-white hover:text-pax2-blue aria-expanded:bg-white", groupBy !== "none" ? "text-slate-500" : "text-slate-400")}
        >
          <p className={cn(LABEL, "px-2.5 py-1")}>Group by</p>
          {GROUP_OPTIONS.map((o) => (
            <MenuRow key={o.value} label={o.label} checked={groupBy === o.value} onClick={() => choose(o.value)} />
          ))}
          {hiddenCount > 0 && (
            <>
              <MenuSeparator />
              <MenuRow icon={showHidden ? <EyeOff /> : <Eye />} label={showHidden ? "Hide hidden" : `Show hidden (${hiddenCount})`} onClick={() => setShowHidden((v) => !v)} />
            </>
          )}
        </KebabMenu>
      </div>

      {loaded && chats.length === 0 ? (
        <p className="px-3 text-[13px] text-slate-400">No chats yet.</p>
      ) : (
        <div className="no-scrollbar mt-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {groups.map((g, gi) => (
            <div key={g.label || `g${gi}`} className="flex flex-col gap-0.5">
              {gi > 0 && g.label && <span className={cn(LABEL, "px-3 pb-0.5 pt-1")}>{g.label}</span>}
              {g.chats.map(renderRow)}
            </div>
          ))}
          {archived.length > 0 && (
            <div className="mt-1 flex flex-col gap-0.5 border-t border-slate-200/70 pt-1">
              <button type="button" onClick={() => setShowArchived((v) => !v)} aria-expanded={showArchived} className={cn(LABEL, "flex items-center gap-1.5 px-3 py-1 text-left transition-colors hover:text-pax2-blue")}>
                {showArchived ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                <Archive className="size-3" />
                Archived · {archived.length}
              </button>
              {showArchived && archived.map(renderRow)}
            </div>
          )}
        </div>
      )}

      {/* The whole title and its age, to the right of the row; portaled so the sidebar can't clip it. */}
      {tip &&
        createPortal(
          <div role="tooltip" style={{ top: tip.y, left: tip.x }} className="pointer-events-none fixed z-[100] max-w-80 -translate-y-1/2 truncate rounded-lg bg-white px-2.5 py-1 text-xs text-slate-700 shadow-e2 ring-1 ring-slate-200">
            {tip.text}
          </div>,
          document.body,
        )}
    </div>
  )
}
