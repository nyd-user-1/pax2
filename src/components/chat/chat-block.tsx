"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowUpRight, LayoutGrid, Loader2 } from "lucide-react"

import { useShelf } from "@/lib/home-blocks"

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
  // The snapshot is the block itself; its own controls are only pictures of buttons, so they are hidden,
  // and the two that work here sit where they stood: onto the shelf, and back to the page.
  const action = "inline-flex size-8 items-center justify-center rounded-md text-slate-800 transition-colors hover:bg-muted hover:text-foreground disabled:text-pax2-light-blue [&_svg]:size-4"
  return (
    <figure className="relative my-4 animate-in fade-in slide-in-from-bottom-1 duration-300">
      {state.html ? (
        <>
          <div
            className="pointer-events-none [&_[data-slot=card-action]]:invisible [&_[data-slot=card-footer]]:hidden [&_[data-slot=card-header]_button]:hidden [&_[data-slot=card]]:!h-auto [&_[data-slot=card]]:max-h-[520px] [&_[data-slot=card-content]]:overflow-hidden"
            dangerouslySetInnerHTML={{ __html: state.html }}
          />
          <span className="absolute right-3 top-3 flex items-center gap-0.5">
            <button type="button" aria-label={onShelf ? "On the Blocks shelf" : "Add to Blocks"} title={onShelf ? "On the Blocks shelf" : "Add to Blocks"} onClick={() => add({ key, title, path, anchor })} disabled={onShelf} className={action}>
              <LayoutGrid />
            </button>
            <button type="button" aria-label="Open on its page" title="Open on its page" onClick={() => router.push(`${path}#${anchor}`)} className={action}>
              <ArrowUpRight />
            </button>
          </span>
        </>
      ) : (
        <div className="flex items-center justify-center rounded-xl bg-card py-10 text-sm ring-1 ring-foreground/10">
          {state.error ? <span className="text-slate-500">{state.error}</span> : <Loader2 className="size-5 animate-spin text-slate-400" />}
        </div>
      )}
    </figure>
  )
}
