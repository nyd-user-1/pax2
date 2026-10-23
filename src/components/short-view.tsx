import katex from "katex"
import "katex/dist/katex.min.css"
import * as React from "react"
import type { ReactNode } from "react"
import Link from "next/link"

import subscribers from "../../data/generated/channel-subscribers.json"
import warBaseline from "../../data/generated/war-baseline.json"
import sampleVideos from "../../data/sample/videos.json"
import paidBatch from "../../data/generated/voter-freedom-paid.json"
import { CarryBlock } from "@/components/evidence/carry"
import { LengthBlock } from "@/components/record/resonance-length"
import { ResonanceCard, ResonanceFactors, ResonanceGauge } from "@/components/resonance-views"
import { CraftOctagon, ModeMatch, Recommendations, TopicRows, UnlockList, ingredients } from "@/components/video-reads"
import { craftTemplate, modeMatch, resonanceFactors, resonanceScore, topicOf, unlockActions } from "@/lib/video-reads"
import { videoFacts } from "@/lib/question-resolver"
import { videoAnalytics, type AnalyticsRow } from "@/lib/analytics"
import { Hint } from "@/components/hint"
import { boostCounts } from "@/lib/boost"
import { ChevronRight } from "lucide-react"

import { AccordionBlock, CardBlock, ChartBlock, FormulaBlock, ListBlock, MainBlock } from "@/components/blocks"
import { SwayableBlock, UpworthyBlock, WesleyanBlock, type Codes } from "@/components/codebook-blocks"
import { CensusCharacteristics } from "@/components/census-characteristics"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { HitsScatter, TIER } from "@/components/hits-scatter"
import { FormulaExplainer } from "@/components/formula-explainer"
import { CommentThread, type Thread, type ThreadComment } from "@/components/comment-thread"
import { ReadingPanel } from "@/components/reading-panel"
import { AskVideo } from "@/components/ask-video"
import { SplitColumns } from "@/components/split-columns"
import { Term } from "@/components/term"
import { SignupGate } from "@/components/signup-gate"
import { Loudness, Observations, Player, ScriptTimeline, SeekProvider } from "@/components/workbench"
import { currentUser } from "@/lib/auth"
import { generatedJson } from "@/lib/generated-store"
import { featuresFor, type Features } from "@/lib/catalog"
import { EXPLAIN, FORMULAS } from "@/lib/formulas"
import { channelById, secs } from "@/lib/channels"
import { labVideos, type Tier } from "@/lib/lab"
import { COMPONENTS } from "@/lib/resonance"
import { paidResonance } from "@/lib/paid-resonance"
import { tagHref, taggedVideos, tagsFor } from "@/lib/tags"
import { cn } from "@/ui/lib/utils"
import { UsageOpen } from "@/components/usage-beacon"
import { homeFeedFile, ytShortsFile } from "@/lib/data-files"

const homeFeed = homeFeedFile()
const shorts = ytShortsFile()

type Yt = { fetchedAt: string; videos: { id: string; channelId: string; channel: string; title: string; published: string; duration: string; views: number | null; likes: number | null; comments: number | null }[] }

const DASH = "-"
const COMPACT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })

const KPI_ROWS = ["Counts", "Rate", "Ref. avg", "Weighted", "Distance", "Score", "Weight"]
const WINDOW_ROWS = ["Spend", "Impressions", "Reach", "3s plays", "ThruPlays", "25% play", "50% play", "75% play", "100% play", "Avg. Time", "Shares", "Saves", "Comments", "Reactions", "Clicks", "CTA"]

/** Signed out, everything past the public counts is locked: each block keeps its header, what's inside
 *  it blurs — the shape of the read shows through, the numbers don't — and nothing in it can be clicked.
 *  Signed in, the blocks stand open. */
function Locked({ locked, children }: { locked: boolean; children: ReactNode }) {
  if (!locked) return children
  return (
    <div inert className="select-none [&_[data-slot=card-content]]:blur-[3px] [&_[data-slot=card-footer]]:blur-[3px]">
      {children}
    </div>
  )
}

