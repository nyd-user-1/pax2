"use client"

import * as React from "react"
import { ArrowLeft, ArrowUp, ChevronRight, Hash, Loader2, Lock, MessagesSquare } from "lucide-react"

import { listDiscordChannels, listDiscordThreads, listSlackChannels, readDiscord, readSlack, sendDiscord, sendSlack, type Result } from "@/app/connect-actions"
import { mockSource } from "@/components/connect-mock"

// The side panel's Slack and Discord views, after 44b's review-channel stream (components/SamsStreams.tsx):
// the channels, then a channel's messages, read again every 15 seconds while open, with a box to post.
// A Discord forum opens to its posts first. Everything goes through connect-actions, admins only. Until a
// service is connected, `mock` fills the same views from connect-mock.ts, posting off, over an Integration
// pending footer.

const POLL_MS = 15_000

type Service = "slack" | "discord"
export type Item = { id: string; name: string; icon: "hash" | "lock" | "forum"; sub?: string }
export type Message = { id: string; text: string; author: string; avatar: string | null; at: string }
/** Where a view's lists and messages come from; `send` is null where posting is off. */
export type Source = {
  items: (forum?: string) => Promise<Result<Item[]>>
  read: (id: string) => Promise<Result<Message[]>>
  send: ((id: string, text: string, parent?: string) => Promise<Result<null>>) | null
}
type Step = { kind: "list"; forum?: Item } | { kind: "stream"; item: Item; parent?: string }

const ICON = { hash: Hash, lock: Lock, forum: MessagesSquare }

async function items(service: Service, forum?: string): Promise<Result<Item[]>> {
  if (service === "slack") {
    const r = await listSlackChannels()
    return r.ok ? { ok: true, data: r.data.map((c) => ({ id: c.id, name: c.name, icon: c.private ? "lock" : "hash" })) } : r
  }
  if (forum) {
    const r = await listDiscordThreads(forum)
    return r.ok ? { ok: true, data: r.data.map((t) => ({ id: t.id, name: t.name, icon: "hash", sub: `${t.count} ${t.count === 1 ? "reply" : "replies"}` })) } : r
  }
  const r = await listDiscordChannels()
  return r.ok ? { ok: true, data: r.data.map((c) => ({ id: c.id, name: c.name, icon: c.forum ? "forum" : "hash" })) } : r
}

const liveSource = (service: Service): Source => ({
  items: (forum) => items(service, forum),
  read: (id) => (service === "slack" ? readSlack(id) : readDiscord(id)),
  send: (id, text, parent) => (service === "slack" ? sendSlack(id, text) : sendDiscord(id, text, parent)),
})

