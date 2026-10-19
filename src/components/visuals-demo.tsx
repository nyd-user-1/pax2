"use client"

import * as React from "react"
import "./visuals-demo.css"

import { MainBlock, TableBlock } from "@/components/blocks"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { cn } from "@/ui/lib/utils"

// The visuals lane, held apart from the record and Studio paths until proven: one library script's
// shot list, each beat's stock pull beside its generated image, the motion that replaces a static
// slide, Luma Ray 2 clips as they land, and the presenter options with what each needs. Everything
// here comes from data/generated/visuals/demo.json, written by scripts/visuals/demo.mjs.

export type VisualsData = {
  builtAt: string
  script: { id: string; title: string }
  model: { shots: string; image: string; video: string }
  beats: { line: string; query: string; prompt: string; stock: { file: string; source: string; credit: string | null } | null; canvas: { file?: string; source?: string; error?: string } | null }[]
  reel: { arn: string | null; prompt: string; status: string; file: string | null }[]
  quota: { image: string; video: string }
}

function Shot({ file, label, motion, i }: { file: string; label: string; motion: boolean; i: number }) {
  return (
    <figure className="m-0">
      <div className="aspect-[9/16] overflow-hidden rounded-lg border bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={file} alt={label} className={cn("size-full object-cover", motion && (i % 2 ? "kb-drift-b" : "kb-drift-a"))} />
      </div>
      <figcaption className="mt-1.5 text-xs text-slate-500">{label}</figcaption>
    </figure>
  )
}

function Missing({ note }: { note: string }) {
  return (
    <div className="flex aspect-[9/16] items-center justify-center rounded-lg border border-dashed bg-slate-50 p-4">
      <p className="text-center text-xs leading-relaxed text-slate-500">{note}</p>
    </div>
  )
}

const PRESENTERS = [
  { name: "HeyGen", makes: "a talking presenter from a photo or a stock avatar, lip-synced to the script's audio", needs: "an API key; a free tier exists", note: "largest avatar library" },
  { name: "Hedra", makes: "an expressive talking character from one image and an audio track", needs: "an API key", note: "strongest facial performance" },
  { name: "D-ID", makes: "a presenter from a still portrait, API-first", needs: "an API key; trial credits exist", note: "simplest integration" },
]

export function VisualsDemo({ data }: { data: VisualsData | null }) {
  const [motion, setMotion] = React.useState(true)
  if (!data)
    return (
      <BlockOrder page="visuals" initial={["beats"]}>
        <OrderedBlock id="beats" label="Visuals">
          <MainBlock title="Visuals" height="auto">
            <p className="py-10 text-center text-sm text-slate-500">No demo yet. `node scripts/visuals/demo.mjs` writes it.</p>
          </MainBlock>
        </OrderedBlock>
      </BlockOrder>
    )
  return (
    <BlockOrder page="visuals" initial={["beats", "clips", "presenter"]}>
      <OrderedBlock id="beats" label="Stock against generated">
        <MainBlock
          title="Stock against generated, beat by beat"
          height="auto"
          tools={
            <button type="button" onClick={() => setMotion(!motion)} className={cn("rounded-md px-2.5 py-1 text-xs transition-colors", motion ? "bg-pax2-lavender text-pax2-blue" : "text-slate-800 hover:bg-muted")}>
              {motion ? "Motion on" : "Motion off"}
            </button>
          }
          footer={`"${data.script.title}" cut into ${data.beats.length} shots by ${data.model.shots}; built ${new Date(data.builtAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}. The motion is the same pan the renderer gives each still.`}
        >
          <div className="space-y-8">
            {data.beats.map((b, i) => (
              <div key={i} data-find={b.line} className="grid gap-4 md:grid-cols-[1fr_200px_200px]">
                <div className="min-w-0 self-center">
                  <p className="text-sm leading-relaxed">{b.line}</p>
                  <p className="mt-2 text-xs text-slate-500">prompt: {b.prompt}</p>
                </div>
                {b.stock ? <Shot file={b.stock.file} label={`${b.stock.source}${b.stock.credit ? `, ${b.stock.credit}` : ""}`} motion={motion} i={i} /> : <Missing note={`no stock hit for "${b.query}"`} />}
                {b.canvas?.file ? <Shot file={b.canvas.file} label={b.canvas.source ?? "generated"} motion={motion} i={i + 1} /> : <Missing note={data.quota.image} />}
              </div>
            ))}
          </div>
        </MainBlock>
      </OrderedBlock>
      <OrderedBlock id="clips" label="Clips">
        <MainBlock title="Clips (Luma Ray 2 on Bedrock)" height="auto" footer="5-second text-to-video per shot, started async into S3; `node scripts/visuals/demo.mjs --collect` pulls the finished files.">
          <div className="grid gap-4 md:grid-cols-3">
            {data.reel.map((r, i) => (
              <div key={i} data-find={r.prompt}>
                {r.file ? (
                  <video src={r.file} controls loop muted playsInline className="aspect-[9/16] w-full rounded-lg border bg-black object-cover" />
                ) : (
                  <Missing note={r.arn ? `job ${r.status}` : data.quota.video} />
                )}
                <p className="mt-1.5 text-xs text-slate-500">{r.prompt}</p>
              </div>
            ))}
          </div>
        </MainBlock>
      </OrderedBlock>
      <OrderedBlock id="presenter" label="Presenter">
        <TableBlock title="Presenter, the no-camera human" height="auto" footer="A realistic synthetic person in political video carries YouTube's synthetic-media disclosure and New York's synthetic-media rules for political communications; showing the option is the demo, running it for a client is the client's call.">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-slate-500">
                <th className="py-2 pr-4 font-normal">Service</th>
                <th className="py-2 pr-4 font-normal">What it makes</th>
                <th className="py-2 pr-4 font-normal">What it needs</th>
                <th className="py-2 font-normal">Note</th>
              </tr>
            </thead>
            <tbody>
              {PRESENTERS.map((p) => (
                <tr key={p.name} data-find={p.name} className="border-b last:border-b-0">
                  <td className="py-2.5 pr-4 font-medium">{p.name}</td>
                  <td className="py-2.5 pr-4">{p.makes}</td>
                  <td className="py-2.5 pr-4">{p.needs}</td>
                  <td className="py-2.5 text-slate-500">{p.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableBlock>
      </OrderedBlock>
    </BlockOrder>
  )
}
