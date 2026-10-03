import { LibraryBrowser } from "@/components/library-browser"
import { bytes, count, DATASETS } from "@/lib/library"

export const metadata = { title: "Library" }

export default function LibraryPage() {
  const rows = DATASETS.reduce((s, d) => s + d.rows, 0)
  return (
    <div className="flex flex-col gap-8">
      <header className="rise flex flex-col gap-2">
        <h1 className="font-display text-3xl text-slate-900 md:text-[34px]">Library</h1>
        <p className="max-w-2xl text-slate-500">
          The evidence behind every score and reading: persuasion experiments, ad libraries, campaign video and election data, each with a preview, its schema and its files. {DATASETS.length} datasets · {count(rows)} rows previewed · {bytes(DATASETS.reduce((s, d) => s + d.bytes, 0))}
        </p>
      </header>
      <LibraryBrowser
        cards={DATASETS.map((d) => ({ slug: d.slug, title: d.title, publisher: d.publisher, summary: d.summary, kind: d.kind, tags: d.tags, license: d.license, size: d.bytes ? bytes(d.bytes) : "", rows: d.rows ? count(d.rows) : null, used: d.usedIn.length }))}
      />
    </div>
  )
}
