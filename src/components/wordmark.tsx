import { cn } from "@/ui/lib/utils"

/** The pax mark: the x alone — two crossing strokes in the parallax red and blue. */
export function Wordmark({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <span aria-label="pax" className={cn("inline-flex items-center", className)} style={{ fontSize: size, lineHeight: 1 }}>
      <svg aria-hidden viewBox="0 0 100 100" style={{ width: "1.26em", height: "1.26em", overflow: "visible" }}>
        <line x1="10" y1="10" x2="90" y2="90" stroke="var(--pax2-plum)" strokeWidth="17" />
        <line x1="10" y1="90" x2="90" y2="10" stroke="var(--pax2-red)" strokeWidth="17" />
      </svg>
    </span>
  )
}
