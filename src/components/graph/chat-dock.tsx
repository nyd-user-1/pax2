"use client"

import { useState } from "react"
import { MessageSquare, Paperclip, X } from "lucide-react"

import { Chat } from "@/components/chat/chat"
import { ENTITY_MIME, readDragEntity, type DragEntity } from "@/lib/drag-entity"
import { whiteButton } from "@/components/white-button"
import { cn } from "@/ui/lib/utils"

// The canvas's chat, after NSR's ChatDock: the same Chat as /chat in compact mode, aware of what
// is on the canvas through `context`. Drop a card, rail row or search hit on it (or pick Ask in
// chat) and that entity is attached: a banner above the input, its record prepended to the
// context of every message until cleared.

const DROP = "border-2 border-dashed border-pax2-light-blue"

export function ChatDock({ context, open, onOpenChange, attached, onAttach }: {
  context: () => string
  open: boolean
  onOpenChange: (o: boolean) => void
  attached: DragEntity | null
  onAttach: (g: DragEntity | null) => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const accepts = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(ENTITY_MIME)) return
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }
  const drop = (e: React.DragEvent) => {
    const g = readDragEntity(e.dataTransfer)
    if (!g) return
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    onAttach(g)
    onOpenChange(true)
  }

  if (!open)
    return (
      <button
        onClick={() => onOpenChange(true)}
        onDragOver={accepts}
        onDragLeave={() => setDragOver(false)}
        onDrop={drop}
        className={whiteButton("md", "absolute bottom-4 right-4 z-10 h-8 px-3.5 py-0 text-[13px]", dragOver && DROP)}
      >
        <MessageSquare className="h-3.5 w-3.5" /> Chat
      </button>
    )

  return (
    <div
      onDragOver={accepts}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as globalThis.Node | null)) setDragOver(false) }}
      onDrop={drop}
      className={cn("absolute bottom-4 right-4 z-10 flex h-[32rem] max-h-[calc(100%-2rem)] w-[28rem] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-e2", dragOver && DROP)}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-2">
        <p className="text-sm font-semibold text-slate-900">Chat</p>
        <button onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-slate-900" aria-label="Close"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <Chat
          compact
          context={context}
          attachment={attached && (
            <div className="-mb-3 flex items-center gap-1.5 rounded-t-2xl border border-b-0 border-slate-200 bg-pax2-mist px-4 pb-4 pt-2 text-[11px] text-slate-500">
              <Paperclip className="h-3 w-3 shrink-0" />
              <span className="shrink-0 uppercase tracking-wide">{attached.type}</span>
              <span className="truncate text-slate-900">{attached.label}</span>
              <button onClick={() => onAttach(null)} className="ml-auto shrink-0 hover:text-slate-900" aria-label="Clear"><X className="h-3 w-3" /></button>
            </div>
          )}
        />
      </div>
    </div>
  )
}
