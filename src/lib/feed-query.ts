import type { FeedVideo } from "@/components/record/feed"

// The feed's filter and order, shared by /api/feed (over the full index) and any server page.
// Plain functions, no imports beyond the type, so both sides stay identical.

export type FeedQuery = { q?: string; channel?: string; tag?: string; sort?: string; cursor?: number; limit?: number }

export const wordsMatch = (v: FeedVideo, needle: string) =>
  needle
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => `${v.title} ${v.channel} ${v.description} ${(v.tags ?? []).join(" ")}${v.paid ? " paid" : ""}`.toLowerCase().includes(w))

const posted = (v: FeedVideo) => new Date(v.published).getTime()
const perDay = (v: FeedVideo) => v.views / Math.max(1, (Date.now() - posted(v)) / 86_400_000)

type Cmp = (a: FeedVideo, b: FeedVideo) => number
const by = (pick: (v: FeedVideo) => number | null | undefined, sign: -1 | 1): Cmp => (a, b) => {
  const x = pick(a) ?? -Infinity
  const y = pick(b) ?? -Infinity
  return (x - y) * sign
}
const PICKS: Record<string, (dir: "down" | "up") => Cmp> = {
  date: (d) => by(posted, d === "down" ? -1 : 1),
  trending: (d) => by(perDay, d === "down" ? -1 : 1),
  views: (d) => by((v) => v.views, d === "down" ? -1 : 1),
  likes: (d) => by((v) => v.likes, d === "down" ? -1 : 1),
  comments: (d) => by((v) => v.comments, d === "down" ? -1 : 1),
  title: () => (a, b) => a.title.localeCompare(b.title),
  media: () => (a, b) => Number(!!b.paid) - Number(!!a.paid),
  lab: () => (a, b) => Number(!!b.lab) - Number(!!a.lab),
}
const NEWEST = by(posted, -1)

/** Filter, order and page the index. `sort` is "key:dir,key:dir" in the chips' order. */
export function queryFeed(all: FeedVideo[], p: FeedQuery): { videos: FeedVideo[]; total: number; nextCursor: number | null } {
  const needle = (p.q ?? "").trim().toLowerCase()
  let rows = all.filter((v) => (!needle || wordsMatch(v, needle)) && (!p.channel || v.channel === p.channel) && (!p.tag || (v.tags ?? []).includes(p.tag)))
  const cmps = (p.sort ?? "")
    .split(",")
    .map((s) => s.split(":"))
    .filter(([k, d]) => k in PICKS && (d === "down" || d === "up"))
    .map(([k, d]) => PICKS[k](d as "down" | "up"))
  const cmp = [...cmps, NEWEST].reduce((first, next) => (a: FeedVideo, b: FeedVideo) => first(a, b) || next(a, b))
  rows = rows.toSorted(cmp)
  const cursor = Math.max(0, p.cursor ?? 0)
  const limit = Math.min(200, Math.max(1, p.limit ?? 48))
  const page = rows.slice(cursor, cursor + limit)
  return { videos: page, total: rows.length, nextCursor: cursor + page.length < rows.length ? cursor + page.length : null }
}
