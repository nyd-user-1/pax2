"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Clapperboard, FlaskConical, Hammer, Home, LayoutDashboard, Library, NotebookPen, Plus, PlaySquare, Target } from "lucide-react"

import { cn } from "@/ui/lib/utils"

// The partner's jobs first; the workings of the score and the build underneath.
const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/videos", label: "Videos", icon: PlaySquare },
  { href: "/scripts", label: "Scripts", icon: NotebookPen },
  { href: "/evals", label: "Evals", icon: Target },
  { href: "/campaigns", label: "Campaigns", icon: Clapperboard },
]
const MORE = [
  { href: "/scoring", label: "Scoring", icon: FlaskConical },
  { href: "/sources", label: "Sources", icon: Library },
  { href: "/build", label: "Build", icon: Hammer },
]

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const active = (href: string) => (href === "/" ? path === "/" : href === "/videos" ? path.startsWith("/videos") || path.startsWith("/v/") : path.startsWith(href))
  // The volunteer's recording flow is its own front door, without the partner's sidebar.
  if (path.startsWith("/record")) return <div className="min-h-dvh bg-pax-mist">{children}</div>
  const item = (href: string, label: string, Icon: typeof Home, small = false) => (
    <Link
      key={href}
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-full px-3.5 outline-none transition-colors",
        small ? "py-1.5 text-[13px]" : "py-2.5 text-sm",
        active(href) ? "bg-white font-semibold text-pax-ink shadow-e1" : "text-slate-500 hover:bg-white/70 hover:text-pax-ink",
      )}
    >
      <Icon className={small ? "size-3.5" : "size-[18px]"} strokeWidth={active(href) ? 2.25 : 1.75} />
      {label}
    </Link>
  )
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 px-4 py-6 md:flex">
        <Link href="/" className="flex items-center gap-2 px-3.5">
          <span className="text-[22px] font-bold tracking-tight text-pax-ink">PAX</span>
          <span className="flex h-1.5 w-7 overflow-hidden rounded-full">
            <span className="flex-1 bg-pax-plum" />
            <span className="flex-1 bg-white" />
            <span className="flex-1 bg-pax-red" />
          </span>
        </Link>
        <Link href="/record" className="press flex items-center justify-center gap-2 rounded-full bg-pax-ink px-4 py-3 text-sm font-semibold text-white shadow-e2 transition-shadow hover:shadow-e3">
          <Plus className="size-4" strokeWidth={2.5} /> Record a video
        </Link>
        <nav className="flex flex-col gap-1">{NAV.map((n) => item(n.href, n.label, n.icon))}</nav>
        <nav className="mt-auto flex flex-col gap-0.5 border-t border-slate-200/70 pt-4">{MORE.map((n) => item(n.href, n.label, n.icon, true))}</nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-white/90 px-4 py-2.5 backdrop-blur md:hidden">
          <Link href="/" className="text-lg font-bold text-pax-ink">PAX</Link>
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
        <main className="w-full max-w-[1200px] flex-1 px-5 py-6 md:px-10 md:py-9">{children}</main>
      </div>
    </div>
  )
}
