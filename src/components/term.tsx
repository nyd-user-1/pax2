import Link from "next/link"
import { Info } from "lucide-react"

import { termById } from "@/lib/glossary"
import { cn } from "@/ui/lib/utils"

/** A short metric label with a small info icon that opens its full name and definition. */
export function Term({ id, className, children, label = true }: { id: string; className?: string; children?: React.ReactNode; label?: boolean }) {
  const t = termById(id)
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap", className)}>
      {label && (children ?? t?.short ?? id)}
      <Link href={`/glossary#${id}`} title={t ? `${t.full}: ${t.definition}` : undefined} className="inline-flex size-3.5 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-pax2-light-blue" aria-label={`What ${t?.full ?? id} means`}>
        <Info className="size-3" />
      </Link>
    </span>
  )
}
