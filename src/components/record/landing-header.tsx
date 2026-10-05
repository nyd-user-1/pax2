"use client"

import * as React from "react"
import Link from "next/link"

import { Wordmark } from "@/components/wordmark"
import { cn } from "@/ui/lib/utils"

/** The landing's sticky top bar: transparent over the hero, then white with
 *  the shell's hairline-and-shadow once the feed scrolls beneath it. The feed's
 *  search bar docks into its empty center. */
export function LandingHeader() {
  const [scrolled, setScrolled] = React.useState(false)
  React.useEffect(() => {
    const on = () => setScrolled(window.scrollY > window.innerHeight - 140)
    on()
    window.addEventListener("scroll", on, { passive: true })
    return () => window.removeEventListener("scroll", on)
  }, [])
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 items-center justify-between border-b px-6 transition-[border-color,box-shadow,background-color] duration-200 md:px-10",
        scrolled ? "border-slate-200/70 bg-white/85 shadow-[0_4px_12px_-8px_rgb(15_23_42/0.25)] backdrop-blur" : "border-transparent",
      )}
    >
      <Link href="/" aria-label="Home"><Wordmark size={26} /></Link>
      <Link href="/signup" className="press rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-pax-ink shadow-e1 transition-shadow hover:shadow-e2">
        Sign up
      </Link>
    </header>
  )
}
