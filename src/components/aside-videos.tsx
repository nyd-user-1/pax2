"use client"

import Link from "next/link"

import { useBlockSize } from "@/components/blocks"

// The aside column's video grid (Brendan, 2026-10-23): Channel, Tags and Comps show their videos two to a
// row, four at Half View and up to eight at Full View, each a thumbnail over its title on one line.

export function AsideVideos({ videos, inDrawer = false }: { videos: { id: string; title: string }[]; inDrawer?: boolean }) {
  const size = useBlockSize()
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-4">
      {videos.slice(0, size === "full" ? 8 : 4).map((x) => (
        <Link key={x.id} href={`/v/yt-${x.id}`} scroll={false} replace={inDrawer} className="group flex min-w-0 flex-col gap-1.5" data-find>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://i.ytimg.com/vi/${x.id}/mqdefault.jpg`} alt="" className="aspect-video w-full rounded-lg bg-slate-100 object-cover" />
          <span className="truncate text-sm text-slate-800 group-hover:text-pax2-blue">{x.title}</span>
        </Link>
      ))}
    </div>
  )
}
