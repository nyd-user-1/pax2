import meta from "../../data/library-meta.json"
import catalog from "../../data/generated/library.json"

export type Table = { key: string; name: string; rows: number; columns: { name: string; type: string }[]; columnCount: number; sample: Record<string, unknown>[]; error?: string }
export type Dataset = {
  slug: string
  title: string
  publisher: string
  summary: string
  kind: string
  tags: string[]
  license: string
  link?: string
  cite?: string
  local?: string
  can: string[]
  cannot: string[]
  usedIn: { label: string; href: string }[]
  files: { key: string; bytes: number }[]
  fileCount: number
  bytes: number
  tables: Table[]
  rows: number
}

const C = catalog as unknown as Record<string, { files: { key: string; bytes: number }[]; fileCount: number; bytes: number; tables: Table[] }>

export const DATASETS: Dataset[] = (meta as Omit<Dataset, "files" | "fileCount" | "bytes" | "tables" | "rows">[]).map((m) => {
  const c = C[m.slug] ?? { files: [], fileCount: 0, bytes: 0, tables: [] }
  return { ...m, ...c, rows: c.tables.reduce((s, t) => s + (t.rows ?? 0), 0) }
})

export const datasetBySlug = (slug: string) => DATASETS.find((d) => d.slug === slug)

export const bytes = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n >= 1e3 ? `${Math.round(n / 1e3)} KB` : `${n} B`)
export const count = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${n}`)
