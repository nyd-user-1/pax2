"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { BookA, ChartColumn, ChevronDown, ChevronRight, ChevronsUpDown, Clapperboard, FlaskConical, Gauge, Hammer, LayoutDashboard, Library, NotebookPen, PlaySquare, Target, Video, Workflow } from "lucide-react"

import { Wordmark } from "@/components/wordmark"
import { cn } from "@/ui/lib/utils"

// The partner's jobs first; the workings of the score and the build underneath.
const NAV = [
  { href: "/scored", label: "Scored", icon: Gauge },
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

// The header names the page; /v/ belongs to Videos.
const TITLES: [string, string][] = [
  ["/scored", "Scored"],
  ["/dashboard", "Dashboard"],
  ["/videos", "Videos"],
  ["/v/", "Videos"],
  ["/scripts", "Scripts"],
  ["/polling", "Polling"],
  ["/evals", "Evals"],
  ["/campaigns", "Campaigns"],
  ["/scoring", "Scoring"],
  ["/glossary", "Glossary"],
  ["/library", "Library"],
  ["/pipeline", "Pipeline"],
  ["/build", "Build"],
  ["/break-out", "Breakout"],
  ["/feature-lift", "Feature lift"],
  ["/velocity-tracker", "Velocity"],
  ["/endgame", "Endgame"],
  ["/ml", "ML"],
]

const PANEL_THIRD = "md:w-[clamp(420px,34vw,620px)]"
const PANEL_HALF = "md:w-[50vw]"
const MORE_KEY = "pax-nav-more"

type PanelState = { setOpen: (open: boolean) => void; wide: boolean; setWide: (wide: boolean) => void }
const PanelCtx = React.createContext<PanelState>({ setOpen: () => {}, wide: false, setWide: () => {} })
export const useShellPanel = () => React.useContext(PanelCtx)

export function Shell({ children, drawer }: { children: React.ReactNode; drawer: React.ReactNode }) {
  const path = usePathname()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [panelOpen, setPanelOpen] = React.useState(false)
  const [wide, setWide] = React.useState(false)
  const [scrolled, setScrolled] = React.useState(false)
  const [moreOpen, setMoreOpen] = React.useState(true)
  const animKey = React.useRef("Scored")
  React.useEffect(() => {
    try {
      setMoreOpen(localStorage.getItem(MORE_KEY) !== "closed")
    } catch {
      /* private mode — stays open */
    }
  }, [])
  const toggleMore = () =>
    setMoreOpen((v) => {
      try {
        localStorage.setItem(MORE_KEY, v ? "closed" : "open")
      } catch {
        /* ignore */
      }
      return !v
    })
  const panel = React.useMemo<PanelState>(() => ({ setOpen: setPanelOpen, wide, setWide }), [wide])
  const active = (href: string) => (href === "/videos" ? path.startsWith("/videos") || path.startsWith("/v/") : path.startsWith(href))
  // The volunteer's recording flow is its own front door, without the partner's sidebar.
  if (path === "/" || path.startsWith("/record") || path.startsWith("/sign")) return <div className="min-h-dvh bg-pax-mist">{children}</div>
  const item = (href: string, label: string, Icon: typeof Gauge, small = false) => {
    const on = active(href)
    return (
      <Link
        key={href}
        href={href}
        aria-current={on ? "page" : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl px-3 outline-none transition-[color,background-color,box-shadow]",
          small ? "py-1.5 text-[13px]" : "py-2 text-sm",
          on ? "bg-white font-semibold text-pax-ink shadow-e1" : "text-slate-500 hover:bg-white/70 hover:text-pax-ink hover:shadow-e1",
        )}
      >
        {on && <span aria-hidden className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-pax-plum" />}
        <Icon
          className={cn(small ? "size-3.5" : "size-[18px]", "shrink-0 transition-colors", on ? "fill-pax-lavender text-pax-ink" : "group-hover:fill-pax-lavender group-hover:text-pax-ink")}
          strokeWidth={on ? 2.25 : 1.75}
        />
        {label}
      </Link>
    )
  }
  const title = TITLES.find(([p]) => path.startsWith(p))?.[1] ?? (path === "/" ? "Scored" : path.slice(1).split("/")[0].replace(/^./, (c) => c.toUpperCase()))
  // The take panel must not remount (and re-fade) the page beneath it.
  if (!path.startsWith("/v/")) animKey.current = title
  const panelW = wide ? PANEL_HALF : PANEL_THIRD
  return (
    <PanelCtx.Provider value={panel}>
      <div className="flex min-h-dvh md:h-dvh md:overflow-hidden md:bg-slate-200/60 md:p-[18px]">
        <div className={cn("hidden shrink-0 overflow-hidden transition-[width,margin] duration-300 ease-in-out md:block", sidebarOpen ? "md:mr-[18px] md:w-60" : "md:w-0")}>
          <div className="flex h-full w-60 flex-col rounded-2xl border border-slate-200/80 bg-pax-mist px-3 py-4 shadow-e2">
            <nav className="flex flex-col gap-0.5">{NAV.map((n) => item(n.href, n.label, n.icon))}</nav>
            <div className="mt-auto border-t border-slate-200/70 pt-3">
              <button type="button" onClick={toggleMore} aria-expanded={moreOpen} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-400 transition-colors hover:text-slate-600">
                <span className="flex-1 truncate text-left text-[11px] font-semibold uppercase tracking-wider">More</span>
                {moreOpen ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
              </button>
              {moreOpen && <nav className="ml-[15px] mt-0.5 flex flex-col gap-0.5 border-l border-slate-200/70 pl-2">{MORE.map((n) => item(n.href, n.label, n.icon, true))}</nav>}
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col md:overflow-hidden md:rounded-2xl md:border md:border-slate-200/80 md:bg-pax-mist md:shadow-e2">
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-white/90 px-4 py-2.5 backdrop-blur md:hidden">
            <Link href="/scored" aria-label="Scored"><Wordmark size={18} /></Link>
            <nav className="no-scrollbar flex flex-1 gap-1 overflow-x-auto">
              {NAV.map(({ href, label }) => (
                <Link key={href} href={href} className={cn("whitespace-nowrap rounded-full px-3 py-1 text-xs", active(href) ? "bg-pax-lavender font-semibold text-pax-ink" : "text-slate-500")}>
                  {label}
                </Link>
              ))}
            </nav>
            <Link href="/record" className="flex shrink-0 items-center gap-1.5 rounded-full bg-pax-ink px-3 py-1.5 text-xs font-semibold text-white">
              <Video className="size-3.5" /> Record
            </Link>
          </header>
          <div className={cn("hidden shrink-0 items-center gap-3 border-b px-5 py-4 transition-[border-color,box-shadow] duration-200 md:flex", scrolled ? "border-slate-200/70 shadow-[0_4px_12px_-8px_rgb(15_23_42/0.25)]" : "border-transparent")}>
            <button type="button" onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle menu" className="press -ml-2.5 flex items-center rounded-full px-2.5 py-1.5 transition-colors hover:bg-slate-200/70">
              <Wordmark size={20} />
            </button>
            <span aria-hidden className="text-lg font-light text-slate-400">|</span>
            <PageSwitcher title={title} />
            <div className="flex-1" />
            <Link href="/record" className="press flex items-center gap-2 rounded-full bg-pax-ink px-4 py-2 text-sm font-semibold text-white shadow-e2 transition-shadow hover:shadow-e3">
              <Video className="size-4" /> Record
            </Link>
          </div>
          <main className="flex-1 md:overflow-y-auto" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}>
            <div key={animKey.current} className="page-enter rise-kids @container w-full px-5 py-6 md:px-10 md:py-9">{children}</div>
          </main>
        </div>
        <div className={cn("w-0 shrink-0 overflow-hidden transition-[width,margin] duration-300 ease-in-out", panelOpen && cn("md:ml-[18px]", panelW))}>
          <div className={cn("h-full", panelW)}>{drawer}</div>
        </div>
      </div>
    </PanelCtx.Provider>
  )
}

// The page name is also the jump menu: a pill that opens a filterable list of
// every page (the leuk context switcher, in pax clothes).
function PageSwitcher({ title }: { title: string }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState("")
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const go = (href: string) => {
    setOpen(false)
    setQ("")
    router.push(href)
  }
  const needle = q.trim().toLowerCase()
  const all = [...NAV, ...MORE]
  const filtered = needle ? all.filter((d) => d.label.toLowerCase().includes(needle)) : all

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${title} — switch page`}
        className={cn("flex h-9 items-center gap-1.5 rounded-full pl-3 pr-2 transition-colors", open ? "bg-slate-200/70" : "hover:bg-slate-200/70")}
      >
        <span className="font-display max-w-[220px] truncate text-[17px] text-slate-900">{title}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-slate-400" />
      </button>
      <h1 className="sr-only">{title}</h1>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-e3">
          <div className="border-b border-slate-200/70 p-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find…"
              aria-label="Find a page"
              className="w-full rounded-lg bg-pax-mist px-2.5 py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="no-scrollbar max-h-72 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="px-2.5 py-3 text-sm text-slate-500">No matches.</p>
            ) : (
              filtered.map((d) => (
                <button
                  key={d.href}
                  type="button"
                  role="menuitem"
                  onClick={() => go(d.href)}
                  className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-pax-mist hover:text-pax-ink"
                >
                  <d.icon className="size-4 shrink-0 text-slate-400 transition-colors group-hover:fill-pax-lavender group-hover:text-pax-ink" strokeWidth={1.75} />
                  <span className="flex-1 truncate">{d.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
