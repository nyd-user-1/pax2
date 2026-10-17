// The cold-start feed ranker: before PAX2 Feed Ranker is trained, each video's score is the sum of
// three parts a reader can check: how recent it is (halving every 14 days), how far it ran past
// its channel's median (log of the ratio), and how much PAX2's own readers opened and played it in
// the last 7 days (log1p of the count). Pure: the events come in, nothing is read here.

export type RankEvent = { kind: string; subject: string; at: string }
export type RankParts = { recency: number; ratio: number; readers: number; score: number }

const HALF_LIFE_DAYS = 14
const WINDOW_MS = 7 * 864e5

/** Subjects arrive as page ids (yt-<id>) or bare YouTube ids; both count for the same video. */
const bare = (s: string) => s.replace(/^yt-/, "")

export function rankFeed<V extends { id: string; published: string; ratio: number }>(videos: V[], events: RankEvent[], now = Date.now()): (V & { rank: RankParts })[] {
  const counts = new Map<string, number>()
  for (const e of events) {
    if ((e.kind !== "open" && e.kind !== "play") || now - Date.parse(e.at) > WINDOW_MS) continue
    const id = bare(e.subject)
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return videos
    .map((v) => {
      const days = Math.max(0, (now - Date.parse(v.published)) / 864e5)
      const recency = Math.pow(0.5, days / HALF_LIFE_DAYS)
      const ratio = Math.log(Math.max(0.01, v.ratio))
      const readers = Math.log1p(counts.get(v.id) ?? 0)
      return { ...v, rank: { recency, ratio, readers, score: recency + ratio + readers } }
    })
    .sort((a, b) => b.rank.score - a.rank.score)
}
