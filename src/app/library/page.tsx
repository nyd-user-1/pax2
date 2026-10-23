import { LibraryBrowser } from "@/components/library-browser"
import { bytes, count, DATASETS } from "@/lib/library"
import { REPORTS, reportAbout } from "@/lib/reports"

// The working documents, served as static pages under /sketches.
const SKETCHES = [
  { slug: "sk-accounting", title: "Accounting", summary: "Every catalog short against what the pipeline holds, the model ledger, and the Lab flow.", href: "/sketches/ACCOUNTING.html", tags: ["accounting", "models", "flow"] },
  { slug: "sk-roadmap", title: "Roadmap", summary: "The question bank and the fetch, question, policy and surfaces roadmap.", href: "/sketches/roadmap-1.html", tags: ["roadmap"] },
  { slug: "sk-resonance-compare", title: "Resonance comparison", summary: "Scored paid takes and top catalog videos under the proposed Resonance definitions.", href: "/sketches/RESONANCE-COMPARE.html", tags: ["resonance"] },
  { slug: "sk-home", title: "Home docs", summary: "The nine-tab working record: analytics, data, house, partner CSV, proposals and kin.", href: "/sketches/HOME.html", tags: ["record"] },
  { slug: "sk-ui", title: "UI sketches", summary: "The take read and the pair pick, drawn before building.", href: "/sketches/UI-SKETCHES.html", tags: ["ui"] },
].map((s) => ({ ...s, publisher: "PAX", kind: "Sketch", license: "", size: "", rows: null, used: 0 }))

export const metadata = { title: "Library" }

export default function LibraryPage() {
  return (
    <div className="flex flex-col gap-8">
      <LibraryBrowser
        cards={[
          ...REPORTS.map((r) => ({ slug: r.slug, title: r.title, publisher: r.publisher ?? "", summary: reportAbout(r.slug).summary, kind: "Report", tags: reportAbout(r.slug).tags, license: "", size: `${r.pages.length} pages`, rows: null, used: 0, pages: r.pages.map((p) => ({ n: p.n, text: p.text })) })),
          ...DATASETS.map((d) => ({ slug: d.slug, title: d.title, publisher: d.publisher, summary: d.summary, kind: d.kind, tags: d.tags, license: d.license, size: d.bytes ? bytes(d.bytes) : "", rows: d.rows ? count(d.rows) : null, used: d.usedIn.length })),
          ...SKETCHES,
        ]}
      />
    </div>
  )
}
