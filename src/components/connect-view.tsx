"use client"

import * as React from "react"
import { AtSign, Bold, CaseSensitive, ChevronRight, Code, FileText, Hash, Italic, Link, List as Bullets, ListOrdered, Loader2, Lock, MessagesSquare, Plus, SendHorizontal, Smile, SquareCode, Strikethrough, TextQuote, Underline, X } from "lucide-react"

import { listDiscordChannels, listDiscordThreads, listSlackChannels, listSlackMembers, readDiscord, readSlack } from "@/app/connect-actions"
import { Markup } from "@/components/connect-markup"
import { mockSource } from "@/components/connect-mock"
import { ATTACH_MAX_BYTES, type Attachment, type ChannelMessage, type Member, type Result } from "@/lib/connect-types"
import { cn } from "@/ui/lib/utils"

// The side panel's Slack and Discord views, after 44b's review-channel stream (components/SamsStreams.tsx):
// the channels, then a channel's messages, read again every 15 seconds while open, with a composer after
// Slack's own: a formatting bar, attachments, emoji and @-mentions. A Discord forum opens to its posts first.
// Reads go through connect-actions, posts through /api/connect/send, admins only. Until a service is
// connected, `mock` fills the same views from connect-mock.ts, posting off, over an Integration pending
// footer. The panel's header carries the place and its back step (onNav).

const POLL_MS = 15_000

type Service = "slack" | "discord"
export type Item = { id: string; name: string; icon: "hash" | "lock" | "forum"; sub?: string }
export type Message = ChannelMessage
export type Outgoing = { text: string; mentions: Record<string, string>; files: File[] }
/** Where a view's lists and messages come from; `send` is null where posting is off. */
export type Source = {
  items: (forum?: string) => Promise<Result<Item[]>>
  read: (id: string) => Promise<Result<Message[]>>
  send: ((id: string, out: Outgoing, parent?: string) => Promise<Result<null>>) | null
  members: (() => Promise<Result<Member[]>>) | null
}
export type Nav = { title: string; back: () => void } | null
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

async function post(service: Service, channel: string, out: Outgoing, parent?: string): Promise<Result<null>> {
  const form = new FormData()
  form.set("service", service)
  form.set("channel", channel)
  if (parent) form.set("parent", parent)
  form.set("text", out.text)
  form.set("mentions", JSON.stringify(out.mentions))
  for (const f of out.files) form.append("files", f, f.name)
  try {
    return (await (await fetch("/api/connect/send", { method: "POST", body: form })).json()) as Result<null>
  } catch {
    return { ok: false, error: "The post didn't go through. Try again." }
  }
}

const liveSource = (service: Service): Source => ({
  items: (forum) => items(service, forum),
  read: (id) => (service === "slack" ? readSlack(id) : readDiscord(id)),
  send: (id, out, parent) => post(service, id, out, parent),
  members: service === "slack" ? listSlackMembers : null,
})

