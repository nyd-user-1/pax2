import "server-only"

import fs from "node:fs"
import path from "node:path"

import labTested from "../../data/generated/lab-tested.json"
import type { FeedVideo } from "@/components/record/feed"
import { tagsFor } from "@/lib/tags"

// The full feed index (scripts/feed-index.mjs, every catalog short), loaded once per server and
// decorated with delivery tags and the Lab Tested flag. Pages ship only a first page of it; the
// rest arrives through /api/feed as the reader scrolls or searches.

let ALL: FeedVideo[] | null = null

export function feedIndex(): FeedVideo[] {
  if (!ALL) {
    const lab = new Set(labTested as string[])
    ALL = (JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/generated/feed-index.json"), "utf8")) as FeedVideo[]).map((v) => {
      const tags = [...new Set([...(v.tags ?? []), ...tagsFor(`yt-${v.id}`)])]
      return { ...v, ...(tags.length && { tags }), ...(lab.has(v.id) && { lab: true }) }
    })
  }
  return ALL
}

/** The refine menu's channel and tag lists, from the whole index. */
export function feedFacets(): { channels: string[]; tags: string[] } {
  const all = feedIndex()
  return {
    channels: [...new Set(all.map((v) => v.channel))].sort((a, b) => a.localeCompare(b)),
    tags: [...new Set(all.flatMap((v) => v.tags ?? []))].sort((a, b) => a.localeCompare(b)),
  }
}

/** The page the server renders: the Lab Tested videos (the pinned row's seed), then the newest.
 *  `cursor` is how far into the newest-first index the page reaches; the client pages on from it. */
export function firstPage(size = 48): { initial: FeedVideo[]; total: number; cursor: number } {
  const all = feedIndex()
  const lab = all.filter((v) => v.lab)
  const seen = new Set(lab.map((v) => v.id))
  const rest: FeedVideo[] = []
  let cursor = 0
  while (rest.length < Math.max(0, size - lab.length) && cursor < all.length) {
    const v = all[cursor++]
    if (!seen.has(v.id)) rest.push(v)
  }
  return { initial: [...lab, ...rest], total: all.length, cursor }
}
