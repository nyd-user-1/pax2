"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Activity, BadgeCheck, Beaker, Bell, BookA, Brain, ChartColumn, ChevronsUpDown, Clapperboard, Flag, FlaskConical, Gauge, Hammer, LayoutDashboard, LifeBuoy, Library, LogIn, LogOut, MessagesSquare, NotebookPen, PanelLeftClose, PanelLeftOpen, Radio, Rocket, Send, Settings, Target, TrendingUp, User2, Video, Workflow, X } from "lucide-react"

import { DiscussionPanel } from "@/components/discussion-panel"
import { RevealFx } from "@/components/reveal-fx"
import { Wordmark } from "@/components/wordmark"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/ui/components/nova/dropdown-menu"
import { cn } from "@/ui/lib/utils"
import { whiteButton } from "@/components/white-button"

// What stands today; everything being reworked sits under Work in progress, in the product's order —
// the user's video and its scoring, then the research behind it.
const NAV = [
  { href: "/chat", label: "Chat", icon: MessagesSquare },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
]
const WIP = [
  { href: "/recording", label: "Recording", icon: Video },
  { href: "/scoring", label: "Scoring", icon: Gauge },
  { href: "/publishing", label: "Publishing", icon: Send },
  { href: "/scripts", label: "Scripts", icon: NotebookPen },
  { href: "/polling", label: "Polling", icon: ChartColumn },
  { href: "/evals", label: "Evals", icon: Target },
  { href: "/break-out", label: "iWAR", icon: Rocket },
  { href: "/feature-lift", label: "Feature lift", icon: TrendingUp },
  { href: "/velocity-tracker", label: "Velocity", icon: Activity },
  { href: "/live-tracking", label: "Live tracking", icon: Radio },
  { href: "/patterns", label: "Patterns", icon: ChartColumn },
  { href: "/graph", label: "Graph", icon: Workflow },
  { href: "/endgame", label: "Endgame", icon: Flag },
  { href: "/ml", label: "ML", icon: Brain },
  { href: "/scoring/method", label: "Score method", icon: FlaskConical },
]
// Off the sidebar and the page switcher: early pages kept for reference, under the account menu's Lab.
const LAB = [{ href: "/campaigns", label: "Campaigns", icon: Clapperboard }]
const MORE = [
  { href: "/glossary", label: "Glossary", icon: BookA },
  { href: "/library", label: "Library", icon: Library },
  { href: "/pipeline", label: "Pipeline", icon: Workflow },
  { href: "/build", label: "Build", icon: Hammer },
]

// The header names the page; the first match wins, so a deeper route comes before its parent.
const TITLES: [string, string][] = [
  ["/recording", "Recording"],
  ["/scoring/method", "Score method"],
  ["/scoring", "Scoring"],
  ["/publishing", "Publishing"],
  ["/chat", "Chat"],
  ["/dashboard", "Dashboard"],
  ["/v/", "Video"],
  ["/scripts", "Scripts"],
  ["/polling", "Polling"],
  ["/evals", "Evals"],
  ["/campaigns", "Campaigns"],
  ["/glossary", "Glossary"],
  ["/library", "Library"],
  ["/pipeline", "Pipeline"],
  ["/build", "Build"],
  ["/break-out", "iWAR"],
  ["/feature-lift", "Feature lift"],
  ["/velocity-tracker", "Velocity"],
  ["/live-tracking", "Live tracking"],
  ["/patterns", "Patterns"],
  ["/graph", "Graph"],
  ["/endgame", "Endgame"],
  ["/ml", "ML"],
  ["/tags", "Tags"],
]

const PANEL_THIRD = "md:w-[clamp(420px,34vw,620px)]"
const PANEL_HALF = "md:w-[50vw]"
// A dragged split: the panel's width as a share of the viewport, carried in --split.
const PANEL_CUSTOM = "md:w-(--split)"
const SPLIT_KEY = "pax2:split"
const MIN_PANE = 320
const GAP = 18

type PanelState = {
  setOpen: (open: boolean) => void
  wide: boolean
  setWide: (wide: boolean) => void
  /** The right panel's three sizes: a third, half, or the whole content area; custom once the divider is dragged. */
  size: PanelSize
  /** Where the size button goes next. */
  nextSize: PanelSize
  cycleSize: () => void
  panelOpen: boolean
  sidebarOpen: boolean
  toggleSidebar: () => void
  discuss: boolean
  toggleDiscuss: () => void
}
export type PanelSize = "third" | "half" | "full" | "custom"
const PanelCtx = React.createContext<PanelState>({ setOpen: () => {}, wide: false, setWide: () => {}, size: "third", nextSize: "half", cycleSize: () => {}, panelOpen: false, sidebarOpen: false, toggleSidebar: () => {}, discuss: false, toggleDiscuss: () => {} })
export const useShellPanel = () => React.useContext(PanelCtx)

