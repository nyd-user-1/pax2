import { cn } from "@/ui/lib/utils"

/** The pax wordmark: "pa" in ink, the x drawn as two crossing strokes — red, then blue. */
export function Wordmark({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <span aria-label="pax" className={cn("inline-flex items-baseline font-semibold tracking-[-0.03em] text-slate-900", className)} style={{ fontSize: size, lineHeight: 1 }}>
      <span aria-hidden>pa</span>
      <svg aria-hidden viewBox="0 0 10 10" style={{ width: "0.52em", height: "0.52em", marginLeft: "0.04em" }}>
        <line x1="1.2" y1="1.2" x2="8.8" y2="8.8" stroke="var(--pax2-red)" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="8.8" y1="1.2" x2="1.2" y2="8.8" stroke="var(--pax2-plum)" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  )
}
