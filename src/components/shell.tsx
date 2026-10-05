"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookA, ChartColumn, Clapperboard, FlaskConical, Hammer, Home, LayoutDashboard, Library, NotebookPen, PanelLeftClose, PanelLeftOpen, Plus, PlaySquare, Target, Workflow } from "lucide-react"

import { Wordmark } from "@/components/wordmark"
import { cn } from "@/ui/lib/utils"

// The partner's jobs first; the workings of the score and the build underneath.
const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/videos", label: "Videos", icon: PlaySquare },
  { href: "/scripts", label: "Scripts", icon: NotebookPen },
  { href: "/polling", label: "Polling", icon: ChartColumn },
  { href: "/evals", label: "Evals", icon: Target },
  { href: "/campaigns", label: "Campaigns", icon: Clapperboard },
]
const MORE = [
  { href: "/scoring", label: "Scoring", icon: FlaskConical },
  { href: "/glossary", label: "Glossary", icon: BookA },
  { href: "/library", label: "Library", icon: Library },
  { href: "/pipeline", label: "Pipeline", icon: Workflow },
  { href: "/build", label: "Build", icon: Hammer },
]

const PanelCtx = React.createContext<(open: boolean) => void>(() => {})
export const useSetPanelOpen = () => React.useContext(PanelCtx)

const PANEL_W = "md:w-[clamp(560px,52vw,960px)]"

export function Shell({ children, drawer }: { children: React.ReactNode; drawer: React.ReactNode }) {
  const path = usePathname()
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  const [panelOpen, setPanelOpen] = React.useState(false)
  const active = (href: string) => (href === "/" ? path === "/" : href === "/videos" ? path.startsWith("/videos") || path.startsWith("/v/") : path.startsWith(href))
  // The volunteer's recording flow is its own front door, without the partner's sidebar.
  if (path.startsWith("/record")) return <div className="min-h-dvh bg-pax-mist">{children}</div>
  const item = (href: string, label: string, Icon: typeof Home, small = false) => (
    <Link
      key={href}
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-full px-3.5 outline-none transition-[color,background-color,box-shadow]",
        small ? "py-1.5 text-[13px]" : "py-2.5 text-sm",
        active(href) ? "bg-white font-semibold text-pax-ink shadow-e1" : "text-slate-500 hover:bg-white/70 hover:text-pax-ink hover:shadow-e1",
      )}
    >
      <Icon className={small ? "size-3.5" : "size-[18px]"} strokeWidth={active(href) ? 2.25 : 1.75} />
      {label}
    </Link>
  )
  return (
    <PanelCtx.Provider value={setPanelOpen}>
      <div className="flex min-h-dvh md:h-dvh md:overflow-hidden md:bg-slate-200/60 md:p-[18px]">
        <div className={cn("hidden shrink-0 overflow-hidden transition-[width,margin] duration-300 ease-in-out md:block", sidebarOpen ? "md:mr-[18px] md:w-60" : "md:w-0")}>
          <div className="flex h-full w-60 flex-col gap-6 px-4 py-6">
            <Link href="/" className="flex items-center px-3.5" aria-label="Home">
              <Wordmark size={24} />
            </Link>
            <Link href="/record" className="press flex items-center justify-center gap-2 rounded-full bg-pax-ink px-4 py-3 text-sm font-semibold text-white shadow-e2 transition-shadow hover:shadow-e3">
              <Plus className="size-4" strokeWidth={2.5} /> Record a video
            </Link>
            <nav className="flex flex-col gap-1">{NAV.map((n) => item(n.href, n.label, n.icon))}</nav>
            <nav className="mt-auto flex flex-col gap-0.5 border-t border-slate-200/70 pt-4">{MORE.map((n) => item(n.href, n.label, n.icon, true))}</nav>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col md:overflow-hidden md:rounded-2xl md:border md:border-slate-200/80 md:bg-pax-mist md:shadow-e2">
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-white/90 px-4 py-2.5 backdrop-blur md:hidden">
            <Link href="/" aria-label="Home"><Wordmark size={18} /></Link>
            <nav className="no-scrollbar flex flex-1 gap-1 overflow-x-auto">
              {NAV.map(({ href, label }) => (
                <Link key={href} href={href} className={cn("whitespace-nowrap rounded-full px-3 py-1 text-xs", active(href) ? "bg-pax-lavender font-semibold text-pax-ink" : "text-slate-500")}>
                  {label}
                </Link>
              ))}
            </nav>
            <Link href="/record" className="flex shrink-0 items-center gap-1 rounded-full bg-pax-ink px-3 py-1.5 text-xs font-semibold text-white">
              <Plus className="size-3.5" /> Record
            </Link>
          </header>
          <div className="hidden shrink-0 items-center gap-3 px-5 py-4 md:flex">
            <button type="button" onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle sidebar" className="flex size-10 items-center justify-center rounded-full bg-white text-pax-ink shadow-e1 transition-shadow hover:shadow-e2">
              {sidebarOpen ? <PanelLeftClose className="size-4" strokeWidth={2} /> : <PanelLeftOpen className="size-4" strokeWidth={2} />}
            </button>
            {!sidebarOpen && <Link href="/" aria-label="Home"><Wordmark size={20} /></Link>}
            <div className="flex-1" />
            {!sidebarOpen && (
              <Link href="/record" className="press flex items-center gap-1.5 rounded-full bg-pax-ink px-4 py-2 text-sm font-semibold text-white shadow-e2 transition-shadow hover:shadow-e3">
                <Plus className="size-4" strokeWidth={2.5} /> Record a video
              </Link>
            )}
          </div>
          <main className="flex-1 md:overflow-y-auto">
            <div className="w-full max-w-[1200px] px-5 py-6 md:px-10 md:py-9">{children}</div>
          </main>
        </div>
        <div className={cn("w-0 shrink-0 overflow-hidden transition-[width,margin] duration-300 ease-in-out", panelOpen && cn("md:ml-[18px]", PANEL_W))}>
          <div className={cn("h-full", PANEL_W)}>{drawer}</div>
        </div>
      </div>
    </PanelCtx.Provider>
  )
}
