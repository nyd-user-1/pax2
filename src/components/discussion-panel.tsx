"use client"

import * as React from "react"
import { ArrowLeft, ChevronRight, Columns2, Columns3, Hash, MessagesSquare, X } from "lucide-react"

import { Chat } from "@/components/chat/chat"
import { useShellPanel } from "@/components/shell"
import { cn } from "@/ui/lib/utils"
import { whiteButton } from "@/components/white-button"

// 44b's DiscussionPanel (components/DiscussionPanel.tsx), cut to three doors: Chat, Slack and
// Discord. A welcome list of rows; each opens its view in the same panel, with Back to the list.
// It sits in the shell's right slot in the take panel's frame, so the two read as one panel.

type View = "welcome" | "chat" | "slack" | "discord"
const TITLE: Record<View, string> = { welcome: "Discussion", chat: "Chat", slack: "Slack", discord: "Discord" }

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

export function DiscussionPanel({ onClose }: { onClose: () => void }) {
  const { wide, setWide } = useShellPanel()
  const [view, setView] = React.useState<View>("welcome")
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
            <Row icon={<MessagesSquare className="size-4" />} label="Chat" sub="Ask about the scores, scripts and results" onClick={() => setView("chat")} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Row icon={<img src="/logos/slack.png" alt="" className="size-4 object-contain" />} label="Slack" sub="Not connected" onClick={() => setView("slack")} />
            <Row icon={<Hash className="size-4" />} label="Discord" sub="Not connected" onClick={() => setView("discord")} />
          </div>
        )}
        {view === "chat" && <Chat compact />}
        {(view === "slack" || view === "discord") && <p className="px-6 py-6 text-sm text-slate-500">{TITLE[view]} is not connected to this workspace yet.</p>}
      </div>
    </section>
  )
}
