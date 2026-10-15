import TechText from "@/components/tech-text"

import { cn } from "@/ui/lib/utils"

/** The pax wordmark: React Bits TechText, blue letters with red accents, sized for the
 *  header corner (105x56 at the landing's size and scaling with the slot elsewhere). */
export function Wordmark({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <span className={cn("inline-block align-middle text-pax2-ink", className)} style={{ width: Math.round(size * 4.04), height: Math.round(size * 2.15) }}>
      <TechText
        text="pax"
        fontWeight={600}
        fontSize={150}
        reveal="letter"
        dashLength={4}
        dashGap={2}
        specks={15}
        intro="none"
        introDuration={2}
        clickKick
        guides={false}
        sweep={false}
        accentColor="#d20526"
        color="currentColor"
      />
    </span>
  )
}
