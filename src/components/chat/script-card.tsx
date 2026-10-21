'use client'

// The script as a block: the title, the measured length and Record in the header, and the body a
// transcript — monospace, left-aligned, double-spaced, the text block centered at reading width.

import { Video } from 'lucide-react'

import { secondsAt, words } from '@/components/record/draft'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/ui/components/nova/card'

export function ScriptCard({ text, onRecord }: { text: string; onRecord: () => void }) {
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
        <div className="mx-auto max-w-[36rem] whitespace-pre-wrap py-4 font-mono text-[17px] leading-[2.1] text-[var(--txt)]">{text}</div>
      </CardContent>
    </Card>
  )
}
