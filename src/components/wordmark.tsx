import TechText from "@/components/tech-text"

import { cn } from "@/ui/lib/utils"

/** The pax wordmark: React Bits TechText — dashed guides sketch each letter in, in the ink of wherever it sits. */
export function Wordmark({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <span className={cn("inline-block align-middle text-slate-900", className)} style={{ width: Math.round(size * 2.6), height: Math.round(size * 1.6) }}>
      <TechText
        text="pax"
        fontWeight={600}
        fontSize={size}
        reveal="letter"
        dashLength={4}
        dashGap={2}
        specks={15}
        intro="none"
        introDuration={2}
        clickKick
        guides={false}
      />
    </span>
  )
}
