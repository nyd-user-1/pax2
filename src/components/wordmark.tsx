import { cn } from "@/ui/lib/utils"

/** The pax wordmark: "pa" in ink, the x drawn as a glyph — two crossing strokes in the
 *  parallax red and blue, cut to the font's stem weight, seated on the baseline, riding
 *  just past x-height so it stands out by color more than size. */
export function Wordmark({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <span aria-label="pax" className={cn("inline-flex items-baseline font-semibold tracking-[-0.03em] text-slate-900", className)} style={{ fontSize: size, lineHeight: 1 }}>
      <span aria-hidden>pa</span>
      <svg aria-hidden viewBox="0 0 100 100" className="ml-[0.03em]" style={{ width: "0.7em", height: "0.7em", overflow: "visible" }}>
        <line x1="10" y1="10" x2="90" y2="90" stroke="var(--pax2-plum)" strokeWidth="17" />
        <line x1="10" y1="90" x2="90" y2="10" stroke="var(--pax2-red)" strokeWidth="17" />
      </svg>
    </span>
  )
}
