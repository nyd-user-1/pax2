import { HOME_BLOCK } from "@/app/_home/height"
import { TableBlock } from "@/components/blocks"
import { GLOSSARY } from "@/lib/glossary"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/components/nova/table"

export const metadata = { title: "Glossary" }

/** A to Z by the term's full name, letters only: "e² (end to end)" files under E. */
const SORTED = [...GLOSSARY].sort((a, b) => a.full.replace(/[^\p{L}\p{N} ]/gu, "").localeCompare(b.full.replace(/[^\p{L}\p{N} ]/gu, ""), "en", { sensitivity: "base" }))

export default function GlossaryPage() {
  return (
    <TableBlock title="Glossary" search="Search terms…" rows={SORTED.map((t) => ({ term: t.full, definition: t.definition, section: t.group }))} name="glossary" height={HOME_BLOCK}>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="bg-muted/60">
            <TableHead className="w-[26%]">Term</TableHead>
            <TableHead className="w-[60%]">Definition</TableHead>
            <TableHead className="w-[14%]">Section</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {SORTED.map((t) => (
            <TableRow key={t.id} id={t.id} className="scroll-mt-24 target:bg-pax2-lavender/50">
              <TableCell className="align-top whitespace-normal">
                <p className="font-semibold text-slate-900">{t.full}</p>
                {t.short !== t.full && <p className="text-xs text-slate-400">Shown as “{t.short}”</p>}
              </TableCell>
              <TableCell className="align-top text-sm leading-relaxed whitespace-normal text-slate-600">{t.definition}</TableCell>
              <TableCell className="align-top text-slate-800">{t.group}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableBlock>
  )
}
