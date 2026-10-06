import Link from "next/link"

import deliveryJson from "../../data/generated/delivery.json"
import shorts from "../../data/raw/yt-shorts.json"
import { RangeBar } from "@/components/bits"
import { Fold } from "@/components/fold"
import { ReadingPanel } from "@/components/reading-panel"
import { Term } from "@/components/term"
import { ScoreInfo } from "@/components/ui-pax"
import { Loudness, Observations, Player, ScriptTimeline, SeekProvider } from "@/components/workbench"
import { featuresFor, type Features } from "@/lib/catalog"
import { channelById, secs } from "@/lib/channels"
import { COMPONENTS } from "@/lib/resonance"
import { cn } from "@/ui/lib/utils"

type Yt = { fetchedAt: string; videos: { id: string; channelId: string; channel: string; title: string; published: string; duration: string; views: number | null; likes: number | null; comments: number | null }[] }

const DASH = "-"

const KPI_ROWS = ["Counts", "Rate", "Ref. avg", "Weighted", "Distance", "Score", "Weight"]
const KPI_TERMS: Record<string, string> = { Counts: "counts", Rate: "rate", "Ref. avg": "reference-average", Weighted: "weighted-rate", Distance: "distance", Score: "component-score", Weight: "weight" }
const WINDOW_ROWS = ["Spend", "Impressions", "Reach", "3s plays", "ThruPlays", "25% play", "50% play", "75% play", "100% play", "Avg. Time", "Shares", "Saves", "Comments", "Reactions", "Clicks", "CTA"]

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