export function Shell({ children, drawer, signedIn = false }: { children: React.ReactNode; drawer: React.ReactNode; signedIn?: boolean }) {
  const path = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [panelOpen, setPanelOpen] = React.useState(false)
  const [size, setSize] = React.useState<PanelSize>("third")
  const wide = size !== "third"
  const [split, setSplit] = React.useState(0.34)
  const [dragging, setDragging] = React.useState(false)
  // The size to return to once the panel that took the page closes.
  const restore = React.useRef<PanelSize | null>(null)
  const nextSize: PanelSize = size === "third" ? "half" : size === "half" ? "full" : size === "full" ? "third" : split < 0.5 ? "half" : "full"
  const [scrolled, setScrolled] = React.useState(false)
  const [discuss, setDiscuss] = React.useState(false)
  const animKey = React.useRef("Scored")
  const panel = React.useMemo<PanelState>(
    () => ({
      setOpen: setPanelOpen,
      wide,
      setWide: (w: boolean) => setSize(w ? "half" : "third"),
      size,
      nextSize,
      cycleSize: () => ((restore.current = null), setSize(nextSize)),
      panelOpen,
      sidebarOpen,
      toggleSidebar: () => setSidebarOpen((v) => !v),
      discuss,
      toggleDiscuss: () => setDiscuss((v) => !v),
    }),
    [wide, size, nextSize, panelOpen, sidebarOpen, discuss],
  )
  // The split is remembered between visits; a takeover of the whole page is not.
  React.useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SPLIT_KEY) ?? "null") as { size?: PanelSize; split?: number } | null
      if (typeof saved?.split === "number") setSplit(saved.split)
      if (saved?.size && saved.size !== "full") setSize(saved.size)
    } catch {}
  }, [])
  React.useEffect(() => {
    if (dragging || size === "full") return
    localStorage.setItem(SPLIT_KEY, JSON.stringify({ size, split }))
  }, [size, split, dragging])
  // Closing the panel after the page was closed beside it brings the page back at its old split.
  const open = panelOpen || discuss
  React.useEffect(() => {
    if (open || !restore.current) return
    setSize(restore.current)
    restore.current = null
  }, [open])
  React.useEffect(() => {
    if (!dragging) return
    const s = document.body.style
    const prev = [s.cursor, s.userSelect]
    s.cursor = "col-resize"
    s.userSelect = "none"
    return () => {
      s.cursor = prev[0]
      s.userSelect = prev[1]
    }
  }, [dragging])
  const mainRef = React.useRef<HTMLDivElement>(null)
  const drawerRef = React.useRef<HTMLDivElement>(null)
  // Sets the panel's width from where the divider sits, leaving each pane at least MIN_PANE.
  const resizeTo = (x: number) => {
    const right = drawerRef.current?.getBoundingClientRect().right
    const left = mainRef.current?.getBoundingClientRect().left
    if (right == null || left == null) return
    const w = Math.max(MIN_PANE, Math.min(right - x - GAP / 2, right - left - GAP - MIN_PANE))
    setSplit(w / window.innerWidth)
    setSize("custom")
  }
  const active = (href: string) => (href === "/scoring" ? path === "/scoring" : path.startsWith(href))
  // The front door (landing, record entry, sign-in) is full bleed; every step from /record/start on sits in the shell.
  const home = path === "/"
  if (path === "/record" || path.startsWith("/sign"))
    return (
      <div className="min-h-dvh bg-pax2-mist">
        <RevealFx key={path} translateY={4}>
          {children}
        </RevealFx>
      </div>
    )
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
          on ? "bg-white font-semibold text-pax2-blue shadow-e1" : "text-slate-500 hover:bg-white/70 hover:text-pax2-blue hover:shadow-e1",
        )}
      >
        {on && <span aria-hidden className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-pax2-light-blue" />}
        <Icon
          className={cn(small ? "size-3.5" : "size-[18px]", "icon-pop shrink-0 transition-colors", on ? "fill-pax2-lavender text-pax2-blue" : "group-hover:fill-pax2-lavender group-hover:text-pax2-blue")}
          strokeWidth={on ? 2.25 : 1.75}
        />
        {label}
      </Link>
    )
  }
  const sidebar = (
    <div className="flex h-full w-60 flex-col rounded-2xl border border-slate-500 bg-pax2-mist px-3 py-4 shadow-e2">
      <Link href="/" aria-label="Home" className="mb-4 flex px-3 pt-1">
        <Wordmark size={20} />
      </Link>
      <nav className="flex flex-col gap-0.5">{NAV.map((n) => item(n.href, n.label, n.icon))}</nav>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto border-t border-slate-200/70 pt-3">
        <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Work in progress</p>
        <nav className="flex flex-col gap-0.5">{WIP.map((n) => item(n.href, n.label, n.icon))}</nav>
        <p className="mt-3 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">More</p>
        <nav className="flex flex-col gap-0.5">{MORE.map((n) => item(n.href, n.label, n.icon))}</nav>
      </div>
      <div className="border-t border-slate-200/70 pt-3">
        <AccountMenu />
      </div>
    </div>
  )
  // The landing is full bleed. Signed in, it is the feed under its own bar, and the sidebar and the
  // discussion slide in over it rather than pushing a shell that isn't there.
  if (home)
    return (
      <PanelCtx.Provider value={panel}>
        <div className="min-h-dvh bg-pax2-mist">{children}</div>
        {signedIn && (
          <>
            <div aria-hidden onClick={() => (setSidebarOpen(false), setDiscuss(false))} className={cn("fixed inset-0 z-[60] bg-slate-900/20 transition-opacity duration-300", sidebarOpen || discuss ? "opacity-100" : "pointer-events-none opacity-0")} />
            <div className={cn("fixed inset-y-[18px] left-[18px] z-[61] transition-transform duration-300 ease-in-out", sidebarOpen ? "translate-x-0" : "-translate-x-[calc(100%+18px)]")}>{sidebar}</div>
            <div className={cn("fixed inset-y-[18px] right-[18px] z-[61] w-[min(620px,calc(100vw-36px))] transition-transform duration-300 ease-in-out", discuss ? "translate-x-0" : "translate-x-[calc(100%+18px)]")}>
              {discuss && <DiscussionPanel onClose={() => setDiscuss(false)} />}
            </div>
          </>
        )}
      </PanelCtx.Provider>
    )
  const title = TITLES.find(([p]) => path.startsWith(p))?.[1] ?? (path === "/" ? "Scored" : path.slice(1).split("/")[0].replace(/^./, (c) => c.toUpperCase()))
  // The take panel must not remount (and re-fade) the page beneath it.
  if (!path.startsWith("/v/")) animKey.current = title
  const panelW = size === "half" ? PANEL_HALF : size === "custom" ? PANEL_CUSTOM : PANEL_THIRD
  // Full: the panel takes the whole content area and the page beneath folds away.
  const takeover = open && size === "full"
  // Both panes side by side: the divider and the corner closes show.
  const paired = open && !takeover
  const closePanel = () => (panelOpen ? router.back() : setDiscuss(false))
  // /chat fills the content card edge to edge, as solar's chat fills its main area.
  const full = path.startsWith("/chat") || path.startsWith("/graph")
  return (
    <PanelCtx.Provider value={panel}>
      <div className="flex min-h-dvh md:h-dvh md:overflow-hidden md:bg-slate-200/60 md:p-[18px]">
        <div className={cn("hidden shrink-0 overflow-hidden transition-[width,margin] duration-300 ease-in-out md:block", sidebarOpen ? "md:mr-[18px] md:w-60" : "md:w-0")}>
          {sidebar}
        </div>
        <div ref={mainRef} className={cn("relative flex min-w-0 flex-1 flex-col", takeover && "md:hidden")}>
          <div className="flex min-w-0 flex-1 flex-col md:min-h-0 md:overflow-hidden md:rounded-2xl md:border md:border-slate-500 md:bg-pax2-mist md:shadow-e2">
            <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-white/90 px-4 py-2.5 backdrop-blur md:hidden">
              <Link href="/" aria-label="Home"><Wordmark size={18} /></Link>
              <nav className="no-scrollbar flex flex-1 gap-1 overflow-x-auto">
                {NAV.map(({ href, label }) => (
                  <Link key={href} href={href} className={cn("whitespace-nowrap rounded-full px-3 py-1 text-xs", active(href) ? "bg-pax2-lavender font-semibold text-pax2-blue" : "text-slate-500")}>
                    {label}
                  </Link>
                ))}
              </nav>
              <Link href="/record" className="flex shrink-0 items-center gap-1.5 rounded-full bg-pax2-blue px-3 py-1.5 text-xs font-semibold text-white">
                <Video className="size-3.5" /> Record
              </Link>
            </header>
            <div className={cn("relative z-10 hidden shrink-0 items-center gap-3 px-5 py-4 shadow-[0_4px_12px_-8px_rgb(15_23_42/0.25)] md:flex")}>
              <button type="button" onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle sidebar" className={whiteButton("circle")}>
                {sidebarOpen ? <PanelLeftClose className="size-4" strokeWidth={2} /> : <PanelLeftOpen className="size-4" strokeWidth={2} />}
              </button>
              <PageSwitcher title={title} />
              <div className="flex-1" />
              {/* A page's own header controls (the dashboard's poller switch and pipeline run) portal in here. */}
              <div id="page-actions" className="flex items-center gap-3" />
              <Link href="/record" aria-label="Record" title="Record" className="press flex size-10 items-center justify-center rounded-full bg-pax2-blue text-white shadow-md transition-shadow hover:shadow-e3">
                <Video className="size-4" />
              </Link>
              {/* 44b's DiscussionHeaderButton: the discussion panel opens from every page. */}
              <button type="button" onClick={() => setDiscuss((v) => !v)} aria-pressed={discuss} aria-label="Open the discussion" className={whiteButton("circle")}>
                <MessagesSquare className="size-4" style={{ color: "#033882", fill: "#dbe7fa" }} />
              </button>
            </div>
            <main className={cn("flex-1", full ? "flex min-h-0 flex-col md:overflow-hidden" : "md:overflow-y-auto")} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}>
              {/* Each page arrives with RevealFx's wipe; the front door has its curtain instead. */}
              <RevealFx key={animKey.current} translateY={4} className={cn("@container w-full", full ? "flex min-h-0 flex-1 flex-col" : "px-5 py-6 md:px-10 md:py-9")}>
                {children}
              </RevealFx>
            </main>
          </div>
          {/* Closing the page hands the panel the whole area. */}
          {paired && <CornerClose label="Close the page" onClose={() => ((restore.current = size), setSize("full"))} />}
        </div>
        {/* Chrome's split-view divider: drag to resize, double-click for the default third. */}
        <div className={cn("hidden w-0 shrink-0 items-center justify-center transition-[width] duration-300 ease-in-out md:flex", paired && "md:w-[18px]", dragging && "transition-none")}>
          {paired && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize the panels"
              tabIndex={0}
              onPointerDown={(e) => {
                if (e.button !== 0) return
                e.preventDefault()
                e.currentTarget.setPointerCapture(e.pointerId)
                setDragging(true)
              }}
              onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && resizeTo(e.clientX)}
              onPointerUp={() => setDragging(false)}
              onPointerCancel={() => setDragging(false)}
              onLostPointerCapture={() => setDragging(false)}
              onDoubleClick={() => setSize("third")}
              onKeyDown={(e) => {
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
                e.preventDefault()
                const left = drawerRef.current?.getBoundingClientRect().left ?? 0
                resizeTo(left - GAP / 2 + (e.key === "ArrowLeft" ? -24 : 24))
              }}
              className="group flex h-16 w-[18px] cursor-col-resize touch-none items-center justify-center outline-none"
            >
              <span className={cn("h-8 w-1 rounded-full transition-colors group-hover:bg-pax2-blue group-focus-visible:bg-pax2-blue", dragging ? "bg-pax2-blue" : "bg-slate-300")} />
            </div>
          )}
        </div>
        <div
          ref={drawerRef}
          style={{ "--split": `${split * 100}vw` } as React.CSSProperties}
          className={cn("w-0 shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out", open && (takeover ? "md:w-auto md:flex-1" : panelW), dragging && "transition-none")}
        >
          <div className={cn("relative h-full", takeover ? "w-full" : panelW)}>
            {drawer}
            {discuss && !panelOpen && <DiscussionPanel onClose={() => setDiscuss(false)} />}
            {paired && <CornerClose label="Close" onClose={closePanel} />}
          </div>
        </div>
      </div>
    </PanelCtx.Provider>
  )
}

