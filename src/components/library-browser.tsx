"use client"

import * as React from "react"
import Link from "next/link"
import { Search } from "lucide-react"

import { kindStyle, tagStyle } from "@/lib/swatches"
import { cn } from "@/ui/lib/utils"

export type Card = { slug: string; title: string; publisher: string; summary: string; kind: string; tags: string[]; license: string; size: string; rows: string | null; used: number; href?: string; pages?: { n: number; text: string }[] }

/** A report's first page holding the search words, with the words in their sentence. */
function hit(c: Card, needle: string) {
  if (!needle || !c.pages) return null
  for (const p of c.pages) {
    const flat = p.text.replace(/\s+/g, " ")
    const at = flat.toLowerCase().indexOf(needle)
    if (at >= 0) return { n: p.n, before: flat.slice(Math.max(0, at - 70), at), word: flat.slice(at, at + needle.length), after: flat.slice(at + needle.length, at + needle.length + 90) }
  }
  return null
}

/** The library, searchable and filterable in place. */
export function LibraryBrowser({ cards }: { cards: Card[] }) {
  const [q, setQ] = React.useState("")
  const [kind, setKind] = React.useState<string | null>(null)
  const kinds = [...new Set(cards.map((c) => c.kind))]
  const needle = q.trim().toLowerCase()
  const shown = cards.filter((c) => (!kind || c.kind === kind) && (!needle || [c.title, c.summary, c.publisher, ...c.tags].join(" ").toLowerCase().includes(needle) || !!hit(c, needle)))
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <label className="surface flex flex-1 items-center gap-2 px-4 py-3 focus-within:ring-2 focus-within:ring-pax2-light-blue/40">
          <Search className="size-4 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search datasets and reports: persuasion, hooks, Massachusetts, shorts…" className="flex-1 bg-transparent text-sm outline-none" />
        </label>
        <div className="flex flex-wrap gap-2">
          {[null, ...kinds].map((k) => (
            <button key={k ?? "all"} type="button" onClick={() => setKind(k)} style={k && kind === k ? kindStyle(k) : undefined} className={cn("rounded-full px-3.5 py-1.5 text-sm transition-colors", kind === k ? (k ? "font-medium shadow-e1" : "bg-pax2-blue font-medium text-white") : "bg-white text-slate-600 shadow-e1 hover:text-pax2-blue")}>
              {k ?? "All"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((c, i) => {
          const h = hit(c, needle)
          return (
          <Link key={c.slug} href={h ? `/library/${c.slug}?page=${h.n}` : (c.href ?? `/library/${c.slug}`)} className="surface lift rise flex flex-col gap-3 p-5" style={{ ["--i" as string]: i }}>
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={kindStyle(c.kind)}>{c.kind}</span>
            </div>
            <div>
              <p className="font-semibold leading-snug text-slate-900">{c.title}</p>
              <p className="text-xs text-slate-500">{c.publisher}</p>
            </div>
            {h ? (
              <p className="line-clamp-4 flex-1 text-sm leading-relaxed text-slate-600">
                <span className="tabular mr-1.5 text-xs font-semibold text-slate-400">p. {h.n}</span>
                …{h.before}
                <mark className="rounded bg-pax2-lavender/70 px-0.5 text-slate-900">{h.word}</mark>
                {h.after}…
              </p>
            ) : (
              <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-slate-600">{c.summary}</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {c.tags.slice(0, 4).map((t) => (
                <span key={t} className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={tagStyle(t)}>
                  {t}
                </span>
              ))}
            </div>
            <div className="tabular flex items-center gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
              {c.rows && <span>{c.rows} rows</span>}
              {c.size && <span>{c.size}</span>}
              {c.used > 0 && <span className="ml-auto font-medium text-pax2-light-blue">Used in PAX2</span>}
            </div>
          </Link>
          )
        })}
      </div>
      {!shown.length && <p className="py-12 text-center text-slate-500">Nothing matches.</p>}
    </div>
  )
}
