"use client"

/* eslint-disable @next/next/no-img-element */

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowDownAZ, ArrowDownWideNarrow, ArrowUpDown, ArrowUpNarrowWide, Bookmark, ChevronDown, ChevronUp, Clock, EllipsisVertical, FlaskConical, Forward, ListPlus, MessageCircle, Pin, Play, Rocket, Search, SlidersHorizontal, TrendingUp, Tag, ThumbsUp, UserRound, X, type LucideIcon } from "lucide-react"

import { viewer } from "@/app/original-actions"
import { boostState, boostToggle, myUsageSince, usageSince } from "@/app/usage-actions"
import { useShellPanel } from "@/components/shell"
import { readerId, useUsage } from "@/components/usage-beacon"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/components/nova/dropdown-menu"
import { rankFeed, type RankEvent } from "@/lib/feed-rank"
import { cn } from "@/ui/lib/utils"
import { whiteButton } from "@/components/white-button"

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
  likes?: number | null
  comments?: number | null
  paid?: boolean
  tags?: string[]
  /** Lab Tested: the video file itself was measured in the lab (data/generated/lab-tested.json). */
  lab?: boolean
  /** e2: run through the platform end to end (data/generated/e2.json). */
  e2?: boolean
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
function HoverThumb({ v, aspect, playButton }: { v: FeedVideo; aspect: string; playButton?: boolean }) {
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
    <span onMouseEnter={enter} onMouseLeave={leave} className={cn("relative block", aspect)}>
      {play ? (
        <video src={`/api/video/yt-${v.id}`} poster={thumb(v.id)} autoPlay muted loop playsInline className="size-full object-cover" />
      ) : (
        <img src={thumb(v.id)} alt="" loading="lazy" className={cn("size-full object-cover", aspect !== "aspect-video" && "transition-transform duration-300 group-hover:scale-[1.02]")} />
      )}
      {v.lab && (
        <span title={v.e2 ? "e\u00b2" : "Lab Tested"} aria-label={v.e2 ? "e\u00b2" : "Lab Tested"} className="absolute right-1.5 top-1.5 z-10 flex size-6 items-center justify-center rounded-full bg-white/85 text-slate-900 ring-1 ring-white backdrop-blur-md">
          {v.e2 ? <span className="text-[11px] font-bold leading-none">e&sup2;</span> : <FlaskConical className="size-3.5" />}
        </span>
      )}
      {playButton && !play && (
        <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="flex size-14 scale-90 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-transform duration-200 group-hover:scale-100">
            <Play className="ml-0.5 size-6 fill-white" />
          </span>
        </span>
      )}
    </span>
  )
}

/** The chip's colour, from the ratio alone (Brendan, 2026-10-22): under 3x white, 3x to 5x light
 *  green, 5x and over full green. No red on reader-facing chips — it may return on partner or
 *  admin pages for evaluative reads. */
const scoreOf = (v: FeedVideo) =>
  v.ratio >= 5 ? "bg-green-600 text-white" : v.ratio >= 3 ? "bg-green-200 text-green-950 ring-1 ring-white" : "bg-white/85 text-slate-900 ring-1 ring-white backdrop-blur-md"

/** The video's ratio — views over its channel's median — on hover: the frame dims and the
 *  chip pops in at its center, green for a Hit, red for a Miss, frosted white otherwise. The whole
 *  frame frosts over. */
function Score({ v }: { v: FeedVideo }) {
  return (
    <>
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-black/35 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-white/10 opacity-0 backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100" />
      <span className={cn("tabular pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-90 rounded-xl px-4 py-2 text-2xl font-bold leading-none opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-[opacity,scale] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-100 group-hover:opacity-100", scoreOf(v))}>
        {v.ratio >= 10 ? v.ratio.toFixed(0) : v.ratio.toFixed(1)}×
      </span>
    </>
  )
}

function Avatar({ id, className }: { id: string; className?: string }) {
  return <img src={`/logos/channels/${id}.jpg`} alt="" className={cn("size-8 shrink-0 rounded-full object-cover", className)} />
}


/** A card's counts in one icon style — views, likes, comments — each sized
 *  and hovered like the three-dot button, a muted disc beneath, on the card's right. The landscape
 *  cards add Boost on the left. */
const CORNER_ITEM = "flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full px-2 transition-colors hover:bg-slate-200/70"

/** The feed's Boost state: the reader's current boosts and every card's count, loaded once and
 *  shared, so a rocket stays filled across visits and a press updates one place. */
const BoostCtx = React.createContext<{ mine: Set<string>; counts: Record<string, number>; toggle: (id: string) => void } | null>(null)

function useBoostState(videos: FeedVideo[]) {
  const [mine, setMine] = React.useState<Set<string>>(new Set())
  const [counts, setCounts] = React.useState<Record<string, number>>({})
  const asked = React.useRef(new Set<string>())
  React.useEffect(() => {
    // Only ids the server hasn't answered for yet — the pool grows a page at a time.
    const fresh = videos.map((v) => v.id).filter((id) => !asked.current.has(id))
    if (!fresh.length) return
    for (const id of fresh) asked.current.add(id)
    boostState(fresh, readerId())
      .then((s) => {
        setMine((m) => new Set([...m, ...s.mine]))
        setCounts((c) => ({ ...c, ...s.counts }))
      })
      .catch(() => {})
  }, [videos])
  const toggle = React.useCallback((id: string) => {
    // Optimistic flip; the server's answer settles the count. The usage row writes server-side.
    setMine((m) => {
      const next = new Set(m)
      const on = !next.has(id)
      if (on) next.add(id)
      else next.delete(id)
      setCounts((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + (on ? 1 : -1)) }))
      return next
    })
    boostToggle(id, readerId())
      .then((r) => r && setCounts((c) => ({ ...c, [id]: r.n })))
      .catch(() => {})
  }, [])
  return React.useMemo(() => ({ mine, counts, toggle }), [mine, counts, toggle])
}

