'use client'

// The script as a block: the title, the measured length and Record in the header, and the body a
// transcript — monospace, left-aligned, double-spaced, the text block centered at reading width.
// A cited line carries its number, as on /scripts; the footer's Citations opens the right panel with
// why each line is written that way and the evidence behind it. With nothing cited, the footer is the
// blocks' Glossary link.

import * as React from 'react'
import Link from 'next/link'
import { Video } from 'lucide-react'

import { ScriptCitations } from '@/components/chat/script-citations'
import { secondsAt, words } from '@/components/record/draft'
import { useShellPanel } from '@/components/shell'
import type { ScriptCite } from '@/lib/chat-fields'
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '@/ui/components/nova/card'
import { cn } from '@/ui/lib/utils'

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export function ScriptCard({ text, cites, onRecord }: { text: string; cites?: ScriptCite[] | null; onRecord: () => void }) {
  const { openAside, asideKey } = useShellPanel()
  const key = React.useId()
  const [hot, setHot] = React.useState<number | null>(null)
  const shown = asideKey === key
  const list = React.useMemo(() => cites ?? [], [cites])

  // Sentences with the whitespace between them kept, so the line breaks survive; each cite marks the
  // sentence its quoted words come from.
  const parts = text.split(/(?<=[.!?…])(\s+)/)
  const marks = new Map<number, number[]>()
  list.forEach((c, k) => {
    const q = norm(c.quote)
    if (!q) return
    const at = parts.findIndex((p, i) => i % 2 === 0 && norm(p).includes(q))
    if (at >= 0) marks.set(at, [...(marks.get(at) ?? []), k + 1])
  })

  const open = React.useCallback(
    (lit: number | null) => openAside({ key, title: 'Citations', body: <ScriptCitations text={text} cites={list} hot={lit} onHot={setHot} /> }),
    [openAside, key, text, list],
  )
  // While the panel shows these citations, hovering either side lights the same number on both.
  React.useEffect(() => {
    if (shown) open(hot)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hot])
  // A card that leaves the page takes its citations with it.
  const leave = React.useRef(() => {})
  leave.current = () => {
    if (shown) openAside(null)
  }
  React.useEffect(() => () => leave.current(), [])

  return (
    <Card className="my-4 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <CardHeader className="border-b [.border-b]:pb-2">
        <div className="flex items-center gap-3">
          <CardTitle>Script</CardTitle>
          <span className="text-xs text-slate-800">
            {words(text)} words · about {secondsAt(text)} seconds
          </span>
        </div>
        <CardAction>
          <button
            type="button"
            onClick={onRecord}
            className="flex items-center gap-1.5 rounded-full bg-pax2-blue px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-85"
          >
            <Video className="size-3.5" /> Record
          </button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="mx-auto max-w-[36rem] whitespace-pre-wrap py-4 font-mono text-[17px] leading-[2.1] text-[var(--txt)]">
          {parts.map((p, i) => (
            <React.Fragment key={i}>
              <span className={cn('rounded transition-colors', marks.get(i)?.includes(hot ?? -1) && 'bg-pax2-lavender/60')}>{p}</span>
              {marks.get(i)?.map((n) => (
                <sup key={n}>
                  <span
                    onMouseEnter={() => setHot(n)}
                    onMouseLeave={() => setHot(null)}
                    className={cn('ml-1 inline-flex size-[17px] cursor-default items-center justify-center rounded-full align-baseline font-sans text-[10px] font-bold transition-colors', hot === n ? 'bg-pax2-light-blue text-white' : 'bg-pax2-lavender text-pax2-blue')}
                  >
                    {n}
                  </span>
                </sup>
              ))}
            </React.Fragment>
          ))}
        </div>
      </CardContent>
      <CardFooter className="bg-transparent py-3 text-xs text-slate-800">
        {list.length > 0 ? (
          <button type="button" onClick={() => (shown ? openAside(null) : open(hot))} aria-expanded={shown} className="font-medium text-slate-800 underline underline-offset-2 hover:text-pax2-light-blue">
            Citations
          </button>
        ) : (
          <Link href="/glossary" className="font-medium text-slate-800 underline underline-offset-2 hover:text-pax2-light-blue">
            Glossary
          </Link>
        )}
      </CardFooter>
    </Card>
  )
}
