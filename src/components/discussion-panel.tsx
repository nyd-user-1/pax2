"use client"

import * as React from "react"
import { ArrowLeft, ChevronRight, Columns2, Columns3, Hash, LayoutGrid, MessagesSquare, X } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

import { Chat } from "@/components/chat/chat"
import { useShellPanel } from "@/components/shell"
import { useShelf, type ShelfBlock } from "@/lib/home-blocks"
import { cn } from "@/ui/lib/utils"
import { whiteButton } from "@/components/white-button"

// 44b's DiscussionPanel (components/DiscussionPanel.tsx), cut to four doors: Blocks, Chat, Slack and
// Discord. Blocks is the shelf after Cloudflare's chat canvas: a handful of shorts, and any block added
// from a page's block menu. A welcome list of rows; each opens its view in the same panel, with Back to the list.
// It sits in the shell's right slot in the take panel's frame, so the two read as one panel.

type View = "welcome" | "blocks" | "chat" | "slack" | "discord"

// The panel moves to its own column when a video's drawer opens beside it (the shell), which remounts
// it; these keep its place through the move: the view it's on and the shelf tile last opened.
let keptView: View = "welcome"
let keptSelected: string | null = null
const TITLE: Record<View, string> = { welcome: "Discussion", blocks: "Blocks", chat: "Chat", slack: "Slack", discord: "Discord" }

function Row({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex w-full items-center gap-3 border-b border-slate-200/70 px-6 py-4 text-left transition-colors hover:bg-white/70">
      <span className="flex size-4 shrink-0 items-center justify-center text-slate-400 group-hover:text-pax2-blue">{icon}</span>
      <span className="flex-1">
        <span className="block text-[15px] font-medium text-slate-900 group-hover:text-pax2-blue">{label}</span>
        <span className="block text-xs text-slate-500">{sub}</span>
      </span>
      <ChevronRight className="size-4 text-slate-400 group-hover:text-pax2-blue" />
    </button>
  )
}

// The canvas, as Cloudflare's chat canvas: the blocks added from any page's block menu and the shelf's
// shorts, in the order they're dragged into, then empty dashed tiles waiting for more. Pressing a block
// opens its page at the block; the panel lives in the shell, beside the page, so it stays where it is.
const TILES = 12
const PLACE = (path: string) => (path === "/" ? "Landing" : path.slice(1).split("/")[0].replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()))

function BlocksShelf() {
  const router = useRouter()
  const path = usePathname()
  const { items, remove, move } = useShelf()
  const [dragging, setDragging] = React.useState<string | null>(null)
  const [over, setOver] = React.useState<string | null>(null)
  // The tile last opened from the shelf wears the feed cards' 1px blue border.
  const [selected, setSelectedState] = React.useState<string | null>(keptSelected)
  const setSelected = (k: string) => setSelectedState((keptSelected = k))
  // A short opens in the video drawer, which comes in left of this panel, between it and the page.
  const play = (id: string) => {
    setSelected(`v:${id}`)
    router.push(`/v/yt-${id}`)
  }
  const open = (b: ShelfBlock) => {
    setSelected(`b:${b.key}`)
    if (b.path === path) document.getElementById(b.anchor)?.scrollIntoView({ behavior: "smooth", block: "start" })
    else router.push(`${b.path}#${b.anchor}`)
  }
  // Each tile drags; dropping on another puts it there, dropping on an empty tile puts it last.
  const drag = (key: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = "move"
      e.dataTransfer.setData("text/plain", key)
      setDragging(key)
    },
    onDragEnd: () => (setDragging(null), setOver(null)),
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault()
      setOver(key)
    },
    onDragLeave: () => setOver((o) => (o === key ? null : o)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      if (dragging) move(dragging, key)
      setDragging(null)
      setOver(null)
    },
  })
  const tile = (key: string) =>
    cn(
      "relative aspect-square cursor-grab overflow-hidden rounded-xl border bg-white shadow-e1 transition-[opacity,box-shadow,border-color] active:cursor-grabbing",
      selected === key ? "border-pax2-blue" : "border-slate-200",
      dragging === key && "opacity-40",
      over === key && dragging !== key && "ring-2 ring-pax2-light-blue",
    )
  return (
    <div className="grid grid-cols-3 gap-2.5 overflow-y-auto px-6 pb-6 pt-1">
      {items.map((it) =>
        it.block ? (
          <div key={it.key} {...drag(it.key)} role="button" tabIndex={0} onClick={() => open(it.block)} onKeyDown={(e) => e.key === "Enter" && open(it.block)} aria-label={`Open ${it.block.title}`} className={cn(tile(it.key), "group flex flex-col justify-between p-2.5 hover:shadow-e2")}>
            <LayoutGrid className="size-4 text-pax2-blue" />
            <span className="min-w-0">
              <span className="line-clamp-3 text-[12px] font-semibold leading-snug text-slate-900">{it.block.title}</span>
              <span className="mt-0.5 block truncate text-[10px] text-slate-500">{PLACE(it.block.path)}</span>
            </span>
            <button
              type="button"
              onClick={(e) => (e.stopPropagation(), remove(it.block.key))}
              aria-label={`Take ${it.block.title} off the shelf`}
              className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-md text-slate-400 opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <div key={it.key} {...drag(it.key)} role="button" tabIndex={0} onClick={() => play(it.video.id)} onKeyDown={(e) => e.key === "Enter" && play(it.video.id)} aria-label={`Play ${it.video.title}`} className={tile(it.key)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://i.ytimg.com/vi/${it.video.id}/hqdefault.jpg`} alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 to-transparent px-2 pb-1.5 pt-6">
              <span className="line-clamp-2 text-[11px] font-semibold leading-snug text-white">{it.video.title}</span>
            </span>
            <span className="absolute right-1.5 top-1.5 rounded-md bg-slate-950/70 px-1 py-0.5 font-mono text-[10px] text-white">{it.video.duration}</span>
          </div>
        ),
      )}
      {Array.from({ length: Math.max(0, TILES - items.length) }, (_, i) => (
        <div
          key={i}
          aria-hidden
          onDragOver={(e) => (e.preventDefault(), setOver(`empty-${i}`))}
          onDragLeave={() => setOver((o) => (o === `empty-${i}` ? null : o))}
          onDrop={(e) => {
            e.preventDefault()
            if (dragging) move(dragging, null)
            setDragging(null)
            setOver(null)
          }}
          className={cn("aspect-square rounded-xl border border-dashed transition-colors", over === `empty-${i}` ? "border-pax2-light-blue bg-pax2-lavender/40" : "border-slate-300")}
        />
      ))}
    </div>
  )
}

