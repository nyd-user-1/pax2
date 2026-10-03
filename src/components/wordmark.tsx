import { cn } from "@/ui/lib/utils"

/** The parallax wordmark: the double l drawn as two bars, blue and red. */
export function Wordmark({ className, size = 22 }: { className?: string; size?: number }) {
  const bar = { width: Math.max(2, Math.round(size * 0.11)), height: Math.round(size * 1.05) }
  return (
    <span className={cn("inline-flex items-baseline font-semibold tracking-[-0.03em] text-slate-900", className)} style={{ fontSize: size, lineHeight: 1 }} aria-label="parallax">
      <span aria-hidden>para</span>
      <span aria-hidden className="mx-[0.06em] inline-flex gap-[0.07em] self-end" style={{ transform: `translateY(${Math.round(size * 0.04)}px)` }}>
        <span className="rounded-[1px] bg-pax-plum" style={bar} />
        <span className="rounded-[1px] bg-pax-red" style={bar} />
      </span>
      <span aria-hidden>ax</span>
    </span>
  )
}
