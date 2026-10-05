"use client"

/* eslint-disable @next/next/no-img-element */

import * as React from "react"
import Link from "next/link"
import { Search, Video, X } from "lucide-react"

import { cn } from "@/ui/lib/utils"

export type FeedVideo = {
  id: string
  title: string
  channel: string
  views: number
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
        <img src={thumb(v.id)} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
      )}
    </span>
  )
}

function Avatar({ name }: { name: string }) {
  return <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pax-lavender text-sm font-semibold text-pax-ink">{name[0]}</span>
}

/** A full-width result row: landscape thumbnail, then title, meta, channel and
 *  the first line of the description. */
function ListRow({ v }: { v: FeedVideo }) {
  return (
    <Link href={`/v/yt-${v.id}`} className="group flex flex-col gap-3 sm:flex-row sm:gap-5">
      <div className="relative w-full shrink-0 overflow-hidden rounded-xl bg-slate-200 sm:w-[340px] md:w-[400px]">
        <HoverThumb v={v} aspect="aspect-video" />
        <span className="tabular pointer-events-none absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white">{dur(v.duration)}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="font-display text-lg leading-snug text-slate-900 group-hover:text-pax-plum">{v.title}</p>
        <p className="tabular text-sm text-slate-500">{fmt.format(v.views)} views · {age(v.published)}</p>
        <span className="flex items-center gap-2 pt-1">
          <Avatar name={v.channel} />
          <span className="text-sm text-slate-600">{v.channel}</span>
        </span>
        {v.description && <p className="hidden pt-1 text-sm leading-relaxed text-slate-500 sm:line-clamp-2">{v.description}</p>}
      </div>
    </Link>
  )
}

/** The Shorts shelf: a row of vertical cards. */
function ShortsShelf({ items }: { items: FeedVideo[] }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Video className="size-4 text-pax-red" /> Shorts
      </span>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {items.map((v) => (
          <Link key={v.id} href={`/v/yt-${v.id}`} className="group flex flex-col gap-1.5">
            <div className="relative overflow-hidden rounded-xl bg-slate-200">
              <HoverThumb v={v} aspect="aspect-[9/16]" />
            </div>
            <p className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-900 group-hover:text-pax-plum">{v.title}</p>
            <p className="tabular text-xs text-slate-500">{fmt.format(v.views)} views</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

/** Three medium cards across — the shape of YouTube's related-videos band. */
function Trio({ items }: { items: FeedVideo[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map((v) => (
        <Link key={v.id} href={`/v/yt-${v.id}`} className="group flex flex-col gap-2">
          <div className="relative overflow-hidden rounded-xl bg-slate-200">
            <HoverThumb v={v} aspect="aspect-video" />
            <span className="tabular pointer-events-none absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white">{dur(v.duration)}</span>
          </div>
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 group-hover:text-pax-plum">{v.title}</p>
          <p className="tabular text-xs text-slate-500">{v.channel} · {fmt.format(v.views)} views</p>
        </Link>
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
    if (kind === "shorts" && items.length - i >= 6) {
      blocks.push(<ShortsShelf key={i} items={items.slice(i, i + 6)} />)
      i += 6
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

export function Feed({ videos }: { videos: FeedVideo[] }) {
  const [q, setQ] = React.useState("")
  const [cycles, setCycles] = React.useState(1)
  const sentinel = React.useRef<HTMLDivElement>(null)

  const needle = q.trim().toLowerCase()
  const shown = needle ? videos.filter((v) => `${v.title} ${v.channel} ${v.description}`.toLowerCase().includes(needle)) : videos

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
    <section className="mx-auto w-full max-w-6xl px-6 pb-16">
      <div className="sticky top-2.5 z-40 mx-auto w-full max-w-2xl">
        <label className="flex h-11 items-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-e1 transition-shadow focus-within:shadow-e2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search videos"
            aria-label="Search videos"
            className="h-full min-w-0 flex-1 bg-transparent px-5 text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
          />
          {q !== "" && (
            <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="flex h-full items-center px-2 text-slate-400 hover:text-slate-700">
              <X className="size-4" />
            </button>
          )}
          <span className="flex h-full items-center border-l border-slate-200 bg-pax-mist px-5 text-slate-500">
            <Search className="size-4" />
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-8 pt-10">
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
  )
}