const when = (iso: string) => {
  const d = new Date(iso)
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`
}

const size = (n: number | null) => (n == null ? "" : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)

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

function Files({ files }: { files: Attachment[] }) {
  return (
    <div className="mt-1.5 flex flex-col gap-2">
      {files.map((f, i) =>
        f.preview ? (
          <a key={i} href={f.url} target="_blank" rel="noreferrer" className="block w-fit overflow-hidden rounded-lg border border-slate-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.preview} alt={f.name} className="max-h-64 max-w-full object-contain" />
          </a>
        ) : (
          <a key={i} href={f.url} target="_blank" rel="noreferrer" className="flex w-fit max-w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-pax2-light-blue">
            <FileText className="size-5 shrink-0 text-pax2-blue" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-slate-900">{f.name}</span>
              {f.size != null && <span className="block text-xs text-slate-500">{size(f.size)}</span>}
            </span>
          </a>
        ),
      )}
    </div>
  )
}

const EMOJI = ["👍", "🙏", "🎉", "✅", "👀", "🔥", "💯", "😂", "🙂", "😮", "🤔", "👏", "❤️", "🚀", "📈", "📌", "🗳️", "🇺🇸", "🎬", "📣", "⭐", "❗", "➕", "👋"]

const TOOL = "flex size-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-pax2-blue disabled:opacity-40"

/** Slack's composer, in PAX's dress: the formatting bar (Aa hides it), the text, attachment chips, and the
 *  row of +, Aa, emoji, @ and send. Formatting writes lib/connect-types.ts's markdown. */
function Composer({ service, placeholder, people, members, onSend }: { service: Service; placeholder: string; people: Member[]; members: Source["members"]; onSend: ((out: Outgoing) => Promise<string | null>) | null }) {
  const [text, setText] = React.useState("")
  const [files, setFiles] = React.useState<File[]>([])
  const [bar, setBar] = React.useState(true)
  const [pop, setPop] = React.useState<"emoji" | "at" | "link" | null>(null)
  const [link, setLink] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [everyone, setEveryone] = React.useState<Member[] | null>(null)
  const mentions = React.useRef<Record<string, string>>({})
  const area = React.useRef<HTMLTextAreaElement>(null)
  const picker = React.useRef<HTMLInputElement>(null)
  const off = !onSend

  // Grows with the text, up to about eight lines.
  React.useEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [text])

  const edit = (f: (v: string, a: number, b: number) => { v: string; a: number; b: number }) => {
    const el = area.current
    if (!el) return
    const r = f(text, el.selectionStart, el.selectionEnd)
    setText(r.v)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(r.a, r.b)
    })
  }
  const wrap = (open: string, close = open) => edit((v, a, b) => ({ v: v.slice(0, a) + open + v.slice(a, b) + close + v.slice(b), a: a + open.length, b: b + open.length }))
  const insert = (s: string) => edit((v, a, b) => ({ v: v.slice(0, a) + s + v.slice(b), a: a + s.length, b: a + s.length }))
  const prefix = (mark: (n: number) => string) =>
    edit((v, a, b) => {
      const start = v.lastIndexOf("\n", a - 1) + 1
      const block = v
        .slice(start, b)
        .split("\n")
        .map((l, i) => mark(i + 1) + l)
        .join("\n")
      return { v: v.slice(0, start) + block + v.slice(b), a: start, b: start + block.length }
    })
  const addLink = () => {
    const url = link.trim()
    if (!url) return setPop(null)
    const href = /^(https?|mailto):/.test(url) ? url : `https://${url}`
    edit((v, a, b) => {
      const s = `[${v.slice(a, b) || href}](${href})`
      return { v: v.slice(0, a) + s + v.slice(b), a: a + s.length, b: a + s.length }
    })
    setLink("")
    setPop(null)
  }
  const mention = (m: Member) => {
    mentions.current[m.name] = m.id
    insert(`@${m.name} `)
    setPop(null)
  }
  const openAt = () => {
    setPop(pop === "at" ? null : "at")
    if (!everyone && members) members().then((r) => setEveryone(r.ok ? r.data : []))
  }
  const pick = (list: FileList | null) => {
    if (!list) return
    const next = [...files, ...Array.from(list)]
    if (next.reduce((n, f) => n + f.size, 0) > ATTACH_MAX_BYTES) setError(`Attachments go up to ${ATTACH_MAX_BYTES / 1024 / 1024} MB per message.`)
    else setFiles(next)
  }
  const send = async () => {
    if (!onSend || busy || (!text.trim() && !files.length)) return
    setBusy(true)
    setError(null)
    const used = Object.fromEntries(Object.entries(mentions.current).filter(([name]) => text.includes(`@${name}`)))
    const err = await onSend({ text: text.trim(), mentions: used, files })
    setBusy(false)
    if (err) return setError(err)
    setText("")
    setFiles([])
    mentions.current = {}
  }

  const roster = [...people, ...(everyone ?? []).filter((m) => !people.some((p) => p.id === m.id))]
  const tools: { icon: typeof Bold; label: string; run: () => void; only?: Service; gap?: boolean }[] = [
    { icon: Bold, label: "Bold", run: () => wrap("**") },
    { icon: Italic, label: "Italic", run: () => wrap("*") },
    { icon: Underline, label: "Underline", run: () => wrap("__"), only: "discord" },
    { icon: Strikethrough, label: "Strikethrough", run: () => wrap("~~") },
    { icon: Link, label: "Link", run: () => setPop(pop === "link" ? null : "link"), gap: true },
    { icon: ListOrdered, label: "Numbered list", run: () => prefix((n) => `${n}. `), gap: true },
    { icon: Bullets, label: "Bulleted list", run: () => prefix(() => "- ") },
    { icon: TextQuote, label: "Quote", run: () => prefix(() => "> "), gap: true },
    { icon: Code, label: "Code", run: () => wrap("`") },
    { icon: SquareCode, label: "Code block", run: () => wrap("```\n", "\n```") },
  ]

  return (
    <div className="relative">
      {error && <p className="px-1 pb-2 text-xs text-red-600">{error}</p>}
      {pop === "emoji" && (
        <div className="absolute bottom-full left-0 z-20 mb-2 grid grid-cols-8 gap-0.5 rounded-xl border border-slate-200 bg-white p-2 shadow-e2">
          {EMOJI.map((e) => (
            <button key={e} type="button" onClick={() => (insert(e), setPop(null))} className="flex size-8 items-center justify-center rounded-md text-lg hover:bg-slate-100">
              {e}
            </button>
          ))}
        </div>
      )}
      {pop === "at" && (
        <div className="absolute bottom-full left-0 z-20 mb-2 max-h-64 w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-e2">
          {roster.length ? (
            roster.map((m) => (
              <button key={m.id} type="button" onClick={() => mention(m)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-100">
                {m.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatar} alt="" className="size-6 rounded-full object-cover" />
                ) : (
                  <span className="flex size-6 items-center justify-center rounded-full bg-pax2-lavender text-[11px] font-semibold text-pax2-blue">{m.name.slice(0, 1).toUpperCase()}</span>
                )}
                <span className="truncate">{m.name}</span>
              </button>
            ))
          ) : (
            <p className="px-2 py-1.5 text-sm text-slate-500">{members && !everyone ? "Loading people…" : "No one to mention here yet."}</p>
          )}
        </div>
      )}
      <div className={cn("rounded-2xl border border-slate-200 bg-white transition-colors focus-within:border-pax2-light-blue", off && "opacity-70")}>
        {bar && (
          <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-100 px-2 py-1">
            {tools
              .filter((t) => !t.only || t.only === service)
              .map((t) => (
                <React.Fragment key={t.label}>
                  {t.gap && <span aria-hidden className="mx-1 h-4 w-px bg-slate-200" />}
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={t.run} disabled={off} aria-label={t.label} title={t.label} className={TOOL}>
                    <t.icon className="size-4" />
                  </button>
                </React.Fragment>
              ))}
          </div>
        )}
        {pop === "link" && (
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Link className="size-4 shrink-0 text-slate-400" />
            <input
              autoFocus
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addLink()
                }
                if (e.key === "Escape") setPop(null)
              }}
              placeholder="Paste a link and press Enter"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
        )}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-2.5">
            {files.map((f, i) => (
              <span key={`${f.name}-${i}`} className="flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-pax2-mist py-1.5 pl-2.5 pr-1.5">
                <FileText className="size-4 shrink-0 text-pax2-blue" />
                <span className="min-w-0">
                  <span className="block max-w-40 truncate text-xs font-medium text-slate-900">{f.name}</span>
                  <span className="block text-[11px] text-slate-500">{size(f.size)}</span>
                </span>
                <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="flex size-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700">
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <textarea
          ref={area}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          rows={1}
          disabled={off}
          placeholder={placeholder}
          className="block max-h-[180px] w-full resize-none bg-transparent px-4 pb-1 pt-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
        />
        <div className="flex items-center gap-0.5 px-2 pb-2">
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              pick(e.target.files)
              e.target.value = ""
            }}
          />
          <button type="button" onClick={() => picker.current?.click()} disabled={off} aria-label="Attach files" title="Attach files" className={cn(TOOL, "rounded-full bg-slate-100")}>
            <Plus className="size-4" />
          </button>
          <button type="button" onClick={() => setBar(!bar)} disabled={off} aria-pressed={bar} aria-label="Formatting" title="Formatting" className={cn(TOOL, bar && "text-pax2-blue")}>
            <CaseSensitive className="size-[18px]" />
          </button>
          <button type="button" onClick={() => setPop(pop === "emoji" ? null : "emoji")} disabled={off} aria-label="Emoji" title="Emoji" className={TOOL}>
            <Smile className="size-4" />
          </button>
          <button type="button" onClick={openAt} disabled={off} aria-label="Mention someone" title="Mention someone" className={TOOL}>
            <AtSign className="size-4" />
          </button>
          <span className="flex-1" />
          <button type="button" onClick={send} disabled={off || busy || (!text.trim() && !files.length)} aria-label="Send" className="flex size-8 items-center justify-center rounded-full bg-pax2-blue text-white transition-opacity disabled:opacity-30">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}

