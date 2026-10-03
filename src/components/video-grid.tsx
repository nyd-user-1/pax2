"use client"

import * as React from "react"

import { VideoCard, type VideoCardData } from "@/components/video-card"
import { cn } from "@/ui/lib/utils"

type Sort = "best" | "worst" | "reach"

/** Every take as a card, filtered by script and voice in place. */
export function VideoGrid({ videos, scripts }: { videos: VideoCardData[]; scripts: { id: string; short: string }[] }) {
  const [script, setScript] = React.useState<string | null>(null)
  const [voice, setVoice] = React.useState<string | null>(null)
  const [sort, setSort] = React.useState<Sort>("best")
  const voices = [...new Set(videos.map((v) => v.voice))]
  const shown = videos
    .filter((v) => (!script || v.script === script) && (!voice || v.voice === voice))
    .sort((a, b) => (sort === "reach" ? (b.impressions ?? 0) - (a.impressions ?? 0) : sort === "worst" ? (a.score ?? 999) - (b.score ?? 999) : (b.score ?? -1) - (a.score ?? -1)))
  const chip = (on: boolean) => cn("rounded-full px-3.5 py-1.5 text-sm transition-colors", on ? "bg-pax-ink font-medium text-white shadow-e1" : "bg-white text-slate-600 shadow-e1 hover:text-pax-ink")
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={chip(!script && !voice)} onClick={() => (setScript(null), setVoice(null))}>
          All
        </button>
        {scripts.map((s) => (
          <button key={s.id} type="button" className={chip(script === s.id)} onClick={() => setScript(script === s.id ? null : s.id)}>
            {s.short}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-slate-200" />
        {voices.map((v) => (
          <button key={v} type="button" className={chip(voice === v)} onClick={() => setVoice(voice === v ? null : v)}>
            {v}
          </button>
        ))}
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="ml-auto rounded-full bg-white px-3.5 py-1.5 text-sm text-slate-600 shadow-e1 outline-none">
          <option value="best">Highest score</option>
          <option value="worst">Lowest score</option>
          <option value="reach">Most reach</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {shown.map((v, i) => (
          <VideoCard key={v.id} v={v} i={i} />
        ))}
      </div>
      {!shown.length && <p className="py-10 text-center text-slate-500">No videos match.</p>}
    </div>
  )
}