const BOOST_TIP = "Stronger than a like, short of a share: a boost says you value and support this video, and it weights your For you feed toward more like it."

function CardFoot({ v, boost }: { v: FeedVideo; boost?: boolean }) {
  const b = React.useContext(BoostCtx)
  const boosted = b?.mine.has(v.id) ?? false
  const count = b?.counts[v.id] ?? 0
  return (
    <div className="tabular mt-auto flex items-center justify-between gap-2 text-sm text-pax2-blue">
      {boost ? (
        // A press stays out of the card's link.
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            b?.toggle(v.id)
          }}
          aria-label="Boost"
          aria-pressed={boosted}
          title={BOOST_TIP}
          className={whiteButton("md", cn("gap-1.5 px-2.5 shadow-none hover:shadow-md", boosted && "border-pax2-blue bg-[#dbe7fa]"))}
        >
          <Rocket className="size-4" style={{ color: "#033882", fill: boosted ? "#033882" : "#dbe7fa" }} />
          {count > 0 && <span className="text-xs font-semibold text-[#033882]">{fmt.format(count)}</span>}
        </button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-0.5">
        <span className={CORNER_ITEM} aria-label={`${v.views} views`}>
          <TrendingUp className="size-5" /> {fmt.format(v.views)}
        </span>
        {v.likes != null && (
          <span className={CORNER_ITEM} aria-label={`${v.likes} likes`}>
            <ThumbsUp className="size-5" /> {fmt.format(v.likes)}
          </span>
        )}
        {v.comments != null && (
          <span className={CORNER_ITEM} aria-label={`${v.comments} comments`}>
            <MessageCircle className="size-5" /> {fmt.format(v.comments)}
          </span>
        )}
      </div>
    </div>
  )
}

/** A card's three-dot menu: queue, save and share, each logged. Clicks stay out of the card's
 *  link — the menu portals out of it, but React events still bubble through. */
/** Pin to top: the reader's pinned videos lead the feed as their own row. Stored in the browser
 *  (pax2-pins); first load seeds from the feed's e2 videos. */
const PinCtx = React.createContext<{ pinned: string[]; toggle: (id: string) => void } | null>(null)
const PINS_KEY = "pax2-pins"

function usePins(videos: FeedVideo[]) {
  const [pinned, setPinned] = React.useState<string[]>([])
  const log = useUsage()
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(PINS_KEY)
      setPinned(stored ? (JSON.parse(stored) as string[]) : videos.filter((v) => v.e2).map((v) => v.id))
    } catch {
      setPinned(videos.filter((v) => v.e2).map((v) => v.id))
    }
  }, [videos])
  const toggle = React.useCallback(
    (id: string) => {
      setPinned((p) => {
        const next = p.includes(id) ? p.filter((x) => x !== id) : [...p, id]
        try {
          localStorage.setItem(PINS_KEY, JSON.stringify(next))
        } catch {}
        return next
      })
      log("pin", id)
    },
    [log],
  )
  return React.useMemo(() => ({ pinned, toggle }), [pinned, toggle])
}

/** The pinned row: two pinned videos sit two across, three or more three across. */
function PinnedRow({ items }: { items: FeedVideo[] }) {
  const cols = items.length === 1 ? "" : items.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"
  return (
    <div className={cn("grid gap-8", cols)}>
      {items.map((v) => (
        <LandscapeCard key={v.id} v={v} />
      ))}
    </div>
  )
}

