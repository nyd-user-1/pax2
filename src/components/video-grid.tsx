"use client"

import * as React from "react"

import { ArrowDownAZ, ArrowUpDown, Check, ChevronDown, Clock, Trophy, Users } from "lucide-react"

import { VideoCard, type VideoCardData } from "@/components/video-card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/ui/components/nova/dropdown-menu"

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
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm text-slate-700 shadow-e1 outline-none transition-shadow hover:shadow-e2 data-[popup-open]:shadow-e2">
            {[scripts.find((s) => s.id === script)?.short, voice].filter(Boolean).join(" · ") || "All"}
            <ChevronDown className="size-3.5 text-slate-400" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-max min-w-44 rounded-2xl p-1.5 shadow-e3">
            <DropdownMenuItem onClick={() => (setScript(null), setVoice(null))} className="flex items-center justify-between gap-6 whitespace-nowrap rounded-xl px-3 py-2 text-sm">
              All
              {!script && !voice && <Check className="size-4 text-pax-plum" />}
            </DropdownMenuItem>
            {scripts.map((s) => (
              <DropdownMenuItem key={s.id} onClick={() => setScript(script === s.id ? null : s.id)} className="flex items-center justify-between gap-6 whitespace-nowrap rounded-xl px-3 py-2 text-sm">
                {s.short}
                {script === s.id && <Check className="size-4 text-pax-plum" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {voices.map((v) => (
              <DropdownMenuItem key={v} onClick={() => setVoice(voice === v ? null : v)} className="flex items-center justify-between gap-6 whitespace-nowrap rounded-xl px-3 py-2 text-sm">
                {v}
                {voice === v && <Check className="size-4 text-pax-plum" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm text-slate-700 shadow-e1 outline-none transition-shadow hover:shadow-e2 data-[popup-open]:shadow-e2">
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
