import { cn } from "@/ui/lib/utils"

/** The pax wordmark: "pa" in ink, the x two crossing bars in the parallax red and blue,
 *  built like the old double-l bars and a touch larger than the letters. */
export function Wordmark({ className, size = 22 }: { className?: string; size?: number }) {
  const bar = { width: Math.max(2, Math.round(size * 0.115)), height: Math.round(size * 0.72) }
  const box = Math.round(size * 0.62)
  return (
    <span aria-label="pax" className={cn("inline-flex items-baseline font-semibold tracking-[-0.03em] text-slate-900", className)} style={{ fontSize: size, lineHeight: 1 }}>
      <span aria-hidden>pa</span>
      <span aria-hidden className="ml-[0.05em] inline-grid place-items-center" style={{ width: box, height: box, transform: `translateY(${Math.round(size * 0.04)}px)` }}>
        <span className="rounded-[1px] bg-pax2-red [grid-area:1/1]" style={{ ...bar, transform: "rotate(45deg)" }} />
        <span className="rounded-[1px] bg-pax2-plum [grid-area:1/1]" style={{ ...bar, transform: "rotate(-45deg)" }} />
      </span>
    </span>
  )
}
