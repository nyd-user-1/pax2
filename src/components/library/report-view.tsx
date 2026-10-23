"use client"

import * as React from "react"
import { Download, MessagesSquare } from "lucide-react"

import { MainBlock } from "@/components/blocks"
import { useShellPanel } from "@/components/shell"
import type { ReportPage } from "@/lib/reports"

// A report in the library: the original in its own frame (served from private S3 to a signed-in reader),
// or every page's text, searchable; and the discussion panel with the whole report loaded.
// ?page=N opens the original at that page.
export function ReportView({ slug, title, pages, context, page }: { slug: string; title: string; pages: ReportPage[]; context: string; page?: number }) {
  const { askAbout } = useShellPanel()
  const [view, setView] = React.useState("original")
  const src = `/api/reports/${slug}/pdf${page ? `#page=${page}` : ""}`
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => askAbout({ context: () => context })}
          className="press flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-e1 transition-colors hover:border-pax2-light-blue hover:text-pax2-blue"
        >
          <MessagesSquare className="size-4" style={{ color: "#033882", fill: "#dbe7fa" }} />
          Ask about this report
        </button>
        <a href={`/api/reports/${slug}/pdf?download=1`} className="press flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-e1 transition-colors hover:border-pax2-light-blue hover:text-pax2-blue">
          <Download className="size-4" /> Download
        </a>
      </div>
      <MainBlock
        title={title}
        id="report"
        actions={
          <div className="mr-1 flex items-center rounded-full border border-slate-200 p-0.5 text-xs">
            {["original", "text"].map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={`rounded-full px-3 py-1 font-medium capitalize transition-colors ${view === v ? "bg-pax2-blue text-white" : "text-slate-600 hover:text-pax2-blue"}`}>
                {v}
              </button>
            ))}
          </div>
        }
        search={view === "text" ? "Search the report…" : undefined}
        rows={pages.map((p) => ({ page: p.n, text: p.text }))}
        name={slug}
      >
        {view === "original" ? (
          <iframe key={src} src={src} title={title} className="h-[760px] w-full rounded-lg border border-slate-200 bg-slate-50" />
        ) : (
          <div className="flex flex-col divide-y divide-slate-100">
            {pages.map((p) => (
              <section key={p.n} id={`p-${p.n}`} data-find className="flex flex-col gap-1.5 py-4 first:pt-0">
                <span className="tabular text-xs font-semibold text-slate-400">p. {p.n}</span>
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{p.text}</p>
              </section>
            ))}
          </div>
        )}
      </MainBlock>
    </div>
  )
}
