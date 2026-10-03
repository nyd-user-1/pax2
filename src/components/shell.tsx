"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpenCheck, Clapperboard, Database, FlaskConical, Hammer, LayoutGrid, NotebookPen, Sigma } from "lucide-react"

import { cn } from "@/ui/lib/utils"

const NAV = [
  { href: "/", label: "Arguments", icon: LayoutGrid },
  { href: "/scripts", label: "Scripts", icon: NotebookPen },
  { href: "/campaign", label: "Campaign videos", icon: Clapperboard },
  { href: "/reviews", label: "Reviews", icon: BookOpenCheck },
  { href: "/method", label: "Method", icon: Sigma },
  { href: "/reference", label: "Reference model", icon: FlaskConical },
  { href: "/sources", label: "Sources", icon: Database },
  { href: "/build", label: "Build", icon: Hammer },
]

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/v/") : path.startsWith(href))
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r bg-pax-mist px-3 py-4 md:flex">
        <Link href="/" className="mb-6 flex items-baseline gap-2 px-2">
          <span className="font-display text-3xl text-pax-ink">PAX</span>
          <span className="text-xs text-muted-foreground">Partner intelligence</span>
        </Link>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-pax-lavender hover:text-pax-ink",
                active(href) && "bg-pax-lavender font-medium text-pax-ink",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto px-2 text-xs leading-relaxed text-muted-foreground">Massachusetts · Question 3 · open primaries</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/90 px-4 py-2 backdrop-blur md:hidden">
          <Link href="/" className="font-display text-2xl text-pax-ink">PAX</Link>
          <nav className="no-scrollbar flex gap-1 overflow-x-auto">
            {NAV.map(({ href, label }) => (
              <Link key={href} href={href} className={cn("whitespace-nowrap rounded-md px-2 py-1 text-xs", active(href) ? "bg-pax-lavender text-pax-ink" : "text-muted-foreground")}>
                {label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  )
}