/** Timed sentence lines from the transcript's word timings. */
function transcriptLines(f: Features | undefined) {
  const t = f?.transcript
  if (!t || t.error || !t.text) return null
  const words = t.words ?? []
  const sentences = (t.text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [t.text]).map((s) => s.trim()).filter(Boolean)
  let wi = 0
  return sentences.map((text) => {
    const line = { t: words[wi]?.t ?? 0, text }
    wi += text.split(/\s+/).length
    return line
  })
}

/** A campaign short in the take panel's exact shape; counts PAX2 does not hold read as a dash. */
type PaidRow = Record<string, string>
type Creative = { creativeId: string; cut: "exact" | "edit"; videoId: string; rows: PaidRow[] }

/** A paid video's real ad figures from the batch (data/generated/voter-freedom-paid.json). Only the
 *  creatives that are exact cuts of the upload count — an ad-only edit's plays must not pose as the
 *  upload's — unless edits are all the video ran as. Play depths are reported as shares of starts. */
function adFigures(ytId: string) {
  const all = (paidBatch.creatives as unknown as Creative[]).filter((c) => c.videoId === ytId)
  if (!all.length) return null
  const exact = all.filter((c) => c.cut === "exact")
  const used = exact.length ? exact : all
  const rows = used.flatMap((c) => c.rows)
  const sum = (k: string) => rows.reduce((t, r) => t + (Number(r[k]) || 0), 0)
  const depth = (k: string) => rows.reduce((t, r) => t + ((Number(r.video_starts) || 0) * (Number(r[k]) || 0)) / 100, 0)
  const spend = sum("spend_usd")
  const impressions = sum("impressions")
  const clicks = sum("clicks")
  const starts = sum("video_starts")
  const thruplays = sum("views_15s_thruplays_reported")
  const completions = sum("video_completions_reported")
  return { spend, impressions, clicks, starts, thruplays, completions, views30: sum("views_30s_reported"), p25: depth("views_25pct_reported_pct"), p50: depth("views_50pct_reported_pct"), p75: depth("views_75pct_reported_pct") }
}

type YtSnippet = { authorDisplayName: string; authorProfileImageUrl: string; textDisplay: string; likeCount: number; publishedAt: string }
/** For now the comments read as lorem ipsum: the threads, authors and counts are YouTube's, the words are placeholders. */
const LOREM = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
  "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
  "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.",
  "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.",
]
let loremAt = 0
const toComment = (id: string, c: YtSnippet): ThreadComment => ({ id, author: c.authorDisplayName, avatar: c.authorProfileImageUrl, text: LOREM[loremAt++ % LOREM.length], likes: c.likeCount, published: c.publishedAt })

/** The approved stand-in conversation (Brendan, 2026-10-20): two comments, each carrying a handful
 *  of replies, in the first comments block's shape. Every video without a real conversation shows it. */
const PLACEHOLDER_THREADS: Thread[] = [
  { id: "ph-1", author: "Lorem Ipsum", avatar: "", text: LOREM[3], likes: 24, published: "2026-10-12T14:00:00Z", replyCount: 6, replies: [
    { id: "ph-1a", author: "Dolor Sit", avatar: "", text: LOREM[2], likes: 6, published: "2026-10-12T18:00:00Z" },
    { id: "ph-1b", author: "Lorem Ipsum", avatar: "", text: LOREM[1], likes: 2, published: "2026-10-13T09:00:00Z" },
    { id: "ph-1c", author: "Dolor Sit", avatar: "", text: LOREM[0], likes: 1, published: "2026-10-13T15:00:00Z" },
    { id: "ph-1d", author: "Lorem Ipsum", avatar: "", text: LOREM[5], likes: 0, published: "2026-10-14T08:00:00Z" },
  ] },
  { id: "ph-2", author: "Adipiscing Elit", avatar: "", text: LOREM[1], likes: 11, published: "2026-10-14T11:00:00Z", replyCount: 3, replies: [
    { id: "ph-2a", author: "Tempor Incididunt", avatar: "", text: LOREM[4], likes: 3, published: "2026-10-14T19:00:00Z" },
    { id: "ph-2b", author: "Adipiscing Elit", avatar: "", text: LOREM[5], likes: 1, published: "2026-10-15T10:00:00Z" },
    { id: "ph-2c", author: "Tempor Incididunt", avatar: "", text: LOREM[0], likes: 0, published: "2026-10-15T16:00:00Z" },
  ] },
]

