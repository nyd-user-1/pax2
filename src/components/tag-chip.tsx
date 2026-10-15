import Link from "next/link"

import { tagHref } from "@/lib/tags"
import { cn } from "@/ui/lib/utils"

/** A tag as a chip: a hairline border, grey on hover, and a click goes to the tag's section on /tags. */
export function TagChip({ tag, active = false }: { tag: string; active?: boolean }) {
  return (
    <Link
      href={tagHref(tag)}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
        active ? "border-pax2-ink bg-pax2-ink text-white hover:bg-pax2-ink/90" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100",
      )}
    >
      {tag}
    </Link>
  )
}
