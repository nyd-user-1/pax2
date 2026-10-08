"use client"

/* eslint-disable @next/next/no-img-element */

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, ChevronUp, Clock, MessagesSquare, PanelLeftClose, PanelLeftOpen, Search, Star, X } from "lucide-react"

import { useShellPanel } from "@/components/shell"
import { cn } from "@/ui/lib/utils"

export type FeedVideo = {
  id: string
  title: string
  channel: string
  channelId: string
  views: number
  ratio: number
  tier: "breakout" | "baseline" | "killed" | "unsettled"
  published: string
  duration: string
  description: string
  playable: boolean
}

const fmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })

const age = (iso: string) => {
  const days = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000))
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.round(days / 30)}mo ago`
  return `${Math.round(days / 365)}y ago`
}

const dur = (iso: string) => {
  const m = /PT(?:(\d+)M)?(?:(\d+)S)?/.exec(iso)
  return `${m?.[1] ?? "0"}:${(m?.[2] ?? "0").padStart(2, "0")}`
}

const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`

/** Hover a moment and the real video plays in place, muted — only for the
 *  shorts whose file we actually hold. */
function HoverThumb({ v, aspect }: { v: FeedVideo; aspect: string }) {
  const [play, setPlay] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const enter = () => {
    if (!v.playable) return
    timer.current = setTimeout(() => setPlay(true), 250)
  }
  const leave = () => {
    if (timer.current) clearTimeout(timer.current)
    setPlay(false)
  }
  return (
    <span onMouseEnter={enter} onMouseLeave={leave} className={cn("block", aspect)}>
      {play ? (
        <video src={`/api/video/yt-${v.id}`} poster={thumb(v.id)} autoPlay muted loop playsInline className="size-full object-cover" />
      ) : (
        <img src={thumb(v.id)} alt="" loading="lazy" className={cn("size-full object-cover", aspect !== "aspect-video" && "transition-transform duration-300 group-hover:scale-[1.02]")} />
      )}
    </span>
  )
}

const SCORE = {
  breakout: "bg-green-600 text-white",
  killed: "bg-red-600 text-white",
  baseline: "bg-white/85 text-slate-900 ring-1 ring-white backdrop-blur-md",
  unsettled: "bg-white/85 text-slate-900 ring-1 ring-white backdrop-blur-md",
} as const

/** The video's ratio — views over its channel's median — on hover: the frame dims and the
 *  chip pops in at its center, green for a Hit, red for a Miss, frosted white otherwise. The whole
 *  frame frosts over. */
function Score({ v }: { v: FeedVideo }) {
  return (
    <>
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-black/35 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-white/10 opacity-0 backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100" />
      <span className={cn("tabular pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-90 rounded-xl px-4 py-2 text-2xl font-bold leading-none opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-[opacity,scale] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-100 group-hover:opacity-100", SCORE[v.tier])}>
        {v.ratio >= 10 ? v.ratio.toFixed(0) : v.ratio.toFixed(1)}×
      </span>
    </>
  )
}

const FAVORITES = "hermes:favorites"

/** A star in the thumbnail's top-right corner on hover; once favorited it stays, filled.
 *  Favorites live in this browser. */
function Favorite({ id }: { id: string }) {
  const [on, setOn] = React.useState(false)
  React.useEffect(() => setOn((JSON.parse(localStorage.getItem(FAVORITES) ?? "[]") as string[]).includes(id)), [id])
  const toggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const ids = new Set(JSON.parse(localStorage.getItem(FAVORITES) ?? "[]") as string[])
    if (ids.has(id)) ids.delete(id)
    else ids.add(id)
    localStorage.setItem(FAVORITES, JSON.stringify([...ids]))
    setOn(ids.has(id))
  }
  return (
    <button
      type="button"
      aria-label={on ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={on}
      onClick={toggle}
      className={cn(
        "absolute right-2 top-2 z-10 flex size-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-e1 transition-[opacity,box-shadow] hover:shadow-e2",
        on ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
      )}
    >
      <Star className={cn("size-4", on && "fill-amber-400 text-amber-400")} />
    </button>
  )
}

