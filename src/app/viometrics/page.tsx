import fs from "node:fs"
import path from "node:path"

import { ChartBlock } from "@/components/blocks"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { CompositeChart, EmbeddingChart, HeatBar } from "@/components/viometrics/charts"

// /viometrics: each video's measured signature on ECharts canvas. The Multi-Modal Viometric Line
// Chart is the video's own per-frame record — every scene score a striation, the loudness curve,
// brightness, saturation, on-screen text and cuts on one zoomable timeline. Beneath it, the
// percentile heat bar: all 44 catalog-normalized variables, one cell each. The Embedding chart is
// the content vector, every component. Deterministic from measured data; the stand-in says invented.

export const dynamic = "force-dynamic"
export const metadata = { title: "Viometrics" }

type SpecPoint = { band: string; key: string; raw: number | null; v: number | null }
type Dense = { duration: number; scenes: [number, number][]; cuts: number[]; frames: { t: number; y: number; sat: number; words: number }[]; loudness: [number, number][] }
type Video = { id: string; label: string; title: string; invented: boolean; spectrum: SpecPoint[]; vector: number[] | null; dense: Dense | null }

export default function ViometricsPage() {
  const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/generated/viometrics.json"), "utf8")) as { videos: Video[] }
  return (
    <div className="flex flex-col gap-6">
      <BlockOrder page="viometrics" initial={data.videos.map((v) => v.id)}>
        {data.videos.map((v) => (
          <OrderedBlock key={v.id} id={v.id} label={`${v.label} — ${v.title}`}>
            <ChartBlock title={`${v.label} — ${v.title}${v.invented ? " (invented)" : ""}`} height="auto" name={`viometric-${v.id}`}>
              <div className="flex flex-col gap-3">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Multi-Modal Viometric Line Chart</p>
                {v.dense ? <CompositeChart d={v.dense} /> : <p className="text-sm text-slate-400">No per-frame record for this video yet.</p>}
                <HeatBar spectrum={v.spectrum} />
                <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Embedding</p>
                <EmbeddingChart vector={v.vector} invented={v.invented} />
              </div>
            </ChartBlock>
          </OrderedBlock>
        ))}
      </BlockOrder>
    </div>
  )
}