const when = (iso: string) => {
  const d = new Date(iso)
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`
}

function Line({ children }: { children: React.ReactNode }) {
  return <p className="px-6 py-6 text-sm text-slate-500">{children}</p>
}

function List({ source, forum, onOpen }: { source: Source; forum?: Item; onOpen: (it: Item) => void }) {
  const [state, setState] = React.useState<Result<Item[]> | null>(null)
  React.useEffect(() => {
    let live = true
    setState(null)
    source.items(forum?.id).then((r) => live && setState(r))
    return () => {
      live = false
    }
  }, [source, forum?.id])
  if (!state) return <Loader2 className="mx-6 my-6 size-5 animate-spin text-pax2-blue" />
  if (!state.ok) return <Line>{state.error}</Line>
  if (!state.data.length) return <Line>{forum ? "No posts in this forum yet." : "No channels PAX can see yet."}</Line>
  return (
    <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-200/70">
      {state.data.map((it) => {
        const Icon = ICON[it.icon]
        return (
          <button key={it.id} type="button" onClick={() => onOpen(it)} className="group flex w-full items-center gap-3 border-b border-slate-200/70 px-6 py-3 text-left transition-colors hover:bg-white/70">
            <Icon className="size-4 shrink-0 text-slate-400 group-hover:text-pax2-blue" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-slate-900 group-hover:text-pax2-blue">{it.name}</span>
              {it.sub && <span className="block text-xs text-slate-500">{it.sub}</span>}
            </span>
            <ChevronRight className="size-4 shrink-0 text-slate-400 group-hover:text-pax2-blue" />
          </button>
        )
      })}
    </div>
  )
}

function Stream({ service, source, item, parent }: { service: Service; source: Source; item: Item; parent?: string }) {
  const [state, setState] = React.useState<Result<Message[]> | null>(null)
  const [draft, setDraft] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const body = React.useRef<HTMLDivElement>(null)
  const load = React.useCallback(async () => setState(await source.read(item.id)), [source, item.id])
  React.useEffect(() => {
    let live = true
    const tick = () => source.read(item.id).then((r) => live && setState(r))
    tick()
    const timer = window.setInterval(tick, POLL_MS)
    return () => {
      live = false
      window.clearInterval(timer)
    }
  }, [source, item.id])
  const count = state?.ok ? state.data.length : 0
  React.useEffect(() => {
    body.current?.scrollTo({ top: body.current.scrollHeight })
  }, [count])
  const post = async () => {
    const text = draft.trim()
    if (!text || busy || !source.send) return
    setBusy(true)
    setError(null)
    const r = await source.send(item.id, text, parent)
    setBusy(false)
    if (!r.ok) return setError(r.error)
    setDraft("")
    load()
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={body} className="min-h-0 flex-1 overflow-y-auto border-t border-slate-200/70 px-6 py-4">
        {!state ? (
          <Loader2 className="size-5 animate-spin text-pax2-blue" />
        ) : !state.ok ? (
          <p className="text-sm text-slate-500">{state.error}</p>
        ) : !state.data.length ? (
          <p className="text-sm text-slate-500">No messages yet.</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {state.data.map((m) => (
              <li key={m.id} className="flex gap-3">
                {m.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatar} alt="" className="size-8 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pax2-lavender text-xs font-semibold text-pax2-blue">{m.author.slice(0, 1).toUpperCase()}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">{m.author}</span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-400">{when(m.at)}</span>
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{m.text}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="shrink-0 border-t border-slate-200/70 p-3">
        {error && <p className="px-1 pb-2 text-xs text-red-600">{error}</p>}
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white py-2 pl-4 pr-2 focus-within:border-pax2-light-blue">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                post()
              }
            }}
            rows={1}
            disabled={!source.send}
            placeholder={`Message ${service === "slack" ? "#" : ""}${item.name}`}
            className="max-h-32 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
          />
          <button type="button" onClick={post} disabled={!draft.trim() || busy || !source.send} aria-label="Send" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pax2-blue text-white transition-opacity disabled:opacity-30">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ConnectView({ service, mock = false }: { service: Service; mock?: boolean }) {
  const source = React.useMemo(() => (mock ? mockSource(service) : liveSource(service)), [service, mock])
  const [trail, setTrail] = React.useState<Step[]>([{ kind: "list" }])
  const step = trail[trail.length - 1]
  const back = () => setTrail((t) => t.slice(0, -1))
  const open = (it: Item) => {
    const forum = step.kind === "list" ? step.forum : undefined
    setTrail((t) => [...t, it.icon === "forum" ? { kind: "list", forum: it } : { kind: "stream", item: it, parent: forum?.id }])
  }
  const title = step.kind === "stream" ? step.item.name : step.forum?.name
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {title && (
        <button type="button" onClick={back} className="flex items-center gap-2 px-6 pb-3 text-left text-sm font-medium text-slate-700 hover:text-pax2-blue">
          <ArrowLeft className="size-4 shrink-0" />
          <span className="truncate">{service === "slack" && step.kind === "stream" ? `#${title}` : title}</span>
        </button>
      )}
      {step.kind === "list" ? <List key={step.forum?.id ?? "top"} source={source} forum={step.forum} onOpen={open} /> : <Stream key={step.item.id} service={service} source={source} item={step.item} parent={step.parent} />}
      {mock && <p className="shrink-0 border-t border-slate-200/70 px-6 py-3 text-center text-xs text-slate-500">Integration pending.</p>}
    </div>
  )
}
