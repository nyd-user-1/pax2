"use client"

import { usePathname } from "next/navigation"

/** The landing's own chrome — its header, the hero, the back-to-top button — shows only on the
 *  landing itself. When a video's drawer opens over the feed, the feed stands alone in the shell. */
export function LandingOnly({ children }: { children: React.ReactNode }) {
  return usePathname() === "/" ? children : null
}
