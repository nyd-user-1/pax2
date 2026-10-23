'use client'

import * as React from 'react'
import { MessagesSquare } from 'lucide-react'

import { chipOffers } from '@/app/question-actions'
import { useShellPanel } from '@/components/shell'
import { useUsage } from '@/components/usage-beacon'
import type { ChipOffer } from '@/lib/question-resolver'

// The video page's question row, above every block: Ask about this video, then this video's suggested
// prompts from the question bank (src/lib/question-bank.ts). Each opens the shell's discussion panel
// with this video attached, and a prompt is asked there at once from the stored measurements. ?ask=1
// opens the panel on load.
export function AskVideo({ ytId, title }: { ytId: string; title: string }) {
  const { askAbout } = useShellPanel()
  const logUsage = useUsage()
  const [chips, setChips] = React.useState<ChipOffer[]>([])
  const context = React.useCallback(() => `ACTIVE CONTEXT — the user is on the video page of the short "${title}" (/v/yt-${ytId}) and asks about it.`, [title, ytId])

  React.useEffect(() => {
    let live = true
    chipOffers(ytId, 'video-panel')
      .then((cs) => {
        if (!live) return
        setChips(cs)
        for (const c of cs) logUsage('chip-shown', c.id, { position: c.position, propensity: c.propensity, surface: 'video-panel', videoId: ytId })
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [ytId, logUsage])

  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get('ask') === '1') askAbout({ context, chipVideo: ytId })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => askAbout({ context, chipVideo: ytId })}
        className="press flex shrink-0 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-e1 transition-colors hover:border-pax2-light-blue hover:text-pax2-blue"
      >
        <MessagesSquare className="size-4" style={{ color: '#033882', fill: '#dbe7fa' }} />
        Ask about this video
      </button>
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => askAbout({ context, chipVideo: ytId, ask: c })}
          className="rounded-full border border-[var(--border,#e2e8f0)] bg-white px-3.5 py-1.5 text-sm text-slate-700 transition-colors hover:border-pax2-light-blue hover:text-pax2-blue"
        >
          {c.ask}
        </button>
      ))}
    </div>
  )
}
