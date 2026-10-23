'use client'

import * as React from 'react'
import { MessagesSquare } from 'lucide-react'

import { Chat } from '@/components/chat/chat'
import { useShellPanel } from '@/components/shell'

// The video page's question button: the chat opens in the right panel at its 420px third, preloaded with
// this video, its chips drawn from the question bank (src/lib/question-bank.ts). In the drawer the right
// panel is the drawer itself, so the button opens the full page with ?ask=1 and the panel opens there.
export function AskVideo({ ytId, title, inDrawer = false }: { ytId: string; title: string; inDrawer?: boolean }) {
  const { openAside, asideKey } = useShellPanel()
  const key = `ask:${ytId}`
  const open = React.useCallback(() => {
    const context = () => `ACTIVE CONTEXT — the user is on the video page of the short "${title}" (/v/yt-${ytId}) and asks about it.`
    openAside({ key, title, body: <div className="-mx-6 -my-5 flex h-[calc(100%+2.5rem)] min-h-[480px] flex-col"><Chat compact explore={false} chipVideo={ytId} surface="video-panel" context={context} /></div> })
  }, [openAside, key, title, ytId])
  // The shell clears the panel when the path changes, on mount included; open after it.
  React.useEffect(() => {
    if (inDrawer || new URLSearchParams(window.location.search).get('ask') !== '1') return
    const t = setTimeout(open, 60)
    return () => clearTimeout(t)
  }, [inDrawer, open])
  return (
    <button
      type="button"
      aria-pressed={asideKey === key}
      onClick={() => (inDrawer ? window.location.assign(`/v/yt-${ytId}?ask=1`) : asideKey === key ? openAside(null) : open())}
      className="press mx-auto flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-e1 transition-colors hover:border-pax2-light-blue hover:text-pax2-blue"
    >
      <MessagesSquare className="size-4" style={{ color: '#033882', fill: '#dbe7fa' }} />
      Ask about this video
    </button>
  )
}