function Avatar({ id }: { id: string }) {
  return <img src={`/logos/channels/${id}.jpg`} alt="" className="size-8 shrink-0 rounded-full object-cover" />
}

/** A full-width result row: landscape thumbnail, then title, meta, channel and
 *  the first line of the description. */
export function ListRow({ v }: { v: FeedVideo }) {
  return (
    <Link href={`/v/yt-${v.id}`} className="group relative isolate before:absolute before:-inset-3 before:-z-10 before:rounded-2xl before:border before:border-black/10 before:bg-black/5 before:opacity-0 before:transition-opacity before:duration-200 hover:before:opacity-100 flex flex-col gap-3 sm:flex-row sm:gap-5">
      <div className="relative w-full shrink-0 overflow-hidden rounded-xl bg-slate-200 sm:w-[340px] md:w-[400px]">
        <HoverThumb v={v} aspect="aspect-video" />
        <Score v={v} />
        <Favorite id={v.id} />
        <span className="tabular pointer-events-none absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white">{dur(v.duration)}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="font-display text-lg leading-snug text-slate-900">{v.title}</p>
        <p className="tabular text-sm text-slate-500">{fmt.format(v.views)} views · {age(v.published)}</p>
        <span className="flex items-center gap-2 pt-1">
          <Avatar id={v.channelId} />
          <span className="text-sm text-slate-600">{v.channel}</span>
        </span>
        {v.description && <p className="hidden pt-1 text-sm leading-relaxed text-slate-500 sm:line-clamp-2">{v.description}</p>}
      </div>
    </Link>
  )
}

/** One vertical Shorts card. */
export function ShortCard({ v }: { v: FeedVideo }) {
  return (
    <Link href={`/v/yt-${v.id}`} className="group flex flex-col gap-1.5">
      <div className="relative overflow-hidden rounded-xl bg-slate-200">
        <HoverThumb v={v} aspect="aspect-[9/16]" />
        <Score v={v} />
        <Favorite id={v.id} />
      </div>
      <p className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-900 group-hover:text-pax-plum">{v.title}</p>
      <p className="tabular text-xs text-slate-500">{fmt.format(v.views)} views</p>
    </Link>
  )
}

/** One medium landscape card, as in the three-across band. */
export function LandscapeCard({ v }: { v: FeedVideo }) {
  return (
    <Link href={`/v/yt-${v.id}`} className="group relative isolate before:absolute before:-inset-3 before:-z-10 before:rounded-2xl before:border before:border-black/10 before:bg-black/5 before:opacity-0 before:transition-opacity before:duration-200 hover:before:opacity-100 flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-xl bg-slate-200">
        <HoverThumb v={v} aspect="aspect-video" />
        <Score v={v} />
        <Favorite id={v.id} />
        <span className="tabular pointer-events-none absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white">{dur(v.duration)}</span>
      </div>
      <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{v.title}</p>
      <p className="tabular text-xs text-slate-500">{v.channel} · {fmt.format(v.views)} views</p>
    </Link>
  )
}

/** The Shorts shelf: a row of vertical cards, a second row behind Show more, and YouTube's
 *  rule-and-pill separator before the landscape rows resume. */