/** Every comments block renders exactly seven rows (Brendan, 2026-10-22): comment one with three
 *  replies, comment two with two. Real threads are used only when they fill that shape; otherwise the
 *  approved stand-in, trimmed to it. Text is the stand-in words either way. */
function sevenRows(threads: Thread[] | null): Thread[] {
  const shape = (ts: Thread[]) => [
    { ...ts[0], replies: ts[0].replies.slice(0, 3), replyCount: 3 },
    { ...ts[1], replies: ts[1].replies.slice(0, 2), replyCount: 2 },
  ]
  if (threads) {
    const first = threads.find((t) => t.replies.length >= 3)
    const second = threads.find((t) => t !== first && t.replies.length >= 2)
    if (first && second) return shape([first, second])
  }
  return shape(PLACEHOLDER_THREADS)
}

/** The video's top comment threads from YouTube (by relevance) with the replies YouTube sends along,
 *  cached an hour. Null when there's no key, comments are off, or YouTube won't answer. */
async function topComments(ytId: string): Promise<Thread[] | null> {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) return null
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&order=relevance&maxResults=20&textFormat=plainText&videoId=${ytId}&key=${key}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    })
    if (!r.ok) return null
    const j = (await r.json()) as { items?: { id: string; snippet: { totalReplyCount: number; topLevelComment: { snippet: YtSnippet } }; replies?: { comments: { id: string; snippet: YtSnippet }[] } }[] }
    return (j.items ?? []).map((t) => ({
      ...toComment(t.id, t.snippet.topLevelComment.snippet),
      // YouTube lists a thread's replies newest first; read them oldest first, as a conversation.
      replies: (t.replies?.comments ?? []).map((c) => toComment(c.id, c.snippet)).reverse(),
      replyCount: t.snippet.totalReplyCount,
    }))
  } catch {
    return null
  }
}

