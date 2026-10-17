"use client"

import * as React from "react"
import Link from "next/link"

import { MessagesSquare, PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { SEQUENCE_MS } from "@/components/flap-hero"
import { useShellPanel } from "@/components/shell"
import StrokeText from "@/components/stroke-text"
import { cn } from "@/ui/lib/utils"
import { whiteButton } from "@/components/white-button"

/** The landing's sticky top bar: transparent over the hero, then white with
 *  the shell's hairline-and-shadow once the feed scrolls beneath it. The feed's
 *  search bar sticks just beneath it. Signed in, there's no hero: the sidebar toggle stands where
 *  PAX was and the discussion where Sign up was, and the bar turns white as soon as the feed moves. */
export function LandingHeader({ signedIn = false }: { signedIn?: boolean }) {
  const [scrolled, setScrolled] = React.useState(false)
  const { sidebarOpen, toggleSidebar, discuss, toggleDiscuss } = useShellPanel()
  const [drawPax, setDrawPax] = React.useState(false)
  React.useEffect(() => {
    // Once the cue has faded in, so PAX is the page's last thing to move.
    const t = window.setTimeout(() => setDrawPax(true), SEQUENCE_MS + 600)
    return () => window.clearTimeout(t)
  }, [])
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
          <button type="button" onClick={toggleSidebar} aria-label="Toggle sidebar" className={whiteButton("circle")}>
            {sidebarOpen ? <PanelLeftClose className="size-4" strokeWidth={2} /> : <PanelLeftOpen className="size-4" strokeWidth={2} />}
          </button>
          <button type="button" onClick={toggleDiscuss} aria-pressed={discuss} aria-label="Open the discussion" className={whiteButton("circle")}>
            <MessagesSquare className="size-4" style={{ color: "#033882", fill: "#dbe7fa" }} />
          </button>
        </>
      ) : (
        <>
          {/* The curtain's PAX in small, the A in red; it opens the sidebar. Its SVG is the font's full line box with the
              capitals centred in it, so centring the box lines PAX up with Sign up. */}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Open the menu"
            className="flex w-14 items-center text-pax2-blue [&_[data-fill-char]:nth-child(2)]:fill-pax2-red [&_[data-stroke-char]:nth-child(2)]:stroke-pax2-red [&_svg]:ml-0"
          >
            {drawPax && (
              <StrokeText
                text="PAX"
                strokeColor="currentColor"
                fillColor="currentColor"
                strokeWidth={1}
                fontSize={28}
                fontFamily="'PAX Curtain', monospace"
                letterSpacing={0}
                drawDuration={0.9}
                fillDelay={0.1}
                stagger={0.08}
              />
            )}
          </button>
          <Link href="/signup" className={whiteButton("md")}>
            Sign up
          </Link>
        </>
      )}
    </header>
  )
}
