"use client"

import * as React from "react"
import { Check, ChevronRight, Copy } from "lucide-react"

import { FoldCard } from "@/components/dash/fold-card"
import { cn } from "@/ui/lib/utils"

export type Todo = { title: string; detail?: string; who: "Brendan" | null; done?: boolean }

// GovBlock's To Do card (components/admin/blocks/todo-card.tsx), in PAX: one row per open item,
// the detail beneath with a copy button, Brendan's items marked as his.

function Row({ t, n }: { t: Todo; n: number }) {
  const [open, setOpen] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  return (
    <div className="rounded-md border bg-card">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left">
        <span title={t.done ? "done" : t.who ? "Brendan" : "open"} className={cn("size-4 shrink-0 rounded-[3px] border", t.done ? "border-pax-plum bg-pax-lavender" : t.who ? "border-pax-red bg-pax-red-soft" : "border-slate-300")} />
        <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{n}.</span>
        <span className={cn("min-w-0 flex-1 text-sm", t.done && "text-muted-foreground line-through")}>{t.title}</span>
        {t.who && <span className="shrink-0 rounded bg-pax-red-soft px-1.5 font-mono text-[10px] text-pax-red-deep">{t.who}</span>}
      </button>
      {open && t.detail && (
        <div className="border-t px-3.5 py-3">
          <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground/90">{t.detail}</pre>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(`${t.title}\n\n${t.detail}`)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm hover:bg-muted"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </div>
  )
}

export function TodoCard({ items }: { items: Todo[] }) {
  return (
    <FoldCard title="To Do" rows={items.map((t) => ({ title: t.title, status: t.done ? "done" : t.who ? "Brendan" : "open", detail: t.detail ?? "" }))} name="to-do">
      <div className="flex flex-col gap-2">
        {items.map((t, i) => (
          <Row key={t.title} t={t} n={i + 1} />
        ))}
      </div>
    </FoldCard>
  )
}