/** A campaign short in the take panel's exact shape; counts PAX does not hold read as a dash. */
export function ShortView({ id, inDrawer = false }: { id: string; inDrawer?: boolean }) {
  const delivery = (deliveryJson as unknown as { videos: Record<string, { energy?: string; vocalTone?: string[]; mode?: string; frame?: string; sarcasm?: { present?: boolean; cue?: string } }> }).videos[id]
  const ytId = id.replace(/^yt-/, "")
  const data = shorts as unknown as Yt
  const v = data.videos.find((x) => x.id === ytId)
  const f = featuresFor(id)
  const ch = v ? channelById(v.channelId) : undefined
  const lines = transcriptLines(f)
  const duration = f?.audio?.durationSec ?? (v ? secs(v.duration) : 0)
  const siblings = v
    ? data.videos.filter((x) => x.channelId === v.channelId && x.id !== ytId && featuresFor(`yt-${x.id}`)).slice(0, 3)
    : []
  const stat = (label: string, value: string) => (
    <div className="flex flex-col">
      <span className="tabular text-lg font-semibold text-slate-900">{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  )

  return (
    <SeekProvider>
      <div className={cn("grid gap-8", inDrawer ? "@xl:grid-cols-[280px_1fr]" : "@4xl:grid-cols-[320px_1fr]")}>
        <aside className={cn("flex flex-col gap-4", inDrawer ? "@xl:sticky @xl:top-0 @xl:self-start" : "@4xl:sticky @4xl:top-0 @4xl:self-start")}>
          {f ? (
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
          {f?.audio && !f.audio.error ? (
            <div className="surface p-4">
              <Loudness f={f.audio} />
            </div>
          ) : (
            <div className="surface flex items-center justify-between p-4 text-xs text-slate-500">
              <span>dB</span>
              <span className="tabular">{DASH}</span>
            </div>
          )}
          {siblings.length > 0 && (
            <div className="surface flex flex-col gap-1 p-4">
              <p className="pb-1 text-xs font-medium text-slate-500">Comps</p>
              {siblings.map((x) => (
                <Link key={x.id} href={`/v/yt-${x.id}`} scroll={false} replace={inDrawer} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <span className="line-clamp-1">{x.title.replace(/\s*#\w+/g, "").trim() || x.title}</span>
                  <span className="tabular shrink-0 font-semibold text-slate-700">{DASH}</span>
                </Link>
              ))}
            </div>
          )}
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          {!inDrawer && <h1 className="font-display text-2xl leading-tight text-slate-900 md:text-[28px]">{v?.title ?? id}</h1>}
          {inDrawer && v && <p className="font-display text-lg leading-snug text-slate-900">{v.title}</p>}

          {delivery && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {[delivery.energy && `${delivery.energy} energy`, ...(delivery.vocalTone ?? []), delivery.mode?.replace(/-/g, " "), delivery.frame?.replace(/-/g, " ")].filter(Boolean).map((t) => (
                <span key={String(t)} className="rounded-full bg-white px-2 py-0.5 text-slate-600 shadow-e1">{t}</span>
              ))}
            </div>
          )}

          <div className="surface grid grid-cols-2 gap-4 p-5 @lg:grid-cols-4">
            {stat("Reach", DASH)}
            {stat("Watched 3s+", DASH)}
            {stat("Avg.", DASH)}
            {stat("Spend", DASH)}
          </div>

          <Fold
            title="Resonance"
            info={<ScoreInfo />}
            preview={
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="tabular flex items-baseline gap-2">
                    <span className="font-display text-4xl text-pax-ink">{DASH}</span>
                    <span className="text-xs text-muted-foreground">{DASH}</span>
                  </div>
                  <div className="min-w-56 flex-1">
                    <RangeBar value={null} low={null} high={null} />
                    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>0</span>
                      <span>50 = reference average</span>
                      <span>100</span>
                    </div>
                  </div>
                </div>
                <ul className="flex flex-col gap-1 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  <li>Evidence: {DASH}</li>
                </ul>
                <div className="grid gap-3 @2xl:grid-cols-3">
                  {COMPONENTS.map((meta) => (
                    <div key={meta.key} className="surface flex flex-col gap-2 p-3">
                      <div className="flex items-baseline justify-between">
                        <span className="font-medium text-pax-ink">{meta.name}</span>
                        <Term id={meta.key} label={false} />
                      </div>
                      <p className="text-xs text-muted-foreground">{meta.question}</p>
                      <div className="tabular flex items-baseline gap-1.5">
                        <span className="font-display text-3xl text-pax-ink">{DASH}</span>
                        <span className="text-xs text-muted-foreground">{DASH}</span>
                      </div>
                      <RangeBar value={null} low={null} high={null} />
                    </div>
                  ))}
                </div>
              </div>
            }
          >
            <div className="flex flex-col gap-6">
              <details open className="group rounded-xl border">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-pax-ink">KPIs</summary>
                <div className="overflow-x-auto px-4 pb-4">
                  <table className="tabular w-full text-sm">
                    <thead className="text-left text-xs text-slate-500">
                      <tr className="[&_th]:whitespace-nowrap [&_th]:py-2 [&_th]:pr-6 [&_th]:font-medium">
                        <th />
                        {COMPONENTS.map((meta, i) => (
                          <th key={meta.key}>
                            <Term id={meta.key}>{meta.name}</Term> <span className="font-normal text-slate-400">· {[25, 40, 35][i]}%</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="[&_td]:whitespace-nowrap [&_td]:border-t [&_td]:border-slate-100 [&_td]:py-2 [&_td]:pr-6">
                      {KPI_ROWS.map((label) => (
                        <tr key={label}>
                          <td className="text-slate-500"><Term id={KPI_TERMS[label]} /></td>
                          {COMPONENTS.map((meta) => (
                            <td key={meta.key}>{DASH}</td>
                          ))}
                        </tr>
                      ))}
                      <tr className="font-semibold text-pax-ink">
                        <td><Term id="resonance" /></td>
                        <td colSpan={3}>{DASH}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </details>

              <details open className="group rounded-xl border">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-pax-ink">{DASH}</summary>
                <div className="grid gap-x-6 px-4 pb-4 text-xs @md:grid-cols-2">
                  {WINDOW_ROWS.map((label) => (
                    <div key={label} className="flex items-center justify-between gap-2 border-t py-1.5">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="tabular">{DASH}</span>
                    </div>
                  ))}
                  <div className="col-span-full mt-3 grid grid-cols-2 gap-2 @lg:grid-cols-4">
                    {["Spend", "Impressions (1k)", "3s play", "Per Person"].map((label) => (
                      <div key={label} className="rounded-lg bg-muted/50 px-2 py-1.5">
                        <div className="text-[10px] text-muted-foreground">{label}</div>
                        <div className="tabular text-sm text-pax-ink">{DASH}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </div>
          </Fold>

          <Fold title="Formula" preview={f ? <Observations part="summary" f={f} /> : <p className="tabular text-sm text-slate-500">{DASH}</p>}>
            {f?.pegasus?.result?.characteristics && <Observations part="detail" f={f} />}
          </Fold>

          <Fold title="Transcript" preview={lines ? <ScriptTimeline lines={lines} duration={duration} /> : <p className="tabular text-sm text-slate-500">{DASH}</p>} />

          <ReadingPanel takeId={id} evidence={[]} initial={null} events={[]} calls={[]} canRead={false} nextDataset={null} baseline={null} baselineSnapshot="" />
        </div>
      </div>
    </SeekProvider>
  )
}
