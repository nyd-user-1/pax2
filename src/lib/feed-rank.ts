// The cold-start feed ranker: before PAX2 Feed Ranker is trained, each video's score is the sum of
// four parts a reader can check: how recent it is (halving every 14 days), how far it ran past its
// channel's median (log of the ratio), how much PAX2's own readers opened and played it in the last
// 7 days (log1p of the count), and, when the reader's own history is given, how much this reader has
// opened and played the same channel (log1p of the count), the reader-by-channel affinity PAX2 Feed
// Ranker v0 measured on public logs, and how many readers boost it (log1p of the running count), the
// same for every reader. Pure: the events come in, nothing is read here.

export type RankEvent = { kind: string; subject: string; at: string }
export type RankParts = { recency: number; ratio: number; readers: number; affinity: number; boosts: number; score: number }

const HALF_LIFE_DAYS = 14
const WINDOW_MS = 7 * 864e5

/** Subjects arrive as page ids (yt-<id>) or bare YouTube ids; both count for the same video. */
const bare = (s: string) => s.replace(/^yt-/, "")

export function rankFeed<V extends { id: string; published: string; ratio: number; channelId?: string }>(videos: V[], events: RankEvent[], now = Date.now(), mine: RankEvent[] = [], boosted: string[] = [], boostCounts: Record<string, number> = {}): (V & { rank: RankParts })[] {
  const counts = new Map<string, number>()
  for (const e of events) {
    if ((e.kind !== "open" && e.kind !== "play") || now - Date.parse(e.at) > WINDOW_MS) continue
    const id = bare(e.subject)
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  // The reader's own opens and plays, counted by the channel of the video they touched (any age).
  const channelOf = new Map(videos.map((v) => [v.id, v.channelId ?? ""]))
  const byChannel = new Map<string, number>()
  for (const e of mine) {
    if (e.kind !== "open" && e.kind !== "play") continue
    const ch = channelOf.get(bare(e.subject))
    if (ch) byChannel.set(ch, (byChannel.get(ch) ?? 0) + 1)
  }
  // A Boost counts as three opens in the affinity term: a stated support signal over an implicit
  // one. The 3 is a design constant, held until PAX2 Feed Ranker trains on PAX2's own reader rows.
  for (const id of boosted) {
    const ch = channelOf.get(bare(id))
    if (ch) byChannel.set(ch, (byChannel.get(ch) ?? 0) + 3)
  }
  return videos
    .map((v) => {
      const days = Math.max(0, (now - Date.parse(v.published)) / 864e5)
      const recency = Math.pow(0.5, days / HALF_LIFE_DAYS)
      const ratio = Math.log(Math.max(0.01, v.ratio))
      const readers = Math.log1p(counts.get(v.id) ?? 0)
      const affinity = Math.log1p(byChannel.get(v.channelId ?? "") ?? 0)
      const boosts = Math.log1p(boostCounts[bare(v.id)] ?? 0)
      return { ...v, rank: { recency, ratio, readers, affinity, boosts, score: recency + ratio + readers + affinity + boosts } }
    })
    .sort((a, b) => b.rank.score - a.rank.score)
}