function ShortsShelf({ items }: { items: FeedVideo[] }) {
  const [more, setMore] = React.useState(false)
  return (
    <div className="flex flex-col gap-3">
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <img src="/logos/youtube-shorts.svg" alt="" className="h-5 w-auto" /> Shorts
      </span>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {items.slice(0, more ? items.length : 6).map((v) => (
          <ShortCard key={v.id} v={v} />
        ))}
      </div>
      {items.length > 6 && (
        <div className="relative mt-3 flex justify-center">
          <span className="absolute inset-x-0 top-1/2 h-px bg-black/10" />
          <button
            type="button"
            onClick={() => setMore((m) => !m)}
            className="relative flex h-9 w-full max-w-sm items-center justify-center gap-2 rounded-full border border-black/10 bg-pax-mist text-sm font-medium text-slate-900 transition-[filter] hover:brightness-95"
          >
            {more ? "Show fewer" : "Show more"} {more ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
          </button>
        </div>
      )}
    </div>
  )
}

/** Three medium cards across — the shape of YouTube's related-videos band. */
function Trio({ items }: { items: FeedVideo[] }) {
  return (
    <div className="grid gap-8 sm:grid-cols-3">
      {items.map((v) => (
        <LandscapeCard key={v.id} v={v} />
      ))}
    </div>
  )
}

const rotate = <T,>(xs: T[], n: number) => {
  const k = xs.length ? n % xs.length : 0
  return xs.slice(k).concat(xs.slice(0, k))
}

/** One pass through the catalog as a mixed layout: rows, a Shorts shelf, rows,
 *  a trio, until the items run out. */
function Cycle({ items }: { items: FeedVideo[] }) {
  const blocks: React.ReactNode[] = []
  const pattern = ["list", "list", "shorts", "list", "trio", "list"] as const
  let i = 0
  let p = 0
  while (i < items.length) {
    const kind = pattern[p % pattern.length]
    if (kind === "shorts" && items.length - i >= 12) {
      blocks.push(<ShortsShelf key={i} items={items.slice(i, i + 12)} />)
      i += 12
    } else if (kind === "trio" && items.length - i >= 3) {
      blocks.push(<Trio key={i} items={items.slice(i, i + 3)} />)
      i += 3
    } else {
      blocks.push(<ListRow key={i} v={items[i]} />)
      i += 1
    }
    p += 1
  }
  return <>{blocks}</>
}

/** Every word has to appear somewhere in the title, channel or description, in any order. */
export const matches = (v: FeedVideo, needle: string) => needle.split(/\s+/).filter(Boolean).every((w) => `${v.title} ${v.channel} ${v.description}`.toLowerCase().includes(w))

const RETURN = "hermes:feed-return"
const RECENT = "hermes:recent-searches"

/** The search bar, with the reader's recent searches dropping down beneath it while it's empty
 *  (govblock's search drop-down). A search is remembered on Enter. */
export function SearchBar({ q, setQ, placeholder = "Search videos" }: { q: string; setQ: (q: string) => void; placeholder?: string }) {
  const [open, setOpen] = React.useState(false)
  const [recent, setRecent] = React.useState<string[]>([])
  const input = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => setRecent(JSON.parse(localStorage.getItem(RECENT) ?? "[]") as string[]), [])
  const save = (next: string[]) => {
    setRecent(next)
    localStorage.setItem(RECENT, JSON.stringify(next))
  }
  const submit = () => {
    const term = q.trim()
    if (term.length >= 2) save([term, ...recent.filter((r) => r !== term)].slice(0, 8))
    input.current?.blur()
  }
  const run = (term: string) => {
    setQ(term)
    save([term, ...recent.filter((r) => r !== term)].slice(0, 8))
    setOpen(false)
    input.current?.blur()
  }
  return (
    <div
      className="relative w-full"
      onFocusCapture={() => setOpen(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false)
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="flex h-11 items-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-e1 transition-shadow focus-within:shadow-e2"
      >
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent px-5 text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
        />
        {q !== "" && (
          <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="flex h-full items-center px-2 text-slate-400 hover:text-slate-700">
            <X className="size-4" />
          </button>
        )}
        <button type="submit" aria-label="Search" className="flex h-full items-center border-l border-slate-200 bg-pax-mist px-5 text-slate-500">
          <Search className="size-4" />
        </button>
      </form>
      {open && q === "" && recent.length > 0 && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border bg-white text-left shadow-lg" onMouseDown={(e) => e.preventDefault()}>
          <div className="max-h-[min(28rem,60svh)] overflow-y-auto p-4">
            <h2 className="text-sm font-medium text-muted-foreground">
              Recent searches <span className="tabular">({recent.length})</span>
            </h2>
            <ul className="mt-2 flex flex-col">
              {recent.map((term) => (
                <li key={term} className="group border-b py-0.5 last:border-0">
                  <div className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted hover:text-foreground">
                    <button type="button" onClick={() => run(term)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left text-sm">
                      <Clock className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{term}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Forget ${term}`}
                      onClick={() => save(recent.filter((r) => r !== term))}
                      className="shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

/** Signed in, the feed's bar is the page's header: the sidebar toggle where the wordmark stood,
 *  the search in the middle, and the discussion where Sign up stood. */
function FeedHeader({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, toggleSidebar, discuss, toggleDiscuss } = useShellPanel()
  return (
    <div className="sticky top-0 z-40 flex items-center gap-4 border-b border-slate-200/70 bg-white/85 px-5 py-3 shadow-[0_4px_12px_-8px_rgb(15_23_42/0.25)] backdrop-blur">
      <button type="button" onClick={toggleSidebar} aria-label="Toggle sidebar" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-pax-ink shadow-e1 transition-shadow hover:shadow-e2">
        {sidebarOpen ? <PanelLeftClose className="size-4" strokeWidth={2} /> : <PanelLeftOpen className="size-4" strokeWidth={2} />}
      </button>
      <div className="mx-auto w-full max-w-2xl">{children}</div>
      <button type="button" onClick={toggleDiscuss} aria-pressed={discuss} aria-label="Open the discussion" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition-colors hover:bg-slate-50">
        <MessagesSquare className="size-4" style={{ color: "#033882", fill: "#dbe7fa" }} />
      </button>
    </div>
  )
}

export function Feed({ videos, signedIn = false }: { videos: FeedVideo[]; signedIn?: boolean }) {
  const [q, setQ] = React.useState("")
  const [cycles, setCycles] = React.useState(1)
  const sentinel = React.useRef<HTMLDivElement>(null)
  const section = React.useRef<HTMLElement>(null)
  const path = usePathname()
  const landing = path === "/" && !signedIn
  const header = path === "/" && signedIn

  // Opening a video from the landing remembers where the reader was; coming back puts them there
  // again — never above the point where the search bar sticks.
  const remember = (e: React.MouseEvent) => {
    if (landing && (e.target as HTMLElement).closest('a[href^="/v/"]')) sessionStorage.setItem(RETURN, JSON.stringify({ y: window.scrollY, cycles }))
  }
  React.useEffect(() => {
    if (!landing) return
    const saved = sessionStorage.getItem(RETURN)
    if (!saved) return
    sessionStorage.removeItem(RETURN)
    const { y, cycles: c } = JSON.parse(saved) as { y: number; cycles: number }
    setCycles(c)
    requestAnimationFrame(() => {
      const top = (section.current?.getBoundingClientRect().top ?? 0) + window.scrollY
      window.scrollTo({ top: Math.max(y, top), behavior: "instant" })
    })
  }, [landing])

  const needle = q.trim().toLowerCase()
  const shown = needle ? videos.filter((v) => matches(v, needle)) : videos

  // The catalog is finite; the page isn't. Each time the spinner comes into
  // view another rotated pass appends, so the feed reads as endless.
  React.useEffect(() => {
    const el = sentinel.current
    if (!el || needle) return
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) setCycles((c) => c + 1)
    }, { rootMargin: "600px" })
    io.observe(el)
    return () => io.disconnect()
  }, [needle])

  return (
    <>
      {header && (
        <FeedHeader>
          <SearchBar q={q} setQ={setQ} />
        </FeedHeader>
      )}
      <section ref={section} onClickCapture={remember} className={cn("mx-auto w-full max-w-6xl px-6 pb-16", header && "pt-6")}>
        {!header && (
          <div className="sticky top-2.5 z-40 mx-auto w-full max-w-2xl">
            <SearchBar q={q} setQ={setQ} />
          </div>
        )}

        <div className="flex flex-col gap-10 pt-10">
          {shown.length === 0 ? (
            <p className="py-16 text-center text-slate-500">Nothing matches &ldquo;{q}&rdquo;.</p>
          ) : needle ? (
            <Cycle items={shown} />
          ) : (
            Array.from({ length: cycles }, (_, c) => <Cycle key={c} items={rotate(shown, c * 7)} />)
          )}
        </div>

        {!needle && shown.length > 0 && (
          <div ref={sentinel} className="flex justify-center py-12">
            <span aria-label="Loading more" className="size-8 animate-spin rounded-full border-[3px] border-slate-300 border-t-pax-ink" />
          </div>
        )}
      </section>
    </>
  )
}
