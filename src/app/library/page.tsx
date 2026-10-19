import { LibraryBrowser } from "@/components/library-browser"
import { bytes, count, DATASETS } from "@/lib/library"

export const metadata = { title: "Library" }

export default function LibraryPage() {
  return (
    <div className="flex flex-col gap-8">
      <LibraryBrowser
        cards={DATASETS.map((d) => ({ slug: d.slug, title: d.title, publisher: d.publisher, summary: d.summary, kind: d.kind, tags: d.tags, license: d.license, size: d.bytes ? bytes(d.bytes) : "", rows: d.rows ? count(d.rows) : null, used: d.usedIn.length }))}
      />
    </div>
  )
}
