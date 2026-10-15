import { cn } from "@/ui/lib/utils"

/** The pax wordmark. */
export function Wordmark({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <span className={cn("inline-flex items-baseline font-semibold tracking-[-0.03em] text-slate-900", className)} style={{ fontSize: size, lineHeight: 1 }}>
      pax
    </span>
  )
}
