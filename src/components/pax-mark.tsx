import { cn } from "@/ui/lib/utils"

/** The PAX mark, static: the curtain's letters without the draw — P and X in navy, the A in red.
 *  The "PAX Curtain" face is global via load-curtain.css. */
export function PaxMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <span aria-label="PAX" className={cn("inline-flex items-center font-bold leading-none text-pax2-blue", className)} style={{ fontFamily: "'PAX Curtain', monospace", fontSize: size }}>
      <span aria-hidden>P</span>
      <span aria-hidden className="text-pax2-red">A</span>
      <span aria-hidden>X</span>
    </span>
  )
}
