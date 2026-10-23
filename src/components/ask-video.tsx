'use client'

import * as React from 'react'
import { MessagesSquare } from 'lucide-react'

import { chipOffers } from '@/app/question-actions'
import { useColumnTab } from '@/components/aside-tabs'
import { useShellPanel } from '@/components/shell'
import { Skeleton } from '@/ui/components/nova/skeleton'
import type { ChipTab } from '@/lib/question-resolver'
import { useUsage } from '@/components/usage-beacon'
import type { ChipOffer } from '@/lib/question-resolver'

// The video page's question row, top of the wide column: Ask about this video, then up to three of this
// video's suggested prompts from the question bank (src/lib/question-bank.ts), always one line: a prompt
// that does not fit the column's width whole is hidden, never wrapped or cut. Each opens the shell's
// discussion panel with this video attached, and a prompt is asked there at once from the stored
// measurements. Only the prompts on screen are logged as shown. ?ask=1 opens the panel on load. Under the
// wide column's tabs, the three prompts follow the open tab (Brendan, 2026-10-23): each tab draws its own,
// skeleton pills holding their place through the switch; a tab's draw is kept for the visit.
const MAX = 3
const HOLD_MS = 350

export function AskVideo({ ytId, title }: { ytId: string; title: string }) {
  const { askAbout } = useShellPanel()
  const logUsage = useUsage()
  const tab = useColumnTab() as ChipTab | null
  const [chips, setChips] = React.useState<ChipOffer[]>([])
  const [loading, setLoading] = React.useState(true)
  const drawn = React.useRef(new Map<string, ChipOffer[]>())
  const [fit, setFit] = React.useState(0)
  const row = React.useRef<HTMLDivElement>(null)
  const logged = React.useRef(new Set<string>())
  const context = React.useCallback(() => `ACTIVE CONTEXT — the user is on the video page of the short "${title}" (/v/yt-${ytId}) and asks about it.`, [title, ytId])

  React.useEffect(() => {
    let live = true
    const key = tab ?? ''
    const kept = drawn.current.get(key)
    setLoading(true)
    const started = Date.now()
    const offers = kept ? Promise.resolve(kept) : chipOffers(ytId, 'video-panel', [], tab ?? undefined)
    offers
      .then((cs) => {
        drawn.current.set(key, cs)
        setTimeout(() => {
          if (!live) return
          setChips(cs.slice(0, MAX))
          setLoading(false)
        }, Math.max(0, HOLD_MS - (Date.now() - started)))
      })
      .catch(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [ytId, tab])

  // How many prompts fit whole on the one line, re-measured as the column resizes.
  React.useLayoutEffect(() => {
    const el = row.current
    if (!el) return
    const measure = () => {
      const kids = Array.from(el.querySelectorAll<HTMLElement>('[data-chip]'))
      let n = 0
      for (const k of kids) {
        if (k.offsetLeft + k.offsetWidth <= el.clientWidth) n++
        else break
      }
      setFit(n)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [chips, loading])

  React.useEffect(() => {
    if (loading) return
    chips.slice(0, fit).forEach((c) => {
      const k = `${ytId}:${c.id}`
      if (logged.current.has(k)) return
      logged.current.add(k)
      logUsage('chip-shown', c.id, { position: c.position, propensity: c.propensity, surface: 'video-panel', videoId: ytId, ...(tab && { tab }) })
    })
  }, [chips, fit, loading, ytId, tab, logUsage])

  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get('ask') === '1') askAbout({ context, chipVideo: ytId })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={row} className="relative -m-1 flex flex-nowrap items-center gap-2 overflow-hidden p-1">
      <button
        type="button"
        onClick={() => askAbout({ context, chipVideo: ytId })}
        className="press flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-e1 transition-colors hover:border-pax2-light-blue hover:text-pax2-blue"
      >
        <MessagesSquare className="size-4" style={{ color: '#033882', fill: '#dbe7fa' }} />
        Ask about this video
      </button>
      {loading &&
        ['w-44', 'w-56', 'w-52'].map((w) => <Skeleton key={w} className={`h-[34px] shrink-0 rounded-full ${w}`} />)}
      {!loading && chips.map((c, i) => (
        <button
          key={c.id}
          data-chip
          type="button"
          aria-hidden={i >= fit}
          tabIndex={i >= fit ? -1 : 0}
          onClick={() => askAbout({ context, chipVideo: ytId, ask: c })}
          className={`shrink-0 whitespace-nowrap rounded-full border border-[var(--border,#e2e8f0)] bg-white px-3.5 py-1.5 text-sm text-slate-700 transition-colors hover:border-pax2-light-blue hover:text-pax2-blue ${i >= fit ? 'invisible' : ''}`}
        >
          {c.ask}
        </button>
      ))}
    </div>
  )
}
