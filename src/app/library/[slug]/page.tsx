import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Check, Download, ExternalLink, Minus } from "lucide-react"

import { bytes, count, datasetBySlug } from "@/lib/library"
import { kindStyle, tagStyle } from "@/lib/swatches"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const d = datasetBySlug((await params).slug)
  return { title: d?.title ?? "Library" }
}

export default async function DatasetPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ t?: string }> }) {
  const d = datasetBySlug((await params).slug)
  if (!d) notFound()
  const { t } = await searchParams
  const tables = d.tables.filter((x) => !x.error)
  const table = tables.find((x) => x.name === t) ?? tables[0]
  const cols = table ? Object.keys(table.sample[0] ?? {}) : []
  return (
    <div className="flex flex-col gap-8">
      <Link href="/library" className="inline-flex w-fit items-center gap-1.5 text-sm text-slate-500 hover:text-pax-ink">
        <ArrowLeft className="size-4" /> Library
      </Link>

      <header className="rise flex flex-wrap items-start justify-between gap-6">
        <div className="flex max-w-3xl flex-col gap-2">
          <span className="w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={kindStyle(d.kind)}>{d.kind}</span>
          <h1 className="font-display text-3xl text-slate-900 md:text-[34px]">{d.title}</h1>
          <p className="text-slate-500">{d.publisher}</p>
          <p className="text-lg leading-relaxed text-slate-700">{d.summary}</p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {d.tags.map((x) => (
              <span key={x} className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={tagStyle(x)}>
                {x}
              </span>
            ))}
          </div>
        </div>
        <div className="surface flex min-w-60 flex-col gap-3 p-5 text-sm">
          {d.rows > 0 && <Fact label="Rows previewed" value={count(d.rows)} />}
          {d.fileCount > 0 && <Fact label="Files" value={`${d.fileCount} · ${bytes(d.bytes)}`} />}
          <Fact label="License" value={d.license} />
          {d.link && (
            <a href={d.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-pax-plum hover:underline">
              Original source <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="surface flex flex-col gap-2 p-5">
          <p className="font-semibold text-slate-900">What it can tell you</p>
          {d.can.map((x) => (
            <p key={x} className="flex gap-2 text-sm text-slate-600">
              <Check className="mt-0.5 size-4 shrink-0 text-above" /> {x}
            </p>
          ))}
        </div>
        <div className="surface flex flex-col gap-2 p-5">
          <p className="font-semibold text-slate-900">What it can&apos;t</p>
          {d.cannot.length ? (
            d.cannot.map((x) => (
              <p key={x} className="flex gap-2 text-sm text-slate-600">
                <Minus className="mt-0.5 size-4 shrink-0 text-below" /> {x}
              </p>
            ))
          ) : (
            <p className="text-sm text-slate-400">Nothing noted.</p>
          )}
        </div>
      </section>

      {table && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-2 font-display text-xl text-slate-900">Preview</h2>
            {tables.map((x) => (
              <Link key={x.name} href={`/library/${d.slug}?t=${x.name}`} scroll={false} className={x.name === table.name ? "rounded-full bg-pax-ink px-3 py-1 text-xs font-medium text-white" : "rounded-full bg-white px-3 py-1 text-xs text-slate-600 shadow-e1 hover:text-pax-ink"}>
                {x.name} · {count(x.rows)}
              </Link>
            ))}
          </div>
          <div className="surface overflow-x-auto">
            <table className="tabular w-full text-xs">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  {cols.map((c) => (
                    <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.sample.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {cols.map((c) => (
                      <td key={c} className="max-w-56 truncate whitespace-nowrap px-3 py-2 text-slate-700">
                        {r[c] == null ? <span className="text-slate-300">—</span> : String(r[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="surface">
            <summary className="cursor-pointer list-none px-5 py-3 text-sm font-semibold text-slate-900">
              Schema · {table.columnCount} columns
            </summary>
            <div className="grid gap-x-6 px-5 pb-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
              {table.columns.map((c) => (
                <div key={c.name} className="flex justify-between border-b border-slate-100 py-1.5">
                  <span className="truncate text-slate-700">{c.name}</span>
                  <span className="text-slate-400">{c.type}</span>
                </div>
              ))}
            </div>
          </details>
        </section>
      )}

      {(d.files.length > 0 || d.local) && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl text-slate-900">Files</h2>
          <div className="surface divide-y divide-slate-100">
            {d.local && (
              <a href={`/api/library/file?local=${encodeURIComponent(d.local)}`} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-slate-50">
                <span className="font-mono text-xs text-slate-700">{d.local.split("/").pop()}</span>
                <Download className="size-4 text-slate-400" />
              </a>
            )}
            {d.files.slice(0, 15).map((f) => (
              <a key={f.key} href={`/api/library/file?key=${encodeURIComponent(f.key)}`} className="flex items-center justify-between gap-4 px-5 py-3 text-sm hover:bg-slate-50">
                <span className="truncate font-mono text-xs text-slate-700">{f.key.split("/").slice(-2).join("/")}</span>
                <span className="flex shrink-0 items-center gap-3 text-xs text-slate-400">
                  {bytes(f.bytes)} <Download className="size-4" />
                </span>
              </a>
            ))}
            {d.fileCount > 15 && <p className="px-5 py-3 text-xs text-slate-400">and {d.fileCount - 15} more</p>}
          </div>
        </section>
      )}

      {(d.usedIn.length > 0 || d.cite) && (
        <section className="grid gap-4 md:grid-cols-2">
          {d.usedIn.length > 0 && (
            <div className="surface flex flex-col gap-2 p-5">
              <p className="font-semibold text-slate-900">Used in PAX</p>
              {d.usedIn.map((u) => (
                <Link key={u.href + u.label} href={u.href} className="text-sm font-medium text-pax-plum hover:underline">
                  {u.label} →
                </Link>
              ))}
            </div>
          )}
          {d.cite && (
            <div className="surface flex flex-col gap-2 p-5">
              <p className="font-semibold text-slate-900">Cite</p>
              <p className="text-sm leading-relaxed text-slate-600">{d.cite}</p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  )
}
