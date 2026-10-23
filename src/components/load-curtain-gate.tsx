"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"

// The curtain (motion, GSAP) plays only on a load of the front door, so only that load fetches its code.
// The first path is fixed for the session: navigating to / later never mounts it.
const LoadCurtain = dynamic(() => import("@/components/load-curtain").then((m) => m.LoadCurtain))

export function LoadCurtainGate() {
  const front = React.useRef(usePathname() === "/").current
  return front ? <LoadCurtain /> : null
}
