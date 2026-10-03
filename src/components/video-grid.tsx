"use client"

import * as React from "react"

import { ArrowDownAZ, ArrowUpDown, Check, ChevronDown, Clock, Trophy, Users } from "lucide-react"

import { VideoCard, type VideoCardData } from "@/components/video-card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/components/nova/dropdown-menu"
import { cn } from "@/ui/lib/utils"

type Sort = "score" | "reach" | "az" | "time"

const SORTS: { id: Sort; label: string; icon: typeof Trophy }[] = [
  { id: "score", label: "Score", icon: Trophy },
  { id: "reach", label: "Reach", icon: Users },
  { id: "az", label: "A to Z", icon: ArrowDownAZ },
  { id: "time", label: "Newest", icon: Clock },
]

/** Every take as a card, filtered by script and voice in place. */
export function VideoGrid({ videos, scripts }: { videos: VideoCardData[]; scripts: { id: string; short: string }[] }) {
  const [script, setScript] = React.useState<string | null>(null)
  const [voice, setVoice] = React.useState<string | null>(null)
  const [sort, setSort] = React.useState<Sort>("score")
  const voices = [...new Set(videos.map((v) => v.voice))]
  const shown = videos
    .filter((v) => (!script || v.script === script) && (!voice || v.voice === voice))
    .sort((a, b) =>
      sort === "reach"
        ? (b.impressions ?? 0) - (a.impressions ?? 0)
        : sort === "az"
          ? `${a.scriptShort} ${a.voice}`.localeCompare(`${b.scriptShort} ${b.voice}`)
          : sort === "time"
            ? (b.published ?? "").localeCompare(a.published ?? "") || a.id.localeCompare(b.id)
            : (b.score ?? -1) - (a.score ?? -1),
    )
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
        <DropdownMenu>
          <DropdownMenuTrigger className="ml-auto inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm text-slate-700 shadow-e1 outline-none transition-shadow hover:shadow-e2 data-[popup-open]:shadow-e2">
            <ArrowUpDown className="size-3.5 text-slate-400" />
            {SORTS.find((s) => s.id === sort)!.label}
            <ChevronDown className="size-3.5 text-slate-400" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-max min-w-44 rounded-2xl p-1.5 shadow-e3">
            {SORTS.map((s) => (
              <DropdownMenuItem key={s.id} onClick={() => setSort(s.id)} className="flex items-center justify-between gap-6 whitespace-nowrap rounded-xl px-3 py-2 text-sm">
                <span className="flex items-center gap-2.5">
                  <s.icon className="size-4 text-slate-400" />
                  {s.label}
                </span>
                {sort === s.id && <Check className="size-4 text-pax-plum" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
