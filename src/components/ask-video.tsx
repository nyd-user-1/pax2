'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { MessagesSquare, X } from 'lucide-react'

import { Chat } from '@/components/chat/chat'
import { whiteButton } from '@/components/white-button'

// The video page's question button: the chat opens in a right panel at the standing 420px, preloaded with
// this video, its chips drawn from the question bank (src/lib/question-bank.ts). The panel is its own,
// over the page or the drawer alike; ?ask=1 opens it on load.
export function AskVideo({ ytId, title }: { ytId: string; title: string; inDrawer?: boolean }) {
  const [open, setOpen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
    if (new URLSearchParams(window.location.search).get('ask') === '1') setOpen(true)
  }, [])
  const context = React.useCallback(() => `ACTIVE CONTEXT — the user is on the video page of the short "${title}" (/v/yt-${ytId}) and asks about it.`, [title, ytId])
  return (
    <>
      <button
        type="button"
        aria-pressed={open}
        onClick={() => setOpen((v) => !v)}
        className="press mx-auto flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-e1 transition-colors hover:border-pax2-light-blue hover:text-pax2-blue"
      >
        <MessagesSquare className="size-4" style={{ color: '#033882', fill: '#dbe7fa' }} />
        Ask about this video
      </button>
      {mounted &&
        open &&
        createPortal(
          <section className="fixed inset-y-[18px] right-[18px] z-[60] flex w-[min(420px,calc(100vw-36px))] flex-col overflow-hidden rounded-2xl border border-slate-500 bg-pax2-mist shadow-e2">
            <div className="flex min-h-[73px] shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 px-6 py-4">
              <p className="truncate font-display text-xl text-slate-900">{title}</p>
              <button type="button" onClick={() => setOpen(false)} className={whiteButton('circle')} aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <Chat compact explore={false} chipVideo={ytId} surface="video-panel" context={context} />
            </div>
          </section>,
          document.body,
        )}
    </>
  )
}
