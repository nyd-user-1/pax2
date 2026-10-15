import katex from "katex"
import "katex/dist/katex.min.css"
import * as React from "react"
import type { ReactNode } from "react"
import Link from "next/link"

import subscribers from "../../data/generated/channel-subscribers.json"
import warBaseline from "../../data/generated/war-baseline.json"
import sampleVideos from "../../data/sample/videos.json"
import homeFeed from "../../data/generated/home-feed.json"
import shorts from "../../data/raw/yt-shorts.json"
import { RangeBar } from "@/components/bits"
import { CardBlock, ChartBlock, FormulaBlock, ListBlock, MainBlock, TableBlock } from "@/components/blocks"
import { SwayableBlock, UpworthyBlock, WesleyanBlock, type Codes } from "@/components/codebook-blocks"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { HitsScatter, TIER } from "@/components/hits-scatter"
import { FormulaExplainer } from "@/components/formula-explainer"
import { ReadingPanel } from "@/components/reading-panel"
import { Term } from "@/components/term"
import { SignupGate } from "@/components/signup-gate"
import { StickyAside } from "@/components/sticky-aside"
import { TagChip } from "@/components/tag-chip"
import { ScoreInfo } from "@/components/ui-pax2"
import { Loudness, Observations, Player, ScriptTimeline, SeekProvider } from "@/components/workbench"
import { currentUser } from "@/lib/auth"
import { featuresFor, type Features } from "@/lib/catalog"
import { EXPLAIN, FORMULAS } from "@/lib/formulas"
import { channelById, secs } from "@/lib/channels"
import { labVideos, type Tier } from "@/lib/lab"
import { COMPONENTS } from "@/lib/resonance"
import { tagsFor } from "@/lib/tags"
import { cn } from "@/ui/lib/utils"

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
export async function ShortView({ id, inDrawer = false }: { id: string; inDrawer?: boolean }) {
  const ytId = id.replace(/^yt-/, "")
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
  const signedIn = !!(await currentUser())
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
  const res = sample?.resonance
  const realTags = tagsFor(id)
  const tags = realTags.length ? realTags : (sample?.tags ?? [])
  /** YouTube returned no like count; a sample video fills it, and the Stats block says so. */
  const sampleLikes = v?.likes == null ? (sample as { likes?: number } | undefined)?.likes : undefined
  const likes = v?.likes ?? sampleLikes ?? null
  const statRows: [string, string][] = [
    ["Views", n(v?.views)],
    ["Median", n(scored ? Math.round(scored.channelMedian) : null)],
    ["Likes", n(likes)],
    ["Like rate", pct(likes)],
    ["Comments", n(v?.comments)],
    ["Comment rate", pct(v?.comments)],
    ["iWAR", ratio == null ? DASH : times(ratio)],
    ["WAR", v?.views == null ? DASH : times(v.views / warBaseline.median)],
    ["Subscribers", n(v ? (subscribers as Record<string, number | null>)[v.channelId] : null)],
    ["Length", v ? `${Math.floor(secs(v.duration) / 60)}:${String(secs(v.duration) % 60).padStart(2, "0")}` : DASH],
    ["Date", v ? new Date(v.published).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : DASH],
  ]
  const statGrid = (rs: [string, string][]) => <div className="grid grid-cols-2 gap-4">{rs.map(([label, value]) => <React.Fragment key={label}>{stat(label, value)}</React.Fragment>)}</div>

  const left: [string, string, ReactNode][] = [
    [
      "stats",
      "Stats",
      <CardBlock key="stats" title="Stats" height="auto" defaultOpen={false} footer={sampleLikes != null ? SAMPLE : undefined} peek={statGrid(statRows.slice(0, 4))} rows={statRows.map(([stat, value]) => ({ stat, value }))} name={`stats-${ytId}`}>
        {statGrid(statRows)}
      </CardBlock>,
    ],
  ]
  left.push([
    "analytics",
    "Analytics",
    <Locked key="analytics" locked={locked}>
      <CardBlock title="Analytics" height="auto" footer={paid ? SAMPLE : undefined}>
        <div className="grid grid-cols-2 gap-4">
          {stat("Reach", paid?.analytics.Reach ?? DASH)}
          {stat("3s+", paid?.analytics["3s+"] ?? DASH)}
          {stat("Avg.", paid?.analytics["Avg."] ?? DASH)}
          {stat("Spend", paid?.analytics.Spend ?? DASH)}
        </div>
      </CardBlock>
    </Locked>,
  ])
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
        <ListBlock title="Comps" height="auto" footer={sampled ? SAMPLE : undefined}>
          <div className="flex flex-col gap-1">
            {siblings.map((x) => (
              <Link key={x.id} href={`/v/yt-${x.id}`} scroll={false} replace={inDrawer} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                <span className="line-clamp-1">{x.title.replace(/\s*#\w+/g, "").trim() || x.title}</span>
                <span className="tabular shrink-0 font-semibold text-slate-700">{DASH}</span>
              </Link>
            ))}
          </div>
        </ListBlock>
      </Locked>,
    ])

  if (tags.length)
    left.push([
      "tags",
      "Tags",
      <CardBlock key="tags" title="Tags" height="auto" footer={!realTags.length && tags.length ? SAMPLE : undefined}>
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((t) => (
            <TagChip key={t} tag={t} />
          ))}
        </div>
      </CardBlock>,
    ])

  const right: [string, string, ReactNode][] = [
    [
      "resonance",
      "Resonance",
      <CardBlock key="resonance" title="Resonance" tools={<ScoreInfo />} height="auto" footer={sample ? SAMPLE : undefined}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="tabular flex items-baseline gap-2">
              <span className="font-display text-4xl text-pax2-ink">{res?.score ?? DASH}</span>
              <span className="text-xs text-muted-foreground">{res ? `${res.low}–${res.high}` : DASH}</span>
            </div>
            <div className="min-w-0 flex-1 basis-56">
              <RangeBar value={res?.score ?? null} low={res?.low ?? null} high={res?.high ?? null} />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>0</span>
                <span>50 = reference average</span>
                <span>100</span>
              </div>
            </div>
          </div>
          <div className="grid gap-3 @2xl:grid-cols-3">
            {COMPONENTS.map((meta) => (
              <div key={meta.key} className="surface flex flex-col gap-2 p-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium text-pax2-ink">{meta.name}</span>
                  <Term id={meta.key} label={false} />
                </div>
                <div className="tabular flex items-baseline gap-1.5">
                  <span className="font-display text-3xl text-pax2-ink">{res?.components[meta.key]?.score ?? DASH}</span>
                  <span className="text-xs text-muted-foreground">{res ? `${res.components[meta.key].low}–${res.components[meta.key].high}` : DASH}</span>
                </div>
                <RangeBar value={res?.components[meta.key]?.score ?? null} low={res?.components[meta.key]?.low ?? null} high={res?.components[meta.key]?.high ?? null} />
              </div>
            ))}
          </div>
        </div>
      </CardBlock>,
    ],
    [
      "kpis",
      "KPIs",
      <TableBlock key="kpis" title="KPIs" tools={<Term id="kpis" label={false} />} height="auto" footer={sample ? SAMPLE : undefined}>
        <div className="overflow-x-auto">
          <table className="tabular w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr className="[&_th]:whitespace-nowrap [&_th]:py-2 [&_th]:pr-6 [&_th]:font-medium">
                <th />
                {COMPONENTS.map((meta, i) => (
                  <th key={meta.key}>
                    {meta.name} <span className="font-normal text-slate-400">· {[25, 40, 35][i]}%</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="[&_td]:whitespace-nowrap [&_td]:border-t [&_td]:border-slate-100 [&_td]:py-2 [&_td]:pr-6">
              {KPI_ROWS.map((label) => (
                <tr key={label}>
                  <td className="text-slate-500">{label}</td>
                  {COMPONENTS.map((meta) => (
                    <td key={meta.key}>{(sample?.kpis[label] as Record<string, string> | undefined)?.[meta.key] ?? DASH}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableBlock>,
    ],
    [
      "paid",
      "Paid",
      <ListBlock key="paid" title="Paid" tools={<Term id="paid" label={false} />} height="auto" footer={paid ? SAMPLE : undefined}>
        <div className="grid gap-x-6 text-xs @md:grid-cols-2">
          {WINDOW_ROWS.map((label) => (
            <div key={label} className="flex items-center justify-between gap-2 border-t py-1.5">
              <span className="text-muted-foreground">{label}</span>
              <span className="tabular">{paid?.[label] ?? DASH}</span>
            </div>
          ))}
          <div className="col-span-full mt-3 grid grid-cols-2 gap-2 @lg:grid-cols-4">
            {["Spend", "Impressions (1k)", "3s play", "Per Person"].map((label) => (
              <div key={label} className="rounded-lg bg-muted/50 px-2 py-1.5">
                <div className="text-[10px] text-muted-foreground">{label}</div>
                <div className="tabular text-sm text-pax2-ink">{paid?.tiles[label] ?? DASH}</div>
              </div>
            ))}
          </div>
        </div>
      </ListBlock>,
    ],
  ]
  if (f)
    right.push([
      "notes",
      "Visual Notes",
      <CardBlock key="notes" title="Visual Notes" height="auto" footer={sampled ? SAMPLE : undefined}>
        <div className="flex flex-col gap-6">
          <Observations part="summary" f={f} />
          {f.pegasus?.result?.characteristics && <Observations part="detail" f={f} />}
        </div>
      </CardBlock>,
    ])
  if (lines)
    right.push([
      "transcript",
      "Transcript",
      <ListBlock key="transcript" title="Transcript" height="auto" footer={sampled ? SAMPLE : undefined}>
        <ScriptTimeline lines={lines} duration={duration} />
      </ListBlock>,
    ])
  // The two ad codebooks need the video coded on them; today only the sample video is.
  const codes = sample?.codes
  if (codes?.swayable?.length) right.push(["swayable", "Swayable", <SwayableBlock key="swayable" codes={codes.swayable} footer={SAMPLE} />])
  if (codes?.wesleyan) right.push(["wesleyan", "Wesleyan", <WesleyanBlock key="wesleyan" goal={codes.wesleyan} footer={SAMPLE} />])
  if (v?.title) right.push(["upworthy", "Upworthy", <UpworthyBlock key="upworthy" title={v.title} />])
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
          <HitsScatter />
        </div>
      </ChartBlock>,
    ],
    [
      "formula",
      "Formula",
      <FormulaBlock key="formula" title="Formula" tools={<Term id="formula" label={false} />} height="auto">
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
      {locked && <SignupGate />}
      <div className={cn("grid gap-8", inDrawer ? "@xl:grid-cols-[280px_1fr]" : "@4xl:grid-cols-[320px_1fr]")}>
        <StickyAside className={cn("flex flex-col", inDrawer ? "@xl:sticky @xl:top-0 @xl:self-start" : "@4xl:sticky @4xl:top-0 @4xl:self-start")}>
          {real ? (
            <div className={cn("relative aspect-video overflow-hidden rounded-2xl bg-black shadow-e2", inDrawer ? "@xl:aspect-auto @xl:overflow-visible @xl:rounded-none @xl:bg-transparent @xl:shadow-none" : "@4xl:aspect-auto @4xl:overflow-visible @4xl:rounded-none @4xl:bg-transparent @4xl:shadow-none")}>
              <Player src={`/api/video/${id}`} poster={`https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`} className={cn("absolute inset-0 h-full w-full max-w-none rounded-none object-contain", inDrawer ? "@xl:static @xl:h-auto @xl:w-full @xl:max-w-[300px] @xl:rounded-2xl @xl:object-cover" : "@4xl:static @4xl:h-auto @4xl:w-full @4xl:max-w-[300px] @4xl:rounded-2xl @4xl:object-cover")} />
            </div>
          ) : (
            <div className={cn("aspect-video overflow-hidden rounded-2xl bg-slate-900 shadow-e2", inDrawer ? "@xl:aspect-[9/16]" : "@4xl:aspect-[9/16]")}>
              <iframe
                src={`https://www.youtube.com/embed/${ytId}`}
                title={v?.title ?? "YouTube short"}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="size-full border-0"
              />
            </div>
          )}
          {column("video-left", left, () => false)}
        </StickyAside>

        <div className={cn("min-w-0", inDrawer ? "@xl:-mt-5" : "@4xl:-mt-5")}>{column("video-right", right, () => true)}</div>
      </div>
    </SeekProvider>
  )
}
