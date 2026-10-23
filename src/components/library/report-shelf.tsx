"use client"

import * as React from "react"
import Link from "next/link"
import { MessagesSquare } from "lucide-react"

import { SearchBar } from "@/components/record/feed"
import { useShellPanel } from "@/components/shell"

// The archive of research documents: every report and poll in the library, searched through every page,
// each opening in the reader or straight into the discussion panel with all its pages loaded.
export type ShelfDoc = { slug: string; title: string; publisher: string | null; date: string | null; summary: string; pages: { n: number; text: string }[]; context: string }

function hits(d: ShelfDoc, needle: string) {
  if (!needle) return []
  const out: { n: number; before: string; word: string; after: string }[] = []
  for (const p of d.pages) {
    const flat = p.text.replace(/\s+/g, " ")
    const at = flat.toLowerCase().indexOf(needle)
    if (at >= 0) out.push({ n: p.n, before: flat.slice(Math.max(0, at - 60), at), word: flat.slice(at, at + needle.length), after: flat.slice(at + needle.length, at + needle.length + 80) })
  }
  return out
}

export function ReportShelf({ docs }: { docs: ShelfDoc[] }) {
  const { askAbout } = useShellPanel()
  const [q, setQ] = React.useState("")
  const needle = q.trim().toLowerCase()
  const shown = docs.map((d) => ({ d, h: hits(d, needle) })).filter(({ d, h }) => !needle || h.length > 0 || `${d.title} ${d.publisher} ${d.summary}`.toLowerCase().includes(needle))
  return (
    <div className="flex flex-col gap-6">
      <div className="mx-auto w-full max-w-2xl">
        <SearchBar q={q} setQ={setQ} aiMode placeholder="Search every page of every report and poll" className="h-14 border-slate-400 shadow-md hover:border-pax2-blue hover:bg-slate-50 focus-within:border-pax2-blue" />
      </div>
      <ul className="flex flex-col divide-y divide-slate-100">
        {shown.map(({ d, h }) => (
          <li key={d.slug} className="flex flex-col gap-2 py-4 first:pt-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <Link href={`/library/${d.slug}`} className="font-semibold text-slate-900 hover:text-pax2-blue">
                  {d.title}
                </Link>
                <span className="text-xs text-slate-500">
                  {[d.publisher, d.date, `${d.pages.length} pages`].filter(Boolean).join(" · ")}
                </span>
              </div>
              <button type="button" onClick={() => askAbout({ context: () => d.context })} className="press flex shrink-0 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-e1 transition-colors hover:border-pax2-light-blue hover:text-pax2-blue">
                <MessagesSquare className="size-3.5" style={{ color: "#033882", fill: "#dbe7fa" }} /> Ask
              </button>
            </div>
            {h.length === 0 ? (
              <p className="text-sm text-slate-600">{d.summary}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {h.slice(0, 4).map((x) => (
                  <li key={x.n}>
                    <Link href={`/library/${d.slug}?page=${x.n}`} className="block rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-50">
                      <span className="tabular mr-2 text-xs font-semibold text-slate-400">p. {x.n}</span>…{x.before}
                      <mark className="rounded bg-pax2-lavender/70 px-0.5 text-slate-900">{x.word}</mark>
                      {x.after}…
                    </Link>
                  </li>
                ))}
                {h.length > 4 && <li className="px-2 text-xs text-slate-400">and {h.length - 4} more pages</li>}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {!shown.length && <p className="py-8 text-center text-slate-500">Nothing in the archive matches.</p>}
    </div>
  )
}