export async function ShortView({ id, inDrawer = false }: { id: string; inDrawer?: boolean }) {
  const ytId = id.replace(/^yt-/, "")
  // The four network reads start together; each is awaited where the page needs it.
  const userP = currentUser()
  const boostsP = boostCounts([ytId]).catch(() => ({}) as Record<string, number>)
  const commentsP = topComments(ytId)
  const codebookP = generatedJson<Record<string, Codes>>("codebook")
  const factsP = videoFacts(ytId).catch(() => ({ census: null, comp: null }))
  const analyticsP = videoAnalytics(ytId).catch(() => null)
  userP.catch(() => {})
  commentsP.catch(() => {})
  const data = shorts as unknown as Yt
  const v = data.videos.find((x) => x.id === ytId) ?? (homeFeed as unknown as Yt["videos"]).find((x) => x.id === ytId)
  // The ratio and its baseline: the home feed's catalog figures, else the lab's for the original 179.
  const scored = (homeFeed as { id: string; ratio: number; channelMedian: number }[]).find((x) => x.id === ytId) ?? labVideos().find((x) => x.id === ytId)
  const ratio = scored?.ratio
  const pct = (part: number | null | undefined) => {
    if (part == null || !v?.views) return DASH
    const p = (part / v.views) * 100
    return `${p > 0 && p < 0.1 ? p.toFixed(2) : p.toFixed(1)}%`
  }
  // Paid figures, KPIs and Resonance, and for a video not yet analyzed its whole analysis (Audio,
  // Tags, Visual Notes, Transcript, Comps): today only invented samples (data/sample/videos.json),
  // labeled "Sample figures" wherever they show.
  type Range = { score: number; low: number; high: number }
  const sample = (sampleVideos.videos as Record<string, unknown>)[id] as
    | (Record<string, string> & { tiles: Record<string, string>; analytics: Record<string, string>; kpis: Record<string, Record<string, string> | string>; resonance: Range & { evidence: string; components: Record<string, Range> }; features?: Features; tags?: string[]; codes?: Codes })
    | undefined
  const real = featuresFor(id)
  const f = real ?? sample?.features
  /** The analysis on show is the invented sample, not a real pass. */
  const sampled = !real && !!f
  const SAMPLE = "Sample figures"
  const signedIn = !!(await userP)
  const ch = v ? channelById(v.channelId) : undefined
  const lines = transcriptLines(f)
  const duration = f?.audio?.durationSec ?? (v ? secs(v.duration) : 0)
  const siblings = v
    ? sampled
      ? [...data.videos, ...(homeFeed as unknown as Yt["videos"])].filter((x, i, all) => x.channelId === v.channelId && x.id !== ytId && all.findIndex((y) => y.id === x.id) === i).slice(0, 3)
      : data.videos.filter((x) => x.channelId === v.channelId && x.id !== ytId && featuresFor(`yt-${x.id}`)).slice(0, 3)
    : []
  const times = (x: number) => `${x >= 10 ? x.toFixed(0) : x.toFixed(1)}×`
  const n = (x: number | null | undefined) => (x == null ? DASH : COMPACT.format(x))
  const stat = (label: string, value: string) => (
    <div className="flex flex-col">
      <span className="tabular text-lg font-semibold text-slate-900">{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  )

  const locked = !signedIn
  const paid = sample
  const ads = adFigures(ytId)
  const usd = (x: number) => `$${x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const rate = (x: number, of: number) => (of ? `${((x / of) * 100).toFixed(2)}%` : DASH)
  const per = (x: number, of: number) => (of ? usd(x / of) : DASH)
  const adRows: [string, string][] = ads
    ? [
        ["Starts", n(ads.starts)],
        ["Thru (15s)", n(ads.thruplays)],
        ["30s views", n(ads.views30)],
        ["25% play", n(Math.round(ads.p25))],
        ["50% play", n(Math.round(ads.p50))],
        ["75% play", n(Math.round(ads.p75))],
        ["100% play", n(ads.completions)],
        ["Cost/Thru", per(ads.spend, ads.thruplays)],
      ]
    : []
  // A paid video's Resonance and KPIs come from its ad figures, scored against the paid batch.
  const pr = paidResonance(ytId)
  const realTags = tagsFor(id)
  const tags = realTags.length ? realTags : (sample?.tags ?? [])
  /** YouTube returned no like count; a sample video fills it, and the Stats block says so. */
  const sampleLikes = v?.likes == null ? (sample as { likes?: number } | undefined)?.likes : undefined
  const likes = v?.likes ?? sampleLikes ?? null
  // The video's running Boost count from DynamoDB; the row appears from the first boost.
  const boosts = (await boostsP)[ytId] ?? 0
  const statRows: [string, string][] = [
    ["Views", n(v?.views)],
    ["Median", n(scored ? Math.round(scored.channelMedian) : null)],
    ["Likes", n(likes)],
    ["Like rate", pct(likes)],
    ["Comments", n(v?.comments)],
    ["Comment rate", pct(v?.comments)],
    ...(boosts > 0 ? ([["Boosts", n(boosts)]] as [string, string][]) : []),
    ["iWAR", ratio == null ? DASH : times(ratio)],
    ["WAR", v?.views == null ? DASH : times(v.views / warBaseline.median)],
    ["Subscribers", n(v ? (subscribers as Record<string, number | null>)[v.channelId] : null)],
    ["Length", v ? `${Math.floor(secs(v.duration) / 60)}:${String(secs(v.duration) % 60).padStart(2, "0")}` : DASH],
    ["Date", v ? new Date(v.published).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : DASH],
  ]
  // Stats and the analytics in one block. The ad figures stay behind sign-in, as their own block did.
  const analyticsRows: [string, string][] = ads
    ? [
        ["Spend", usd(ads.spend)],
        ["Impressions", n(ads.impressions)],
        ["ThruPlays (15s)", n(ads.thruplays)],
        ["Completion", rate(ads.completions, ads.starts)],
      ]
    : paid
      ? [
          ["Reach", paid.analytics.Reach ?? DASH],
          ["3s+", paid.analytics["3s+"] ?? DASH],
          ["Avg.", paid.analytics["Avg."] ?? DASH],
          ["Spend", paid.analytics.Spend ?? DASH],
        ]
      : []
  const allStats = locked ? statRows : [...statRows, ...analyticsRows]
  /** The eight up front: views, median, likes and like rate, then the four ad figures. */
  const core = [...statRows.slice(0, 4), ...(locked ? [] : analyticsRows)]
  const advanced = statRows.slice(4)

  const comments = await commentsP
  /** A video's outperformance multiple when the catalog knows it. */
  const ratioOf = (vid: string) => (homeFeed as { id: string; ratio?: number }[]).find((x) => x.id === vid)?.ratio ?? null
  const titleOf = (vid: string) => [...data.videos, ...(homeFeed as unknown as Yt["videos"])].find((x) => x.id === vid)?.title ?? null
  /** Up to three other videos carrying `tag`, newest tagging first, each with a known title. */
  const byTag = (tag: string) =>
    taggedVideos()
      .filter((x) => x.id !== id && x.tags.includes(tag))
      .map((x) => ({ id: x.id.replace(/^yt-/, ""), title: titleOf(x.id.replace(/^yt-/, "")) }))
      .filter((x): x is { id: string; title: string } => !!x.title)
      .slice(0, 3)
  const template = craftTemplate(ytId)
  const topic = topicOf(ytId)
  const lengthSec = v ? secs(v.duration) : 0
  const score = resonanceScore(ytId)
  const factors = resonanceFactors()
  const match = modeMatch(ytId)
  const recipe = match && template ? ingredients(template, match.mode, match.axes) : null
  const unlock = unlockActions(ytId)
  const left: [string, string, ReactNode][] = []
  if (f?.audio && !f.audio.error)
    left.push([
      "audio",
      "Audio",
      <Locked key="audio" locked={locked}>
        <ChartBlock title="Audio" height="auto" footer={sampled ? SAMPLE : undefined}>
          <Loudness f={f.audio} />
        </ChartBlock>
      </Locked>,
    ])
  if (siblings.length)
    left.push([
      "comps",
      "Comps",
      <Locked key="comps" locked={locked}>
        <ListBlock title="Comps" height="max" footer={sampled ? SAMPLE : undefined}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {siblings.map((x) => {
              const r = ratioOf(x.id)
              return (
                <Link key={x.id} href={`/v/yt-${x.id}`} scroll={false} replace={inDrawer} className="group flex min-w-0 flex-col gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://i.ytimg.com/vi/${x.id}/mqdefault.jpg`} alt="" className="aspect-video w-full rounded-lg bg-slate-100 object-cover" />
                  <span className="line-clamp-2 text-sm text-slate-800 group-hover:text-pax2-blue">{x.title.replace(/\s*#\w+/g, "").trim() || x.title}</span>
                  {r != null && <span className="tabular text-xs font-semibold text-slate-600">{times(r)}</span>}
                </Link>
              )
            })}
          </div>
        </ListBlock>
      </Locked>,
    ])

  if (tags.length)
    left.push([
      "tags",
      "Tags",
      <AccordionBlock key="tags" title="Tags" height="max" footer={!realTags.length && tags.length ? SAMPLE : undefined}>
        <div className="flex flex-col gap-2">
          {tags.filter((t) => t !== "aggrieved").map((t, ti) => {
            const others = byTag(t)
            return (
              <details key={t} data-find open={ti === 0} className="group/tag rounded-md border bg-card">
                <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2 [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="size-3.5 shrink-0 text-slate-800 transition-transform group-open/tag:rotate-90" />
                  <h3 className="min-w-0 flex-1 truncate text-sm font-semibold capitalize text-slate-900">{t}</h3>
                  {others.length > 0 && (
                    <Link href={tagHref(t)} className="shrink-0 text-xs font-medium text-pax2-light-blue hover:underline">
                      See all
                    </Link>
                  )}
                </summary>
                <div className="border-t px-3 py-3">
                {others.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {others.map((o) => (
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
                </div>
              </details>
            )
          })}
        </div>
      </AccordionBlock>,
    ])

  const coded = (await codebookP)?.[ytId]
  const { census: cen } = await factsP
  const metrics = await analyticsP
  const ordinal = (x: number) => {
    const k = Math.round(x)
    return `${k}${k % 100 >= 11 && k % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][k % 10] ?? "th"}`
  }
  // Analytics in the Spend block's shape: four tiles on top, the rest as label and value in two columns. A
  // channel-level row reads its channel's figure; hovering a value shows the channel and the baseline.
  const TILES = ["Views", "Outlier Score", "Engagement rate", "Hit probability"]
  const tiles = metrics ? TILES.map((label) => metrics.rows.find((r) => r.label === label)).filter((r): r is AnalyticsRow => !!r) : []
  const listed = metrics ? metrics.rows.filter((r) => !TILES.includes(r.label)) : []
  const baseN = metrics ? `all ${metrics.shorts.toLocaleString("en-US")}` : ""
  const compare = (r: AnalyticsRow) =>
    r.kind === "level"
      ? `Median of ${baseN}: ${r.all}`
      : r.kind === "flag"
        ? `Its channel: ${r.channel} of shorts · ${baseN}: ${r.all}`
        : `Channel median ${r.channel} · median of ${baseN} ${r.all}${r.pct == null ? "" : ` · ${ordinal(r.pct)} percentile in its channel`}`
  const shown = (r: AnalyticsRow) => (r.kind === "level" ? r.channel : r.value)
  const right: [string, string, ReactNode][] = [
    // Resonance first (docs/RESONANCE.md): the gauge with the stack's factors beside it. It reads only
    // resonance-formula.json and stays empty, naming what unlocks it, until that file holds this video.
    [
      "resonance",
      "Resonance",
      <ChartBlock key="resonance" title="Resonance" height="auto">
        <div className="@container">
          <div className="grid items-center gap-6 @2xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <ResonanceGauge pre={score?.pre ?? null} post={score?.post ?? null} />
            <ResonanceFactors score={score} factors={factors} />
          </div>
          {!score && <UnlockList actions={[{ what: "The gauge fills once the Resonance stack is fitted" }, ...unlock]} />}
        </div>
      </ChartBlock>,
    ],
    [
      "stats",
      "Analytics",
      <ListBlock key="stats" title="Analytics" height="auto">
        {metrics ? (
          <div className="grid gap-x-6 text-xs @md:grid-cols-2">
            <div className="col-span-full mb-3 grid grid-cols-2 gap-2 @lg:grid-cols-4">
              {tiles.map((r) => (
                <div key={r.label} className="rounded-lg bg-muted/50 px-2 py-1.5">
                  <div className="text-[10px] text-slate-800">{r.label}</div>
                  <Hint text={compare(r)}>
                    <span className="tabular block text-sm text-pax2-blue">{r.value}</span>
                  </Hint>
                </div>
              ))}
            </div>
            {listed.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-2 border-t py-1.5">
                <span className="text-slate-800">{r.label}</span>
                <Hint text={compare(r)}>
                  <span className="tabular">{shown(r)}</span>
                </Hint>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600">This short is outside the baseline the metrics are computed over.</p>
        )}
      </ListBlock>,
    ],
    [
      "mode",
      "Profile similarity",
      <ChartBlock key="mode" title="Profile similarity" height="auto">
        {match && template ? <ModeMatch score={match.score} mode={match.mode} template={template} rows={recipe!} /> : <UnlockList actions={unlock.length ? unlock : [{ what: "No profile-similarity read for this video yet" }]} />}
      </ChartBlock>,
    ],
    ["recs", "Recommendations", <ListBlock key="recs" title="Recommendations" height="max"><Recommendations rows={recipe} unlock={recipe ? [] : unlock} /></ListBlock>],
    // Moved from /evidence#carry (2026-10-22): the catalog's lift, read against this video.
    ["carry", "Feature index", <CarryBlock key="carry" ytId={ytId} />],
    // The per-video chart homes (docs/RESONANCE-EVAL.md): the craft octagon, then the root's length
    // and topic charts in per-video form. Each appears only when its measure exists for this video.
    ...(template ? ([["craft", "Production profile", <ChartBlock key="craft" title="Production profile" height="auto"><CraftOctagon template={template} /></ChartBlock>]] as [string, string, ReactNode][]) : []),
    ...(lengthSec > 0 ? ([["length", "Resonant Length", <LengthBlock key="length" mark={lengthSec} />]] as [string, string, ReactNode][]) : []),
    ...(topic != null ? ([["topic", "Resonant Topic", <ChartBlock key="topic" title="Resonant Topic" height="max"><TopicRows cluster={topic} /></ChartBlock>]] as [string, string, ReactNode][]) : []),
  ]
  if (f)
    right.push([
      "notes",
      "Visual Notes",
      <CardBlock key="notes" title="Visual Notes" height="max" footer={sampled ? SAMPLE : undefined}>
        <Observations part="summary" f={f} />
      </CardBlock>,
    ])
  if (lines)
    right.push([
      "transcript",
      "Transcript",
      <ListBlock key="transcript" title="Transcript" height="max" footer={sampled ? SAMPLE : undefined}>
        <ScriptTimeline lines={lines} duration={duration} />
      </ListBlock>,
    ])
  // The two ad codebooks: the video's real codes (data/generated/codebook.json) first, the sample's only where none exist.
  const swayable = coded?.swayable ?? sample?.codes?.swayable
  const wesleyanGoal = coded?.wesleyan ?? sample?.codes?.wesleyan
  // Every video page carries all three; a block with no code for this video says so and offers a notification.
  // Two blocks to a row where the column is wide enough, one above the other where it is not.
  const pair = (a: ReactNode, b: ReactNode) => (
    <div className="@container">
      <div className="grid gap-5 @3xl:grid-cols-2 [&>*]:min-w-0">
        {a}
        {b}
      </div>
    </div>
  )
  right.push(["codebooks", "Swayable and Upworthy", pair(<SwayableBlock key="swayable" videoId={ytId} codes={swayable} footer={swayable?.length && !coded?.swayable ? SAMPLE : undefined} />, <UpworthyBlock key="upworthy" videoId={ytId} title={v?.title} />)])
  right.push(["visual", "Wesleyan and Visual Characteristics", pair(<WesleyanBlock key="wesleyan" videoId={ytId} goal={wesleyanGoal} party={coded?.wesleyanParty} footer={wesleyanGoal && !coded?.wesleyan ? SAMPLE : undefined} />, <CensusCharacteristics key="characteristics" census={cen} />)])
  right.push(
    [
      "hits",
      "Hits and Misses",
      <ChartBlock
        key="hits"
        title="Hits and Misses"
        tools={<Term id="hits-and-misses" label={false} />}
        height="auto"
        footer={
          <span className="flex w-full flex-wrap items-center justify-end gap-4">
            {(Object.keys(TIER) as Tier[]).map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: TIER[t].dot }} /> {TIER[t].label}
              </span>
            ))}
          </span>
        }
      >
        <div className="aspect-[1100/460] w-full">
          <HitsScatter mark={v && ratio != null ? { id: ytId, title: v.title, channel: ch?.name ?? "", published: v.published, views: v.views ?? 0, ratio, tier: ratio >= 3 ? "breakout" : ratio <= 0.5 ? "killed" : "baseline" } : undefined} />
        </div>
      </ChartBlock>,
    ],
    [
      "formula",
      "Formula",
      <FormulaBlock key="formula" title="Formula" tools={<Term id="formula" label={false} />} height="auto">
        <div className="@container pb-4">
        <div className="grid gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
          {FORMULAS.map(([step, tex]) => (
            <div key={step} className="surface @container flex min-w-0 flex-col gap-2 p-4">
              <p className="text-sm font-medium text-slate-900">{step}</p>
              {/* The typeset formula scales with its card, so it fits a narrow panel without scrolling. */}
              <div className="flex min-h-28 min-w-0 items-center justify-center overflow-x-auto [&_.katex-display]:my-0 [&_.katex]:text-[clamp(9px,5.2cqw,17px)]">
                <FormulaExplainer title={step} html={katex.renderToString(tex, { displayMode: true, throwOnError: true, output: "html" })} {...EXPLAIN[step]} />
              </div>
            </div>
          ))}
        </div>
        </div>
      </FormulaBlock>,
    ],
    [
      "forecast",
      "Forecast",
      <MainBlock key="forecast" title="Forecast" tools={<Term id="forecast" label={false} />} height="auto">
        <ReadingPanel takeId={id} evidence={[]} initial={null} events={[]} calls={[]} canRead={false} nextDataset={null} baseline={null} baselineSnapshot="" bare />
      </MainBlock>,
    ],
  )

  // The comments sit at the foot of the right column, in the seven-row shape.
  right.push([
    "comments",
    "Comments",
    <ListBlock key="comments" title="Comments" height="max">
      <CommentThread videoId={ytId} threads={sevenRows(comments)} />
    </ListBlock>,
  ])
  // The same score as a credit-report card, at the foot: the number and its band, then what helps and hurts it.
  if (score) right.push(["resonance-card", "Resonance factors", <ChartBlock key="resonance-card" title="Resonance factors" height="auto"><ResonanceCard score={score} factors={factors} /></ChartBlock>])

  const column = (page: string, blocks: [string, string, ReactNode][], lock: (key: string) => boolean) => (
    <BlockOrder page={page} initial={blocks.map(([key]) => key)}>
      {blocks.map(([key, label, node]) => (
        <OrderedBlock key={key} id={key} label={label}>
          {lock(key) ? <Locked locked={locked}>{node}</Locked> : node}
        </OrderedBlock>
      ))}
    </BlockOrder>
  )

  return (
    <SeekProvider>
      <UsageOpen subject={id} />
      {locked && <SignupGate />}
      <SplitColumns
        at={inDrawer ? "xl" : "4xl"}
        initial={inDrawer ? 280 : 320}
        rightClassName={inDrawer ? "@xl:-mt-5" : "@4xl:-mt-5"}
        left={
          <>
            {/* The portrait, 300px wide at 9/16, until the column is wider than it; then the frame turns
                landscape at the column's width, the short whole inside it on black. */}
            <div className="@container/portrait w-full">
            {real ? (
              <div className="mx-auto aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-2xl bg-black shadow-e2 @[301px]/portrait:aspect-video @[301px]/portrait:max-w-none">
                <Player src={`/api/video/${id}`} subject={id} poster={`https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`} className="aspect-auto size-full max-w-none rounded-none object-cover shadow-none @[301px]/portrait:object-contain" />
              </div>
            ) : (
              <div className="mx-auto aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-2xl bg-slate-900 shadow-e2 @[301px]/portrait:aspect-video @[301px]/portrait:max-w-none">
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}`}
                  title={v?.title ?? "YouTube short"}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="size-full border-0"
                />
              </div>
            )}
            </div>
            {column("video-left", left, () => false)}
          </>
        }
        right={
          <>
            {/* Level with the video's top: the column's -mt-5 lifts its first block's mt-5, and this row takes it back. */}
            <div className="mt-5">
              <AskVideo ytId={ytId} title={(v?.title ?? "This short").replace(/\s*#\w+/g, "").trim() || "This short"} />
            </div>
            {column("video-right", right, (key) => key !== "stats")}
          </>
        }
      />
    </SeekProvider>
  )
}