function Stream({ service, source, item, parent }: { service: Service; source: Source; item: Item; parent?: string }) {
  const [state, setState] = React.useState<Result<Message[]> | null>(null)
  const body = React.useRef<HTMLDivElement>(null)
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
  const msgs = state?.ok ? state.data : []
  React.useEffect(() => {
    body.current?.scrollTo({ top: body.current.scrollHeight })
  }, [msgs.length])
  // The people in this conversation, first in the @ list.
  const people = msgs.reduce<Member[]>((acc, m) => (m.authorId && !acc.some((p) => p.id === m.authorId) ? [...acc, { id: m.authorId, name: m.author, avatar: m.avatar }] : acc), [])
  const write = source.send
  const send = write
    ? async (out: Outgoing) => {
        const r = await write(item.id, out, parent)
        if (!r.ok) return r.error
        setState(await source.read(item.id))
        return null
      }
    : null
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={body} className="min-h-0 flex-1 overflow-y-auto border-t border-slate-200/70 px-6 py-4">
        {!state ? (
          <Loader2 className="size-5 animate-spin text-pax2-blue" />
        ) : !state.ok ? (
          <p className="text-sm text-slate-500">{state.error}</p>
        ) : !msgs.length ? (
          <p className="text-sm text-slate-500">No messages yet.</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {msgs.map((m) => (
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
                  {m.text && <Markup text={m.text} />}
                  {m.files.length > 0 && <Files files={m.files} />}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      {/* Clear of the shell's corner close, which bites the panel's bottom-right corner on wide screens. */}
      <div className="shrink-0 border-t border-slate-200/70 p-3 md:pb-12">
        <Composer key={item.id} service={service} placeholder={`Message ${service === "slack" ? "#" : ""}${item.name}`} people={people} members={source.members} onSend={send} />
      </div>
    </div>
  )
}

export function ConnectView({ service, mock = false, onNav }: { service: Service; mock?: boolean; onNav?: (nav: Nav) => void }) {
  const source = React.useMemo(() => (mock ? mockSource(service) : liveSource(service)), [service, mock])
  const [trail, setTrail] = React.useState<Step[]>([{ kind: "list" }])
  const step = trail[trail.length - 1]
  const open = (it: Item) => {
    const forum = step.kind === "list" ? step.forum : undefined
    setTrail((t) => [...t, it.icon === "forum" ? { kind: "list", forum: it } : { kind: "stream", item: it, parent: forum?.id }])
  }
  // The panel's header shows where this is and steps back from it; at the top it's the panel's own.
  const title = step.kind === "stream" ? (service === "slack" ? `#${step.item.name}` : step.item.name) : step.forum?.name
  React.useEffect(() => {
    onNav?.(title ? { title, back: () => setTrail((t) => t.slice(0, -1)) } : null)
  }, [title, onNav])
  React.useEffect(() => () => onNav?.(null), [onNav])
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {step.kind === "list" ? <List key={step.forum?.id ?? "top"} source={source} forum={step.forum} onOpen={open} /> : <Stream key={step.item.id} service={service} source={source} item={step.item} parent={step.parent} />}
      {mock && <p className="shrink-0 border-t border-slate-200/70 px-6 py-3 text-center text-xs text-slate-500">Integration pending.</p>}
    </div>
  )
}
