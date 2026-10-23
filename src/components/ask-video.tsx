'use client'

import * as React from 'react'
import { MessagesSquare } from 'lucide-react'

import { chipOffers } from '@/app/question-actions'
import { useColumnTab } from '@/components/aside-tabs'
import { useShellPanel } from '@/components/shell'
import { useUsage } from '@/components/usage-beacon'
import type { ChipOffer, ChipTab } from '@/lib/question-resolver'
import { Skeleton } from '@/ui/components/nova/skeleton'

// The video page's question row, under the wide column's tab rail: Ask about this video, then three of this
// video's suggested prompts from the question bank (src/lib/question-bank.ts), always one line, never
// wrapped or cut. Each opens the shell's discussion panel with this video attached, and a prompt is asked
// there at once from the stored measurements. ?ask=1 opens the panel on load.
// The prompts follow the open tab (Brendan, 2026-10-23): each tab draws up to eight in random order, and
// the row shows the first three of them, in that order, that fit its width whole, re-chosen as the column
// resizes, so a long prompt gives way to a shorter one instead of leaving a gap. Skeleton pills hold the
// row's shape through a switch for at least 350 ms; a tab's draw is kept for the visit. Only the prompts
// on screen are logged as shown.
const MAX = 3
const HOLD_MS = 350
const GAP = 8
const CHIP = 'shrink-0 whitespace-nowrap rounded-full border border-[var(--border,#e2e8f0)] bg-white px-3.5 py-1.5 text-sm text-slate-700'

export function AskVideo({ ytId, title }: { ytId: string; title: string }) {
  const { askAbout } = useShellPanel()
  const logUsage = useUsage()
  const tab = useColumnTab() as ChipTab | null
  const [chips, setChips] = React.useState<ChipOffer[]>([])
  const [loading, setLoading] = React.useState(true)
  const [shown, setShown] = React.useState<ChipOffer[] | null>(null)
  const drawn = React.useRef(new Map<string, ChipOffer[]>())
  const row = React.useRef<HTMLDivElement>(null)
  const ask = React.useRef<HTMLButtonElement>(null)
  const measure = React.useRef<HTMLDivElement>(null)
  const logged = React.useRef(new Set<string>())
  const context = React.useCallback(() => `ACTIVE CONTEXT — the user is on the video page of the short "${title}" (/v/yt-${ytId}) and asks about it.`, [title, ytId])

  React.useEffect(() => {
    let live = true
    const key = tab ?? ''
    const kept = drawn.current.get(key)
    setLoading(true)
    setShown(null)
    const started = Date.now()
    const offers = kept ? Promise.resolve(kept) : chipOffers(ytId, 'video-panel', [], tab ?? undefined)
    offers
      .then((cs) => {
        drawn.current.set(key, cs)
        setTimeout(() => {
          if (!live) return
          setChips(cs)
          setLoading(false)
        }, Math.max(0, HOLD_MS - (Date.now() - started)))
      })
      .catch(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [ytId, tab])

  // The first three of the draw that fit whole beside the Ask button, measured off-screen, re-chosen as
  // the column resizes.
  React.useLayoutEffect(() => {
    const el = row.current
    if (!el || loading) return
    const choose = () => {
      const room = el.clientWidth - 8 - (ask.current?.offsetWidth ?? 0)
      const widths = Array.from(measure.current?.querySelectorAll<HTMLElement>('[data-measure]') ?? []).map((m) => m.offsetWidth)
      const picked: ChipOffer[] = []
      let used = 0
      chips.forEach((c, i) => {
        const w = widths[i] ?? Infinity
        if (picked.length < MAX && used + GAP + w <= room) {
          picked.push(c)
          used += GAP + w
        }
      })
      setShown(picked)
    }
    choose()
    const ro = new ResizeObserver(choose)
    ro.observe(el)
    return () => ro.disconnect()
  }, [chips, loading])

  React.useEffect(() => {
    shown?.forEach((c) => {
      const k = `${ytId}:${c.id}`
      if (logged.current.has(k)) return
      logged.current.add(k)
      logUsage('chip-shown', c.id, { position: c.position, propensity: c.propensity, surface: 'video-panel', videoId: ytId, ...(tab && { tab }) })
    })
  }, [shown, ytId, tab, logUsage])

  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get('ask') === '1') askAbout({ context, chipVideo: ytId })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={row} className="relative -m-1 flex flex-nowrap items-center gap-2 overflow-hidden p-1">
      <button
        ref={ask}
        type="button"
        onClick={() => askAbout({ context, chipVideo: ytId })}
        className="press flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-e1 transition-colors hover:border-pax2-light-blue hover:text-pax2-blue"
      >
        <MessagesSquare className="size-4" style={{ color: '#033882', fill: '#dbe7fa' }} />
        Ask about this video
      </button>
      {shown === null
        ? ['w-44', 'w-56', 'w-52'].map((w) => <Skeleton key={w} className={`h-[34px] shrink-0 rounded-full ${w}`} />)
        : shown.map((c) => (
            <button key={c.id} type="button" onClick={() => askAbout({ context, chipVideo: ytId, ask: c })} className={`${CHIP} transition-colors hover:border-pax2-light-blue hover:text-pax2-blue`}>
              {c.ask}
            </button>
          ))}
      {/* Off-screen: every prompt of the draw at its own width, for choosing the three that fit. */}
      <div ref={measure} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex gap-2">
        {chips.map((c) => (
          <span key={c.id} data-measure className={CHIP}>
            {c.ask}
          </span>
        ))}
      </div>
    </div>
  )
}
