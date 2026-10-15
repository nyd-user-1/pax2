import { TableBlock } from "@/components/blocks"
import { GLOSSARY } from "@/lib/glossary"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/components/nova/table"

export const metadata = { title: "Glossary" }

export default function GlossaryPage() {
  return (
    <TableBlock title="Glossary" search="Search terms…" rows={GLOSSARY.map((t) => ({ term: t.full, definition: t.definition, section: t.group }))} name="glossary">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="bg-muted/60">
            <TableHead className="w-[26%]">Term</TableHead>
            <TableHead className="w-[60%]">Definition</TableHead>
            <TableHead className="w-[14%]">Section</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {GLOSSARY.map((t) => (
            <TableRow key={t.id} id={t.id} className="scroll-mt-24 target:bg-hermes-lavender/50">
              <TableCell className="align-top whitespace-normal">
                <p className="font-semibold text-slate-900">{t.full}</p>
                {t.short !== t.full && <p className="text-xs text-slate-400">Shown as “{t.short}”</p>}
              </TableCell>
              <TableCell className="align-top text-sm leading-relaxed whitespace-normal text-slate-600">{t.definition}</TableCell>
              <TableCell className="align-top text-muted-foreground">{t.group}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableBlock>
  )
}
