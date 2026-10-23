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

/** Tags as the published app drew them: each tag's name, See all, then up to three shorts carrying it.
 *  Two tags show at Half View and four at Full View; the Tags page holds the rest. */
export function TagSections({ sections, inDrawer = false }: { sections: { tag: string; href: string; videos: { id: string; title: string }[] }[]; inDrawer?: boolean }) {
  const size = useBlockSize()
  return (
    <div className="flex flex-col gap-5">
      {sections.slice(0, size === "full" ? 4 : 2).map((s) => (
        <section key={s.tag} data-find className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold capitalize text-slate-900">{s.tag}</h3>
            {s.videos.length > 0 && (
              <Link href={s.href} className="shrink-0 text-xs font-medium text-pax2-light-blue hover:underline">
                See all
              </Link>
            )}
          </div>
          {s.videos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {s.videos.slice(0, 3).map((o) => (
                <Link key={o.id} href={`/v/yt-${o.id}`} scroll={false} replace={inDrawer} className="group flex min-w-0 flex-col gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://i.ytimg.com/vi/${o.id}/mqdefault.jpg`} alt="" className="aspect-video w-full rounded-md bg-slate-100 object-cover" />
                  <span className="line-clamp-2 text-[11px] leading-snug text-slate-600 group-hover:text-pax2-blue">{o.title}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">No other video carries this tag yet.</p>
          )}
        </section>
      ))}
    </div>
  )
}