export function DiscussionPanel({ onClose: close }: { onClose: () => void }) {
  const { wide, setWide } = useShellPanel()
  const [view, setViewState] = React.useState<View>(keptView)
  const setView = (v: View) => setViewState((keptView = v))
  // Closing starts the next opening fresh, on the list.
  const onClose = () => {
    keptView = "welcome"
    keptSelected = null
    close()
  }
  return (
    <section className="fixed inset-0 z-50 flex flex-col bg-pax2-mist md:static md:z-auto md:h-full md:overflow-hidden md:rounded-2xl md:border md:border-slate-500 md:shadow-e2">
      <div className="relative z-10 flex min-h-[73px] shrink-0 items-center justify-between gap-3 bg-pax2-mist px-6 py-4">
        <div className="flex min-w-0 items-center gap-2">
          {view !== "welcome" && (
            <button type="button" onClick={() => setView("welcome")} aria-label="Back" className="-ml-2 flex size-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-white hover:text-pax2-blue">
              <ArrowLeft className="size-4" />
            </button>
          )}
          <p className="truncate font-display text-xl text-slate-900">{TITLE[view]}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => setWide(!wide)} className={whiteButton("circle", "hidden md:inline-flex")} aria-label={wide ? "Narrow the panel" : "Widen the panel"}>
            {wide ? <Columns3 className="size-4" /> : <Columns2 className="size-4" />}
          </button>
          <button type="button" onClick={onClose} className={whiteButton("circle")} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className={cn("flex min-h-0 flex-1 flex-col", view === "welcome" && "overflow-y-auto")}>
        {view === "welcome" && (
          <div className="border-t border-slate-200/70">
            <Row icon={<LayoutGrid className="size-4" />} label="Blocks" sub="Shorts and blocks you've saved" onClick={() => setView("blocks")} />
            <Row icon={<MessagesSquare className="size-4" />} label="Chat" sub="Ask about the scores, scripts and results" onClick={() => setView("chat")} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Row icon={<img src="/logos/slack.png" alt="" className="size-4 object-contain" />} label="Slack" sub="Not connected" onClick={() => setView("slack")} />
            <Row icon={<Hash className="size-4" />} label="Discord" sub="Not connected" onClick={() => setView("discord")} />
          </div>
        )}
        {view === "blocks" && <BlocksShelf />}
        {view === "chat" && <Chat compact />}
        {(view === "slack" || view === "discord") && <p className="px-6 py-6 text-sm text-slate-500">{TITLE[view]} is not connected to this workspace yet.</p>}
      </div>
    </section>
  )
}
