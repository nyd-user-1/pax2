"use client"

import * as React from "react"
import Link from "next/link"

import { MessagesSquare, PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { CURTAIN } from "@/components/flap-hero"
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
  // As the curtain clears and the board begins: the header's two white buttons dissolve into place,
  // then PAX draws itself on the first, as on a canvas.
  const [arrived, setArrived] = React.useState(false)
  const [drawPax, setDrawPax] = React.useState(false)
  React.useEffect(() => {
    const timers = [window.setTimeout(() => setArrived(true), CURTAIN), window.setTimeout(() => setDrawPax(true), CURTAIN + 450)]
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [])
  /** The dissolve both buttons arrive with: up from a faint blur and a touch small. */
  const arrive = cn("transition-[opacity,filter,scale,color,background-color,border-color] duration-500 ease-out", arrived ? "scale-100 opacity-100 blur-0" : "scale-95 opacity-0 blur-sm")
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
          {/* The curtain's PAX in small, the A in red, drawn on a white button the height of Sign up; it
              opens the sidebar. Its SVG is the font's full line box with the capitals centred in it. */}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Open the menu"
            className={whiteButton("md", "h-[42px] px-4 py-0 [&_[data-fill-char]:nth-child(2)]:fill-pax2-red [&_[data-stroke-char]:nth-child(2)]:stroke-pax2-red [&_svg]:ml-0", arrive)}
          >
            <span className="flex h-full w-14 items-center text-pax2-blue">
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
            </span>
          </button>
          <Link href="/signup" className={whiteButton("md", arrive)}>
            Sign up
          </Link>
        </>
      )}
    </header>
  )
}
