"use client"

import * as React from "react"
import Link from "next/link"

import { MessagesSquare, PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { useShellPanel } from "@/components/shell"
import { Wordmark } from "@/components/wordmark"
import { cn } from "@/ui/lib/utils"

/** The landing's sticky top bar: transparent over the hero, then white with
 *  the shell's hairline-and-shadow once the feed scrolls beneath it. The feed's
 *  search bar docks into its empty center. Signed in, there's no hero: the sidebar toggle stands where
 *  the wordmark was and the discussion where Sign up was, and the bar turns white as soon as the feed moves. */
export function LandingHeader({ signedIn = false }: { signedIn?: boolean }) {
  const [scrolled, setScrolled] = React.useState(false)
  const { sidebarOpen, toggleSidebar, discuss, toggleDiscuss } = useShellPanel()
  React.useEffect(() => {
    const on = () => setScrolled(window.scrollY > (signedIn ? 8 : window.innerHeight - 140))
    on()
    window.addEventListener("scroll", on, { passive: true })
    return () => window.removeEventListener("scroll", on)
  }, [signedIn])
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 items-center justify-between border-b px-6 transition-[border-color,box-shadow,background-color] duration-200 md:px-10",
        scrolled ? "border-slate-200/70 bg-white/85 shadow-[0_4px_12px_-8px_rgb(15_23_42/0.25)] backdrop-blur" : "border-transparent",
      )}
    >
      {signedIn ? (
        <>
          <button type="button" onClick={toggleSidebar} aria-label="Toggle sidebar" className="flex size-10 items-center justify-center rounded-full bg-white text-pax2-blue shadow-e1 transition-shadow hover:shadow-e2">
            {sidebarOpen ? <PanelLeftClose className="size-4" strokeWidth={2} /> : <PanelLeftOpen className="size-4" strokeWidth={2} />}
          </button>
          <button type="button" onClick={toggleDiscuss} aria-pressed={discuss} aria-label="Open the discussion" className="flex size-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition-colors hover:bg-slate-50">
            <MessagesSquare className="size-4" style={{ color: "#033882", fill: "#dbe7fa" }} />
          </button>
        </>
      ) : (
        <>
          <Link href="/" aria-label="Home"><Wordmark size={26} /></Link>
          <Link href="/signup" className="press rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-pax2-blue shadow-e1 transition-shadow hover:shadow-e2">
            Sign up
          </Link>
        </>
      )}
    </header>
  )
}
