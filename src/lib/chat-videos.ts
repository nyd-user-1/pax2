import "server-only"

import { channelById } from "@/lib/channels"
import { homeFeedFile, ytShortsFile } from "@/lib/data-files"
import { generatedJson } from "@/lib/generated-store"
import { resonanceScore } from "@/lib/video-reads"

// The chat's video lookup (2026-10-23): the record the chat is given covers only the campaign's scored
// takes, so a short the user names by title, link or id was invisible to it and it answered that it could
// not find it. Before each answer the route searches the user's words against the shorts PAX2 holds (the
// question bank's 5,379 baseline shorts, the home feed and the tracked channels' shorts) and hands the
// matches over with their pages, so the answer can name them and link them.

type Entry = { id: string; title: string; channel: string; views: number | null; ratio: number | null; published: string | null }
type BankShort = { t?: string; ch?: string; v?: number; r?: number; pub?: string }

let _index: Promise<Entry[]> | null = null

async function build(): Promise<Entry[]> {
  const out = new Map<string, Entry>()
  const name = (ch?: string) => (ch ? (channelById(ch)?.name ?? "") : "")
  const bank = await generatedJson<{ shorts: Record<string, BankShort> }>("question-bank").catch(() => null)
  for (const [id, s] of Object.entries(bank?.shorts ?? {})) if (s.t) out.set(id, { id, title: s.t, channel: name(s.ch), views: s.v ?? null, ratio: s.r ?? null, published: s.pub ?? null })
  try {
    const feed = homeFeedFile() as unknown as { id: string; title: string; channel?: string; channelId?: string; views?: number; ratio?: number; published?: string }[]
    for (const v of feed) if (!out.has(v.id) && v.title) out.set(v.id, { id: v.id, title: v.title, channel: v.channel ?? name(v.channelId), views: v.views ?? null, ratio: v.ratio ?? null, published: v.published ?? null })
  } catch {}
  try {
    const yt = ytShortsFile() as unknown as { videos: { id: string; title: string; channel?: string; channelId?: string; views?: number; published?: string }[] }
    for (const v of yt.videos ?? []) if (!out.has(v.id) && v.title) out.set(v.id, { id: v.id, title: v.title, channel: v.channel ?? name(v.channelId), views: v.views ?? null, ratio: null, published: v.published ?? null })
  } catch {}
  return [...out.values()]
}
const index = () => (_index ??= build())

const norm = (s: string) => s.toLowerCase().replace(/#\w+/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim()
const STOP = new Set("a an and are as at be by do does for from has have how i in is it its me my of on or our the this that to was we what when where which who why will with you your video short shorts".split(" "))

/** Shorts the user's words point at: by id or link first, then by title (a quoted title, a title the
 *  message contains, or most of a title's words), best first. */
export async function videosMentioned(text: string, limit = 6): Promise<Entry[]> {
  const all = await index()
  const byId = new Map(all.map((e) => [e.id, e]))
  const picked = new Map<string, number>()
  // Ids: /v/yt-ID, youtu.be/ID, watch?v=ID, /shorts/ID, or a bare 11-character id the index holds.
  for (const m of text.matchAll(/(?:yt-|youtu\.be\/|[?&]v=|\/shorts\/)?([\w-]{11})(?![\w-])/g)) if (byId.has(m[1])) picked.set(m[1], 100)
  const said = ` ${norm(text)} `
  const quoted = [...text.matchAll(/["“”']([^"“”']{4,120})["“”']/g)].map((m) => norm(m[1]))
  const words = new Set(said.split(" ").filter((w) => w.length > 2 && !STOP.has(w)))
  for (const e of all) {
    if (picked.has(e.id)) continue
    const t = norm(e.title)
    if (t.length < 4) continue
    let score = 0
    if (quoted.some((q) => q && (t === q || t.includes(q) || q.includes(t)))) score = 90
    else if (t.length >= 8 && said.includes(` ${t} `)) score = 80
    else {
      // Most of the title's words, or several of the message's words that most titles do not share.
      const tw = t.split(" ").filter((w) => w.length > 2 && !STOP.has(w))
      if (tw.length >= 2) {
        const hit = tw.filter((w) => words.has(w)).length
        if (hit >= 2 && hit / tw.length >= 0.75) score = 40 + Math.round(30 * (hit / tw.length))
        else if (hit >= 3 && hit / tw.length >= 0.4) score = 25 + 5 * hit
      }
    }
    // A short whose channel the message names ranks above one whose does not.
    if (score && e.channel && said.includes(` ${norm(e.channel)} `)) score += 15
    if (score) picked.set(e.id, score)
  }
  return [...picked.entries()]
    .sort((a, b) => b[1] - a[1] || (byId.get(b[0])!.views ?? 0) - (byId.get(a[0])!.views ?? 0))
    .slice(0, limit)
    .map(([id]) => byId.get(id)!)
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })

/** The context section for the matches, or nothing when the words point at no short. */
export async function videosContext(text: string): Promise<string> {
  const found = await videosMentioned(text)
  const n = (await index()).length
  if (!found.length) return `\n\nPAX2 holds ${n.toLocaleString("en-US")} shorts; none matches a title, link or id in the user's last message.`
  const pct = (x?: number) => (x == null ? null : Math.round(x))
  const lines = found.map((e) => {
    const s = resonanceScore(e.id)
    const res = s
      ? `Resonance ${pct(s.pre)} predicted${s.post != null ? `, ${pct(s.post)} measured` : ""} (percentiles among the 5,379 baseline shorts; factors' percentiles: Content ${pct(s.c) ?? "—"}, Production ${pct(s.x) ?? "—"}, Headline ${pct(s.h) ?? "—"})`
      : "no Resonance score (outside the baseline)"
    return [`- "${e.title}" (/v/yt-${e.id})`, e.channel, e.views != null ? `${compact.format(e.views)} views` : null, e.ratio != null ? `${e.ratio.toFixed(2)}x Outlier Score` : null, e.published ? `published ${e.published.slice(0, 10)}` : null, res].filter(Boolean).join(" · ")
  })
  return `\n\n=== SHORTS THE USER'S MESSAGE POINTS AT (from PAX2's ${n.toLocaleString("en-US")} shorts) ===\n${lines.join("\n")}\n=== END SHORTS ===`
}
