"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Label, PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart, XAxis } from "recharts"

import type { Lesson, Limit } from "@/lib/build-board"
import { AccordionBlock, MainBlock, TwoHalfBlock, TwoThirdBlock } from "@/components/blocks"
import { RefreshButton } from "@/components/dash/card-tools"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/ui/components/nova/chart"
import { cn } from "@/ui/lib/utils"

// The interactive blocks of the Build dashboard, after GovBlock's Database page
// (components/admin/pages/database.tsx): Volume with its ranked list, Budget beside Limits, Insights.

export type VideoCost = { id: string; title: string; label: string; cost: number; poster?: string }
export type SpendItem = { item: string; short: string; usd: number }

const money = (n: number) => `$${n.toFixed(2)}`

/** Volume: spend by item or analysis cost by video, and the videos ranked by cost beside it. */
export function Volume({ spend, videos }: { spend: SpendItem[]; videos: VideoCost[] }) {
  const [view, setView] = React.useState<"spend" | "videos">("spend")
  const data = view === "spend" ? spend.map((s) => ({ name: s.short, value: s.usd, full: s.item })) : videos.map((v) => ({ name: `${v.title} · ${v.label}`, value: v.cost, full: `${v.title} · ${v.label}` }))
  const ranked = [...videos].sort((a, b) => b.cost - a.cost)
  return (
    <TwoThirdBlock>
      <MainBlock
        title={view === "spend" ? "Spend by Item" : "Analysis Cost by Video"}
        id="volume"
        className="xl:col-span-2"
        rows={data.map((d) => ({ item: d.full, usd: d.value }))}
        name="build-volume"
        views={[{ value: "spend", label: "Spend by Item" }, { value: "videos", label: "Cost by Video" }]}
        view={view}
        onView={(v) => setView(v as "spend" | "videos")}
        actions={
          <div className="flex rounded-lg bg-muted p-0.5 text-xs">
            {(["spend", "videos"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={cn("rounded-md px-2.5 py-1", view === v ? "bg-white font-medium shadow-e1" : "text-muted-foreground")}>
                {v === "spend" ? "Spend by Item" : "Cost by Video"}
              </button>
            ))}
          </div>
        }
      >
        <ChartContainer config={{ value: { label: "Estimated", color: "var(--chart-1)" } }} className="aspect-auto h-full w-full">
          <BarChart data={data} margin={{ left: 0, right: 0, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="name" interval={0} tickLine={false} axisLine={false} tickMargin={6} tick={{ fontSize: 9 }} tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)} />
            <ChartTooltip cursor={{ fillOpacity: 0.08 }} content={<ChartTooltipContent indicator="dot" labelFormatter={(_, p) => (p?.[0]?.payload as { full?: string })?.full ?? ""} formatter={(v) => money(Number(v))} />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </MainBlock>
      <MainBlock title="Cost by Video" rows={ranked.map((v) => ({ video: `${v.title} · ${v.label}`, usd: v.cost }))} name="cost-by-video">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {ranked.map((v) => (
              <li key={v.id}>
                <Link href={`/v/${v.id}`} scroll={false} className="flex items-center gap-3 rounded-lg px-1.5 py-1 hover:bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.poster} alt="" className="h-10 w-6 shrink-0 rounded bg-slate-200 object-cover" />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">
                        {v.title} <span className="font-normal text-muted-foreground">· {v.label}</span>
                      </span>
                      <span className="tabular shrink-0 text-muted-foreground">{money(v.cost)}</span>
                    </span>
                    <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${Math.max(2, (v.cost / ranked[0].cost) * 100)}%` }} />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
      </MainBlock>
    </TwoThirdBlock>
  )
}

/** Budget beside Limits: two standard blocks, half and half. */
export function BudgetAndLimits({ spent, cap, facts, limits }: { spent: number; cap: number; facts: { label: string; value: string; note: string }[]; limits: Limit[] }) {
  const share = Math.round((spent / cap) * 100)
  return (
    <TwoHalfBlock>
      <MainBlock title="Budget" rows={facts} name="budget" actions={<RefreshButton />}>
            <ChartContainer config={{ used: { label: "Used", color: "var(--chart-1)" } }} className="mx-auto aspect-square h-40">
              <RadialBarChart data={[{ name: "used", value: share, fill: "var(--chart-1)" }]} startAngle={90} endAngle={90 - (share / 100) * 360} innerRadius={54} outerRadius={74}>
                <PolarGrid gridType="circle" radialLines={false} stroke="none" className="first:fill-muted last:fill-background" polarRadius={[58, 50]} />
                <RadialBar dataKey="value" background cornerRadius={10} />
                <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                  <Label
                    content={({ viewBox }) =>
                      viewBox && "cx" in viewBox && "cy" in viewBox ? (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                            {share}%
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 18} className="fill-muted-foreground text-xs">
                            of ${cap} used
                          </tspan>
                        </text>
                      ) : null
                    }
                  />
                </PolarRadiusAxis>
              </RadialBarChart>
            </ChartContainer>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {facts.map((m) => (
            <div key={m.label} className="rounded-lg border px-3 py-2">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="truncate font-semibold">{m.value}</p>
              <p className="truncate text-xs text-muted-foreground">{m.note}</p>
            </div>
          ))}
        </div>
      </MainBlock>
      <MainBlock title="Limits" rows={limits} name="limits">
        <div className="flex flex-col gap-4">
          {limits.map((q) => {
              const pct = Math.min(100, Math.round((q.used / q.limit) * 100))
              return (
                <div key={q.label} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{q.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{q.sub}</p>
                    </div>
                    <span className="w-32 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                      {q.used.toLocaleString()} / {q.limit.toLocaleString()} {q.unit}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", pct >= 85 ? "bg-pax-red" : "bg-pax-plum")} style={{ width: `${Math.max(1, pct)}%` }} />
                  </div>
                </div>
              )
            })}
        </div>
      </MainBlock>
    </TwoHalfBlock>
  )
}

const OUTCOME: Record<Lesson["outcome"], string> = { clean: "border-pax-plum bg-pax-lavender", partial: "border-amber-500 bg-amber-500/20", failed: "border-pax-red bg-pax-red-soft" }

function LessonRow({ l }: { l: Lesson }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div data-find className="rounded-md border bg-card">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left">
        <span title={l.outcome} className={cn("size-4 shrink-0 rounded-[3px] border", OUTCOME[l.outcome])} />
        <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
        <span className="min-w-0 flex-1 truncate text-sm">{l.title}</span>
        <span className="tabular shrink-0 text-xs text-muted-foreground">{l.headline}</span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{l.when}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t px-3.5 py-3">
          <pre className="m-0 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">{l.ran.join("\n")}</pre>
          <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-relaxed">
            {l.lessons.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

export function InsightsCard({ lessons }: { lessons: Lesson[] }) {
  return (
    <AccordionBlock title="Insights" search="Search insights…" rows={lessons.map((l) => ({ title: l.title, when: l.when, outcome: l.outcome, headline: l.headline, lessons: l.lessons.join(" | ") }))} name="insights">
      <div className="flex flex-col gap-2">
        {lessons.map((l) => (
          <LessonRow key={l.title} l={l} />
        ))}
      </div>
    </AccordionBlock>
  )
}