function RowMenu({ v, className }: { v: FeedVideo; className?: string }) {
  const log = useUsage()
  const [saved, setSaved] = React.useState(false)
  const pins = React.useContext(PinCtx)
  const hold = (e: React.SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }
  const actions: { label: string; icon: LucideIcon; on?: boolean; run: () => void }[] = [
    ...(pins ? [{ label: pins.pinned.includes(v.id) ? "Unpin" : "Pin to top", icon: Pin, on: pins.pinned.includes(v.id), run: () => pins.toggle(v.id) }] : []),
    { label: "Add to queue", icon: ListPlus, run: () => log("queue", v.id) },
    {
      label: saved ? "Saved to playlist" : "Save to playlist",
      icon: Bookmark,
      on: saved,
      run: () => {
        setSaved(!saved)
        log("bookmark", v.id, { on: !saved })
      },
    },
    {
      label: "Share",
      icon: Forward,
      run: () => {
        navigator.clipboard?.writeText(`${window.location.origin}/v/yt-${v.id}`).catch(() => {})
        log("share", v.id)
      },
    },
  ]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="More actions"
        onClick={hold}
        className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-slate-700 outline-none transition-colors hover:bg-slate-200/70 data-[popup-open]:bg-slate-200/70", className)}
      >
        <EllipsisVertical className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={hold} className="min-w-52 rounded-xl p-1.5">
        {actions.map(({ label, icon: Icon, on, run }) => (
          <DropdownMenuItem key={label} onClick={run} className="gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-800">
            <Icon className={cn("size-5! text-[#033882]! transition-colors group-focus/dropdown-menu-item:fill-[#dbe7fa]", on && "fill-[#033882]!")} />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** A full-width result row: landscape thumbnail, then title, meta, channel and
 *  the first line of the description. */
export function ListRow({ v }: { v: FeedVideo }) {
  return (
    <Link href={`/v/yt-${v.id}`} className="group relative isolate before:absolute before:-inset-3 before:-z-10 before:rounded-2xl before:border before:border-slate-200 before:bg-white before:transition-colors before:duration-200 hover:before:border-pax2-blue flex flex-col gap-3 sm:flex-row sm:gap-5">
      <div className="relative w-full shrink-0 overflow-hidden rounded-xl bg-slate-200 sm:w-[380px] md:w-[448px]">
        <HoverThumb v={v} aspect="aspect-video" />
        <Score v={v} />
        <span className="tabular pointer-events-none absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white">{dur(v.duration)}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <p className="font-display text-lg leading-snug text-slate-900">{v.title}</p>
          <RowMenu v={v} />
        </div>
        <p className="tabular text-sm text-pax2-blue">{age(v.published)}</p>
        <span className="flex items-center gap-2 pt-1">
          <Avatar id={v.channelId} />
          <span className="text-sm font-medium text-slate-800">{v.channel}</span>
        </span>
        {v.description && <p className="hidden pt-1 text-sm leading-relaxed text-slate-800 sm:line-clamp-2">{v.description}</p>}
        <CardFoot v={v} />
      </div>
    </Link>
  )
}

/** The grey ribbon under a thumbnail, inside its box: the channel, and opposite it the velocity score. */
function Ribbon({ v, compact }: { v: FeedVideo; compact?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-2", compact ? "px-2 py-1.5" : "px-2.5 py-2")}>
      <span className={cn("flex min-w-0 items-center", compact ? "gap-1.5" : "gap-2.5")}>
        <Avatar id={v.channelId} className={compact ? "size-6" : undefined} />
        <span className={cn("truncate text-slate-800", compact ? "text-sm" : "text-[15px]")}>{v.channel}</span>
      </span>
      <span aria-label="Views over the channel's median" className={cn("tabular shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold", scoreOf(v))}>
        {v.ratio >= 10 ? v.ratio.toFixed(0) : v.ratio.toFixed(1)}×
      </span>
    </div>
  )
}

/** One vertical Shorts card, laid out like the landscape one: the thumbnail with a play button on
 *  hover, the channel ribbon at its foot, then the title and the counts. */
export function ShortCard({ v }: { v: FeedVideo }) {
  return (
    <Link href={`/v/yt-${v.id}`} className="group relative isolate before:absolute before:-inset-3 before:-z-10 before:rounded-2xl before:border before:border-slate-200 before:bg-white before:transition-colors before:duration-200 hover:before:border-pax2-blue flex flex-col gap-1.5">
      <div className="overflow-hidden rounded-xl bg-slate-200">
        <div className="relative overflow-hidden">
          <HoverThumb v={v} aspect="aspect-[9/16]" playButton />
        </div>
        <Ribbon v={v} compact />
      </div>
      <div className="flex items-start justify-between gap-1 pt-1">
        <p className="line-clamp-2 min-h-[2lh] min-w-0 text-sm font-semibold leading-snug text-slate-900">{v.title}</p>
        <RowMenu v={v} className="-mr-1.5 size-8" />
      </div>
      <CardFoot v={v} boost />
    </Link>
  )
}

/** One landscape card, two or three across: the thumbnail in its own box, its running time in the
 *  corner and a play button on hover (the hover video plays inside it), then a grey ribbon with the
 *  channel and its velocity score, then the title, the description's first lines and the counts. */
export function LandscapeCard({ v }: { v: FeedVideo }) {
  return (
    <Link href={`/v/yt-${v.id}`} className="group relative isolate before:absolute before:-inset-3 before:-z-10 before:rounded-2xl before:border before:border-slate-200 before:bg-white before:transition-colors before:duration-200 hover:before:border-pax2-blue flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl bg-slate-200">
        <div className="relative overflow-hidden">
          <HoverThumb v={v} aspect="aspect-video" playButton />
          <span className="tabular pointer-events-none absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white">{dur(v.duration)}</span>
        </div>
        <Ribbon v={v} />
      </div>
      <div className="flex flex-col gap-1 pt-1">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 min-w-0 font-display text-lg font-semibold leading-snug text-slate-900">{v.title}</p>
          <RowMenu v={v} className="-mr-2 -mt-1" />
        </div>
        {v.description && <p className="line-clamp-2 text-[15px] leading-relaxed text-slate-800">{v.description}</p>}
      </div>
      <CardFoot v={v} boost />
    </Link>
  )
}

/** The Shorts shelf: a row of vertical cards, a second row behind Show more, and YouTube's
 *  rule-and-pill separator before the landscape rows resume. */
function ShortsShelf({ items }: { items: FeedVideo[] }) {
  const [more, setMore] = React.useState(false)
  return (
    <div className="flex flex-col gap-6">
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <img src="/logos/youtube-shorts.svg" alt="" className="h-5 w-auto" /> Shorts
      </span>
      <div className="grid grid-cols-2 gap-8 @3xl:grid-cols-4">
        {items.slice(0, more ? items.length : 4).map((v) => (
          <ShortCard key={v.id} v={v} />
        ))}
      </div>
      {items.length > 4 && (
        <div className="relative mt-3 flex justify-center">
          <span className="absolute inset-x-0 top-1/2 h-px bg-black/10" />
          <button
            type="button"
            onClick={() => setMore((m) => !m)}
            className="relative flex h-9 w-full max-w-sm items-center justify-center gap-2 rounded-full border border-black/10 bg-pax2-mist text-sm font-medium text-slate-900 transition-[filter] hover:brightness-95"
          >
            {more ? "Show fewer" : "Show more"} {more ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
          </button>
        </div>
      )}
    </div>
  )
}

/** Two landscape cards across, where the full-width rows used to stand. */
function Duo({ items }: { items: FeedVideo[] }) {
  return (
    <div className="grid gap-8 @xl:grid-cols-2">
      {items.map((v) => (
        <LandscapeCard key={v.id} v={v} />
      ))}
    </div>
  )
}

/** Three medium cards across — the shape of YouTube's related-videos band. */
function Trio({ items }: { items: FeedVideo[] }) {
  return (
    <div className="grid gap-8 @xl:grid-cols-2 @4xl:grid-cols-3">
      {items.map((v) => (
        <LandscapeCard key={v.id} v={v} />
      ))}
    </div>
  )
}

/** Missing counts sort last in either direction. */
const by = (pick: (v: FeedVideo) => number | null | undefined, dir: 1 | -1) => (a: FeedVideo, b: FeedVideo) => {
  const x = pick(a)
  const y = pick(b)
  if (x == null) return y == null ? 0 : 1
  if (y == null) return -1
  return (x - y) * dir
}
const posted = (v: FeedVideo) => new Date(v.published).getTime()

type Order = (a: FeedVideo, b: FeedVideo) => number
const paidFirst: Order = (a, b) => Number(!!b.paid) - Number(!!a.paid)

const perDay = (v: FeedVideo) => v.views / Math.max(1, (Date.now() - posted(v)) / 86_400_000)

/** The sort chips. A measured chip steps off → ↓ → ↑ → off; A–Z and Media are on or off, Media
 *  reading Earned (no ad spend, the default) until it's switched to Paid. Every chip that's on
 *  joins the order in the sequence it was switched on. Down is descending: newest, most, paid first. */
const SORT_KEYS = [
  { key: "date", label: "Date", pick: posted },
  { key: "trending", label: "Trending", pick: perDay },
  { key: "views", label: "Views", pick: (v: FeedVideo) => v.views },
  { key: "likes", label: "Likes", pick: (v: FeedVideo) => v.likes },
  { key: "comments", label: "Comments", pick: (v: FeedVideo) => v.comments },
  { key: "title", label: "A–Z", order: (a: FeedVideo, b: FeedVideo) => a.title.localeCompare(b.title) },
  { key: "media", label: "Earned", onLabel: "Paid", order: paidFirst },
  { key: "lab", label: "Lab Tested", order: ((a, b) => Number(!!b.lab) - Number(!!a.lab)) as Order },
] as const

type SortKey = (typeof SORT_KEYS)[number]["key"]
type FeedSort = { key: SortKey; dir: "down" | "up" }[]

/** One chip's next step. */
const step = (sorts: FeedSort, key: SortKey): FeedSort => {
  const on = sorts.find((s) => s.key === key)
  const measured = "pick" in SORT_KEYS.find((x) => x.key === key)!
  if (!on) return [...sorts, { key, dir: "down" }]
  if (measured && on.dir === "down") return sorts.map((s) => (s.key === key ? { key, dir: "up" } : s))
  return sorts.filter((s) => s.key !== key)
}

/** What narrows the feed beyond the search words. */
export type Refine = {
  sorts: FeedSort
  setSorts: (s: FeedSort) => void
  channel: string
  setChannel: (c: string) => void
  tag: string
  setTag: (t: string) => void
  channels: string[]
  tags: string[]
  /** Signed in: the For you order (src/lib/feed-rank.ts), which stands in for the chips while on. */
  forYou?: { on: boolean; toggle: () => void }
}

/** The skeleton grid while a server search is in flight: pulsing stand-ins in the result grid's shape. */
function SkeletonGrid({ cols }: { cols: string | null }) {
  return (
    <div aria-label="Loading results" className={cn("grid gap-8", cols ?? "md:grid-cols-2")}>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-video rounded-xl bg-slate-200" />
          <div className="mt-3 h-4 w-3/4 rounded bg-slate-200" />
          <div className="mt-2 h-4 w-1/2 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  )
}

/** One pass through the catalog as a mixed layout: a trio and a Shorts shelf first, then pairs,
 *  until the items run out. */
function Cycle({ items, ruled }: { items: FeedVideo[]; ruled?: boolean }) {
  const blocks: React.ReactNode[] = []
  const pattern = ["trio", "shorts", "list", "list", "list", "list"] as const
  let i = 0
  let p = 0
  while (i < items.length) {
    const kind = pattern[p % pattern.length]
    if (kind === "shorts" && items.length - i >= 8) {
      blocks.push(<ShortsShelf key={i} items={items.slice(i, i + 8)} />)
      i += 8
    } else if (kind === "trio" && items.length - i >= 3) {
      blocks.push(<Trio key={i} items={items.slice(i, i + 3)} />)
      i += 3
    } else {
      const take = Math.min(2, items.length - i)
      blocks.push(<Duo key={i} items={items.slice(i, i + take)} />)
      i += take
    }
    p += 1
  }
  // On the catalog page, YouTube's rule stands between groupings (the shelf's pill stays its own).
  if (ruled) return <>{blocks.flatMap((b, n) => (n ? [<span key={`rule-${n}`} className="h-px w-full bg-black/10" />, b] : [b]))}</>
  return <>{blocks}</>
}

/** Every word has to appear somewhere in the title, channel or description, in any order. */
export const matches = (v: FeedVideo, needle: string) => needle.split(/\s+/).filter(Boolean).every((w) => `${v.title} ${v.channel} ${v.description}`.toLowerCase().includes(w))

const RETURN = "pax2:feed-return"
const RECENT = "pax2:recent-searches"

/** The search bar, with the reader's recent searches dropping down beneath it while it's empty
 *  (govblock's search drop-down). A search is remembered on Enter. */
/** A one-line filter with autocomplete: matches drop beneath it as the reader types; a pick fills it. */
function Suggest({
  icon: Icon,
  placeholder,
  value,
  setValue,
  options,
}: {
  icon: LucideIcon
  placeholder: string
  value: string
  setValue: (v: string) => void
  options: string[]
}) {
  const [text, setText] = React.useState(value)
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => setText(value), [value])
  const needle = text.trim().toLowerCase()
  const hits = needle && needle !== value.toLowerCase() ? options.filter((o) => o.toLowerCase().includes(needle)).slice(0, 6) : []
  const pick = (o: string) => {
    setValue(o)
    setText(o)
    setOpen(false)
  }
  return (
    <div className="relative">
      <div className="flex h-10 items-center gap-2 rounded-full border border-slate-200 px-3.5 transition-colors focus-within:border-pax2-blue">
        <Icon aria-hidden className="size-4 shrink-0 text-slate-400" />
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
            if (e.target.value === "") setValue("")
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && hits[0]) {
              e.preventDefault()
              pick(hits[0])
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
        {text !== "" && (
          <button
            type="button"
            aria-label={`Clear ${placeholder.toLowerCase()}`}
            onClick={() => {
              setText("")
              setValue("")
            }}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {open && hits.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {hits.map((o) => (
            <li key={o}>
              <button type="button" onClick={() => pick(o)} className="w-full truncate px-3.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 hover:text-pax2-blue">
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The search bar, which grows downward into one panel: recent searches while it's empty and
 *  focused (govblock's search drop-down), or — from the sliders at its right end — channel and
 *  tag filters over the sort chips.
 *  A search is remembered on Enter. */
export function SearchBar({
  q,
  setQ,
  placeholder = "Search videos",
  className,
  refine,
  trending,
}: {
  q: string
  setQ: (q: string) => void
  placeholder?: string
  className?: string
  refine?: Refine
  /** Videos to offer under Trending while the bar is empty and focused. */
  trending?: FeedVideo[]
}) {
  const [focused, setFocused] = React.useState(false)
  const [sorting, setSorting] = React.useState(false)
  const [recent, setRecent] = React.useState<string[]>([])
  const root = React.useRef<HTMLDivElement>(null)
  const input = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => setRecent(JSON.parse(localStorage.getItem(RECENT) ?? "[]") as string[]), [])
  // The sort panel holds no focus, so a click anywhere else is what closes it.
  React.useEffect(() => {
    if (!sorting) return
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setSorting(false)
    }
    document.addEventListener("pointerdown", away)
    return () => document.removeEventListener("pointerdown", away)
  }, [sorting])
  const save = (next: string[]) => {
    setRecent(next)
    localStorage.setItem(RECENT, JSON.stringify(next))
  }
  const log = useUsage()
  const submit = () => {
    const term = q.trim()
    if (term.length >= 2) save([term, ...recent.filter((r) => r !== term)].slice(0, 8))
    if (term) log("search", term)
    input.current?.blur()
  }
  const run = (term: string) => {
    log("search", term, { from: "recent" })
    setQ(term)
    save([term, ...recent.filter((r) => r !== term)].slice(0, 8))
    setFocused(false)
    input.current?.blur()
  }
  const showRecent = !sorting && focused && q === "" && (recent.length > 0 || !!trending?.length)
  const open = sorting || showRecent
  const refined = !!refine && (refine.sorts.length > 0 || refine.channel !== "" || refine.tag !== "" || !!refine.forYou?.on)
  // Open, bar and panel share one border: pax blue on the landing's dressed bar, slate otherwise.
  const edge = className ? "border-pax2-blue" : "border-slate-200"
  return (
    <div
      ref={root}
      className="relative w-full"
      onFocusCapture={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
      }}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return
        setFocused(false)
        setSorting(false)
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className={cn(
          "flex items-center rounded-[28px] border bg-white transition-[box-shadow,border-color,background-color]",
          className ?? "h-11 border-slate-200 shadow-e1 focus-within:shadow-e2",
          open && cn("rounded-b-none hover:bg-white", edge),
        )}
      >
        <Search aria-hidden className="ml-5 size-4 shrink-0 text-slate-400" />
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          enterKeyHint="search"
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
        />
        {(q !== "" || sorting) && (
          <button
            type="button"
            aria-label={sorting && q === "" ? "Close" : "Clear search"}
            onClick={() => {
              setQ("")
              setSorting(false)
              input.current?.focus()
            }}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="size-5" />
          </button>
        )}
        {/* Google's AI Mode pill: the question goes to the chat instead. */}
        {refine && (
          <Link href="/chat" className="ml-1 flex h-10 shrink-0 items-center whitespace-nowrap rounded-full bg-slate-100 px-4 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-200">
            AI Mode
          </Link>
        )}
        {refine ? (
          <button
            type="button"
            aria-label="Filter and sort"
            aria-expanded={sorting}
            onClick={() => setSorting((o) => !o)}
            className={cn(
              "relative ml-1 mr-2 flex size-10 shrink-0 items-center justify-center rounded-full transition-colors",
              sorting ? "bg-[#dbe7fa] text-[#033882]" : "text-slate-500 hover:bg-slate-100 hover:text-[#033882]",
            )}
          >
            <SlidersHorizontal className="size-5" />
            {refined && !sorting && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-pax2-blue ring-2 ring-white" />}
          </button>
        ) : (
          <span className="w-3" />
        )}
      </form>
      {open && (
        <div
          className={cn("absolute inset-x-0 top-full z-50 -mt-px rounded-b-[28px] border border-t-0 bg-white text-left shadow-lg", edge)}
          // Clicks inside keep the search's focus — except into the filter inputs, which take it.
          onMouseDown={(e) => {
            if (!(e.target instanceof HTMLInputElement)) e.preventDefault()
          }}
        >
          <div className="mx-5 border-t border-slate-200" />
          {sorting && refine ? (
            <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <Suggest icon={UserRound} placeholder="Channel" value={refine.channel} setValue={refine.setChannel} options={refine.channels} />
                <Suggest icon={Tag} placeholder="Tags" value={refine.tag} setValue={refine.setTag} options={refine.tags} />
              </div>
              <div>
                <div className="flex h-6 items-center justify-between">
                  <h2 className="text-sm font-medium text-slate-500">Sort by</h2>
                  {refined && (
                    <button
                      type="button"
                      onClick={() => {
                        refine.setSorts([])
                        refine.setChannel("")
                        refine.setTag("")
                        if (refine.forYou?.on) refine.forYou.toggle()
                      }}
                      className="text-sm font-medium text-pax2-blue hover:underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {refine.forYou && (
                    <button
                      type="button"
                      aria-pressed={refine.forYou.on}
                      onClick={refine.forYou.toggle}
                      className={cn(
                        "flex h-9 w-full items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
                        refine.forYou.on ? "border-pax2-blue bg-pax2-blue text-white" : "border-slate-200 text-slate-700 hover:border-pax2-blue hover:text-pax2-blue",
                      )}
                    >
                      For you
                    </button>
                  )}
                  {SORT_KEYS.map((k) => {
                    const at = refine.sorts.findIndex((x) => x.key === k.key)
                    const on = at >= 0 ? refine.sorts[at] : null
                    const Icon = k.key === "lab" ? FlaskConical : k.key === "title" ? ArrowDownAZ : !on ? ArrowUpDown : on.dir === "up" ? ArrowUpNarrowWide : ArrowDownWideNarrow
                    return (
                      <button
                        key={k.key}
                        type="button"
                        aria-pressed={!!on}
                        onClick={() => refine.setSorts(step(refine.sorts, k.key))}
                        className={cn(
                          "flex h-9 w-full items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
                          on ? "border-pax2-blue bg-pax2-blue text-white" : "border-slate-200 text-slate-700 hover:border-pax2-blue hover:text-pax2-blue",
                        )}
                      >
                        {/* With more than one chip on, each shows its place in the order. */}
                        {on && refine.sorts.length > 1 && <span className="tabular text-xs opacity-75">{at + 1}</span>}
                        {on && "onLabel" in k ? k.onLabel : k.label}
                        <Icon aria-hidden className="size-4" />
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex max-h-[min(32rem,65svh)] flex-col gap-4 overflow-y-auto rounded-b-[28px] px-5 pb-4 pt-3">
              {recent.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-slate-800">
                    Recent searches <span className="tabular">({recent.length})</span>
                  </h2>
                  <ul className="mt-2 flex flex-col">
                    {recent.map((term) => (
                      <li key={term} className="group border-b py-0.5 last:border-0">
                        <div className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted hover:text-foreground">
                          <button type="button" onClick={() => run(term)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left text-sm">
                            <Clock className="size-4 shrink-0 text-slate-800" />
                            <span className="truncate">{term}</span>
                          </button>
                          <button
                            type="button"
                            aria-label={`Forget ${term}`}
                            onClick={() => save(recent.filter((r) => r !== term))}
                            className="shrink-0 rounded p-1 text-slate-800 opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-100"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!!trending?.length && (
                <div>
                  <h2 className="text-sm font-medium text-slate-800">Trending</h2>
                  <ul className="mt-2 flex flex-col">
                    {trending.map((v) => (
                      <li key={v.id} className="border-b py-0.5 last:border-0">
                        <Link
                          href={`/v/yt-${v.id}`}
                          className="group/trend -mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-muted hover:text-pax2-blue"
                        >
                          <TrendingUp className="size-4 shrink-0 text-pax2-blue" />
                          <span className="min-w-0 flex-1 truncate">{v.title}</span>
                          <span className="hidden shrink-0 text-xs font-medium text-slate-500 transition-colors group-hover/trend:text-pax2-blue sm:inline">{v.channel}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function Feed({ initial, total, cursor, facets }: { initial: FeedVideo[]; total: number; cursor: number; facets: { channels: string[]; tags: string[] } }) {
  // The browse pool: the server's first page, then a page per scroll through /api/feed. A search or
  // filter never touches the pool — it queries the full index server-side and lands in `results`.
  const [pages, setPages] = React.useState<FeedVideo[][]>([initial])
  const pool = React.useMemo(() => pages.flat(), [pages])
  const reach = React.useRef(cursor)
  const [exhausted, setExhausted] = React.useState(cursor >= total)
  const loading = React.useRef(false)
  const [results, setResults] = React.useState<FeedVideo[] | null>(null)
  const visible = React.useMemo(() => (results ? [...pool, ...results] : pool), [pool, results])
  const boost = useBoostState(visible)
  // The pinned row (Lab Tested by default) leads the feed. In local development it opens on the
  // paid media — Voter Freedom, paid first, then most viewed — Brendan's working view.
  const pins = usePins(pool)
  const dev = process.env.NODE_ENV === "development"
  const [q, setQ] = React.useState(dev ? "Voter Freedom" : "")
  const [sorts, setSortsState] = React.useState<FeedSort>(dev ? [{ key: "media", dir: "down" }, { key: "views", dir: "down" }] : [])
  const [channel, setChannelState] = React.useState("")
  const [tag, setTagState] = React.useState("")
  const log = useUsage()
  const setSorts = (next: FeedSort) => {
    setSortsState(next)
    log("sort", next.map((x) => `${x.key}:${x.dir}`).join(",") || "none")
  }
  const setChannel = (c: string) => {
    setChannelState(c)
    log("filter", c || "none", { field: "channel" })
  }
  const setTag = (t: string) => {
    setTagState(t)
    log("filter", t || "none", { field: "tag" })
  }
  // Signed in, the For you chip orders the feed by recency, ratio and what PAX2's readers opened.
  const [signedIn, setSignedIn] = React.useState(false)
  const [forYou, setForYou] = React.useState(false)
  const [events, setEvents] = React.useState<RankEvent[]>([])
  const [mine, setMine] = React.useState<RankEvent[]>([])
  React.useEffect(() => {
    viewer().then((u) => setSignedIn(!!u)).catch(() => {})
  }, [])
  const toggleForYou = () => {
    const on = !forYou
    setForYou(on)
    log("sort", on ? "foryou" : "none")
    if (on) {
      usageSince(7).then(setEvents).catch(() => {})
      myUsageSince(90, readerId()).then(setMine).catch(() => {})
    }
  }
  const { channels, tags } = facets
  const trending = React.useMemo(() => pool.toSorted(by(perDay, -1)).slice(0, 6), [pool])
  // A drawer's channel name searches this feed (take-panel.tsx); a ?q= in the address does the same on arrival.
  React.useEffect(() => {
    document.documentElement.dataset.feed = "1"
    const initial = new URLSearchParams(window.location.search).get("q")
    if (initial) setQ(initial)
    const on = (e: Event) => setQ((e as CustomEvent<string>).detail)
    window.addEventListener("pax2:search", on)
    return () => {
      delete document.documentElement.dataset.feed
      window.removeEventListener("pax2:search", on)
    }
  }, [])
  /** The next browse page from the server, appended once, deduplicated against the pool. */
  const loadMore = React.useCallback(() => {
    if (loading.current || reach.current >= total) return
    loading.current = true
    fetch(`/api/feed?cursor=${reach.current}&limit=48`)
      .then((r) => r.json())
      .then((d: { videos: FeedVideo[]; nextCursor: number | null }) => {
        setPages((p) => {
          const have = new Set(p.flat().map((v) => v.id))
          return [...p, d.videos.filter((v) => !have.has(v.id))]
        })
        reach.current = d.nextCursor ?? total
        if (reach.current >= total) setExhausted(true)
      })
      .catch(() => {})
      .finally(() => {
        loading.current = false
      })
  }, [total])

  const sentinel = React.useRef<HTMLDivElement>(null)
  const section = React.useRef<HTMLElement>(null)
  const path = usePathname()
  const landing = path === "/"

  // Opening a video from the landing remembers where the reader was; coming back puts them there
  // again — never above the point where the search bar sticks.
  const remember = (e: React.MouseEvent) => {
    if (landing && (e.target as HTMLElement).closest('a[href^="/v/"]')) sessionStorage.setItem(RETURN, JSON.stringify({ y: window.scrollY, reach: reach.current }))
  }
  React.useEffect(() => {
    if (!landing) return
    const saved = sessionStorage.getItem(RETURN)
    if (!saved) return
    sessionStorage.removeItem(RETURN)
    const { y, reach: r } = JSON.parse(saved) as { y: number; reach?: number }
    const scroll = () =>
      requestAnimationFrame(() => {
        const top = (section.current?.getBoundingClientRect().top ?? 0) + window.scrollY
        window.scrollTo({ top: Math.max(y, top), behavior: "instant" })
      })
    // The pool reloads to where the reader had scrolled before the jump, then the scroll lands.
    if (r && r > reach.current) {
      fetch(`/api/feed?cursor=${reach.current}&limit=${Math.min(200, r - reach.current)}`)
        .then((res) => res.json())
        .then((d: { videos: FeedVideo[]; nextCursor: number | null }) => {
          setPages((p) => {
            const have = new Set(p.flat().map((v) => v.id))
            return [...p, d.videos.filter((v) => !have.has(v.id))]
          })
          reach.current = d.nextCursor ?? total
          scroll()
        })
        .catch(scroll)
    } else scroll()
  }, [landing, total])

  const needle = q.trim().toLowerCase()
  // Narrowed by words, channel or tag, or re-ordered by chips, the feed queries the full index
  // server-side and shows a finite result list; browsing pages the index newest-first.
  const narrowed = !!needle || channel !== "" || tag !== ""
  const queried = narrowed || sorts.length > 0
  React.useEffect(() => {
    if (!queried) {
      setResults(null)
      return
    }
    const t = setTimeout(() => {
      const p = new URLSearchParams()
      if (needle) p.set("q", needle)
      if (channel) p.set("channel", channel)
      if (tag) p.set("tag", tag)
      if (sorts.length) p.set("sort", sorts.map((s) => `${s.key}:${s.dir}`).join(","))
      p.set("limit", "120")
      fetch(`/api/feed?${p}`)
        .then((r) => r.json())
        .then((d: { videos: FeedVideo[] }) => setResults(d.videos))
        .catch(() => setResults([]))
    }, 200)
    return () => clearTimeout(t)
  }, [queried, needle, channel, tag, sorts])
  const base = queried ? (results ?? []) : pool
  const ordered = React.useMemo(() => (forYou ? rankFeed(base, events, Date.now(), mine, [...boost.mine]) : base), [forYou, base, events, mine, boost.mine])
  // The pinned row leads the unnarrowed feed, in the order pinned; its videos leave the cycles below.
  const pinnedVideos = React.useMemo(() => pins.pinned.map((id) => pool.find((v) => v.id === id)).filter((v): v is FeedVideo => !!v), [pins.pinned, pool])
  const pinSet = React.useMemo(() => new Set(pins.pinned), [pins.pinned])
  // With a video's drawer open beside the feed, search results lay out as a grid sized to the feed's
  // own width — three, two or one across — so a dragged split works the same as a preset one.
  const { panelOpen } = useShellPanel()
  const resultCols = panelOpen ? "@xl:grid-cols-2 @4xl:grid-cols-3" : null

  // Infinite scroll: the spinner coming into view pages the index in from the server, until the
  // whole catalog has arrived.
  React.useEffect(() => {
    const el = sentinel.current
    if (!el || queried || exhausted) return
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) loadMore()
    }, { rootMargin: "900px" })
    io.observe(el)
    return () => io.disconnect()
  }, [queried, exhausted, loadMore])

  return (
    <BoostCtx.Provider value={boost}>
    <PinCtx.Provider value={pins}>
    <section ref={section} onClickCapture={remember} className="@container mx-auto w-full max-w-6xl px-6 pb-16">
      {/* On the landing it sticks just beneath the 4rem header, never inside it; inside the
          shell's scroll pane (a video's page) there is no such header, so it sticks at the top. */}
      <div className={cn("sticky z-40 mx-auto w-full max-w-2xl", landing ? "top-[4.75rem]" : "top-3")}>
        {/* Dressed as section two's Try it. */}
        <SearchBar
          q={q}
          setQ={setQ}
          refine={{ sorts, setSorts, channel, setChannel, tag, setTag, channels, tags, forYou: signedIn ? { on: forYou, toggle: toggleForYou } : undefined }}
          trending={trending}
          className="h-14 border-slate-400 shadow-md hover:border-pax2-blue hover:bg-slate-50 focus-within:border-pax2-blue"
        />
      </div>

      <div className="flex flex-col gap-10 pt-10">
        {queried && results === null ? (
          <SkeletonGrid cols={resultCols} />
        ) : ordered.length === 0 ? (
          <p className="py-16 text-center text-slate-500">{needle ? <>Nothing matches &ldquo;{q}&rdquo;.</> : "Nothing matches these filters."}</p>
        ) : queried ? (
          resultCols ? (
            <div className={cn("grid gap-8", resultCols)}>
              {ordered.map((v) => (
                <LandscapeCard key={v.id} v={v} />
              ))}
            </div>
          ) : (
            <Cycle items={ordered} ruled={!landing} />
          )
        ) : (
          <>
            {pinnedVideos.length > 0 && <PinnedRow items={pinnedVideos} />}
            {pages.map((p, c) => {
              const items = p.filter((v) => !pinSet.has(v.id))
              return items.length ? <Cycle key={c} items={items} ruled={!landing} /> : null
            })}
          </>
        )}
      </div>

      {!queried && !exhausted && (
        <div ref={sentinel} className="flex justify-center py-12">
          <span aria-label="Loading more" className="size-8 animate-spin rounded-full border-[3px] border-slate-300 border-t-pax2-blue" />
        </div>
      )}
    </section>
    </PinCtx.Provider>
    </BoostCtx.Provider>
  )
}