// Chrome's split-view tab: a bite out of the pane's bottom-right corner holding its close. The pane's
// border runs around the bite, rounded out where it leaves the edges and in at its inner corner; the
// bite is painted the shell's ground (white under slate-200/60) so the pane reads as cut.
const BITE_EDGE = "M43.5 0V0.5A8 8 0 0 1 35.5 8.5H18.5A10 10 0 0 0 8.5 18.5V35.5A8 8 0 0 1 0.5 43.5H0"
const BITE_FILL = `${BITE_EDGE}V44H44V0Z`
function CornerClose({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div className="pointer-events-none absolute bottom-0 right-0 z-30 hidden size-11 md:block">
      <svg aria-hidden viewBox="0 0 44 44" className="absolute inset-0 size-full">
        <path d={BITE_FILL} className="fill-background" />
        <path d={BITE_FILL} className="fill-slate-200/60" />
        <path d={BITE_EDGE} fill="none" strokeWidth={1} className="stroke-slate-500" />
      </svg>
      <button type="button" onClick={onClose} aria-label={label} className="pointer-events-auto absolute bottom-1.5 right-1.5 flex size-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-300/70 hover:text-pax2-blue">
        <X className="size-3.5" strokeWidth={2.25} />
      </button>
    </div>
  )
}

