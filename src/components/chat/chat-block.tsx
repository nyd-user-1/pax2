"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowUpRight, LayoutGrid, Loader2 } from "lucide-react"

import { useShelf } from "@/lib/home-blocks"
import { cn } from "@/ui/lib/utils"

// A block the chat answers with: the reply names it as [[block:/path#anchor]], and it renders here as the
// block stands on its page right now (read through /api/block-context), framed with its way back to the
// page and onto the Blocks shelf. A snapshot: the block's text, tables and drawn charts show; a chart
// painted on a canvas, and the block's own buttons, wait for the page.

export const BLOCK_REF = /\[\[block:(\/[^\]#\s]*)#([\w-]+)\]\]/g

export function ChatBlock({ path, anchor }: { path: string; anchor: string }) {
  const router = useRouter()
  const { add, has } = useShelf()
  const [state, setState] = React.useState<{ html?: string; error?: string }>({})
  React.useEffect(() => {
    let alive = true
    fetch("/api/block-context", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, anchor, html: true }) })
      .then((r) => r.json() as Promise<{ html?: string; error?: string }>)
      .then((j) => alive && setState(j))
      .catch((e) => alive && setState({ error: (e as Error).message }))
    return () => {
      alive = false
    }
  }, [path, anchor])
  const key = `${path}#${anchor}`
  const title = anchor.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase())
  const onShelf = has(key)
  return (
    <figure className="my-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-[12px] text-slate-500">
        <LayoutGrid className="size-3.5 text-pax2-blue" />
        <span className="font-mono">{key}</span>
        <span className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => add({ key, title, path, anchor })} disabled={onShelf} className="rounded-md px-2 py-1 font-medium text-slate-600 transition-colors hover:bg-white hover:text-pax2-blue disabled:text-slate-400">
            {onShelf ? "On the shelf" : "Add to Blocks"}
          </button>
          <button type="button" onClick={() => router.push(`${path}#${anchor}`)} className="flex items-center gap-1 rounded-md px-2 py-1 font-medium text-slate-600 transition-colors hover:bg-white hover:text-pax2-blue">
            Open <ArrowUpRight className="size-3.5" />
          </button>
        </span>
      </div>
      <div className={cn("max-h-[480px] overflow-auto p-3 text-sm", !state.html && "flex items-center justify-center py-10")}>
        {state.html ? (
          <div className="pointer-events-none [&_[data-slot=card]]:!h-auto [&_[data-slot=card-footer]]:hidden" dangerouslySetInnerHTML={{ __html: state.html }} />
        ) : state.error ? (
          <span className="text-slate-500">{state.error}</span>
        ) : (
          <Loader2 className="size-5 animate-spin text-slate-400" />
        )}
      </div>
    </figure>
  )
}