// The page name is also the jump menu: a pill that opens a filterable list of
// every page (the leuk context switcher, in pax2 clothes).
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
  const all = [...NAV, ...WIP, ...MORE]
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
              className="w-full rounded-lg bg-pax2-mist px-2.5 py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
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
                  className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-pax2-mist hover:text-pax2-blue"
                >
                  <d.icon className="size-4 shrink-0 text-slate-400 transition-colors group-hover:fill-pax2-lavender group-hover:text-pax2-blue" strokeWidth={1.75} />
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

// leuk's AccountMenu (components/shell/account-menu.tsx): the UserChip at the foot of the
// sidebar, opening upward to the identity header and Log out.
type User = { name: string; email: string }
const initials = (name: string) =>
  name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")

function Initials({ name, size }: { name: string; size: "sm" | "md" }) {
  return (
    <span className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full bg-[#DCEBEE] font-semibold text-[#2F6570]", size === "sm" ? "size-7 text-[11px]" : "size-9 text-[13px]")}>
      {initials(name)}
    </span>
  )
}

function AccountMenu() {
  const router = useRouter()
  const path = usePathname()
  const [user, setUser] = React.useState<User | null | undefined>(undefined)
  React.useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { user: User | null }) => setUser(d.user))
      .catch(() => setUser(null))
  }, [])
  const signOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" })
    router.push("/signin")
    router.refresh()
  }
  if (user === undefined) return <div className="h-9" />
  // Signed out, the account chip is simply the way in.
  if (!user)
    return (
      <Link href={`/signin?next=${encodeURIComponent(path)}`} className="flex w-full items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-sm font-semibold text-pax2-blue transition-colors hover:bg-white/70">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500"><LogIn className="size-3.5" /></span>
        Log in
      </Link>
    )
  const name = user.name
  const item = "gap-2.5 rounded-lg px-2.5 py-2 text-sm [&_svg]:size-4 [&_svg]:text-slate-500"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Account menu" className="flex w-full max-w-full items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-pax2-blue outline-none transition-colors hover:bg-white/70 data-[popup-open]:bg-white/70">
        {user ? <Initials name={name} size="sm" /> : <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500"><User2 className="size-3.5" /></span>}
        <span className="flex-1 truncate text-left text-sm font-semibold">{name}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-slate-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-(--anchor-width) rounded-2xl border border-slate-500 bg-pax2-mist p-1.5 shadow-e2 ring-0">
        <div className="flex items-center gap-3 px-2.5 py-2">
          {user ? <Initials name={name} size="md" /> : <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500"><User2 className="size-4" /></span>}
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-pax2-blue">{name}</span>
            {user && <span className="block truncate text-sm text-slate-500">{user.email}</span>}
          </span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className={item}>
          <User2 /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem disabled className={item}>
          <BadgeCheck /> Account
        </DropdownMenuItem>
        <DropdownMenuItem disabled className={item}>
          <Bell /> Notifications
        </DropdownMenuItem>
        <DropdownMenuItem disabled className={item}>
          <Settings /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={item}>
            <Beaker /> Lab
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-44 rounded-2xl border border-slate-500 bg-pax2-mist p-1.5 shadow-e2 ring-0">
            {LAB.map((l) => (
              <DropdownMenuItem key={l.href} onClick={() => router.push(l.href)} className={item}>
                <l.icon /> {l.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className={item}>
          <LifeBuoy /> Help
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className={cn(item, "text-pax2-red-deep [&_svg]:text-pax2-red-deep")}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
