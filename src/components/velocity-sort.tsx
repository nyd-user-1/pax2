"use client"

import { useRouter } from "next/navigation"
import { ArrowUpDown, Check } from "lucide-react"

import type { VelocitySort } from "@/app/velocity-actions"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/components/nova/dropdown-menu"
import { whiteButton } from "@/components/white-button"

export const SORTS: { value: VelocitySort; label: string }[] = [
  { value: "oldest", label: "Oldest" },
  { value: "views", label: "Most views" },
  { value: "az", label: "A–Z" },
]

/** Same menu anatomy as ShortsSort — one dropdown look everywhere. */
export function VelocitySortMenu({ sort, focus, filter }: { sort: VelocitySort; focus?: string; filter?: string }) {
  const router = useRouter()
  const current = SORTS.find((s) => s.value === sort) ?? SORTS[0]
  const href = (value: VelocitySort) => {
    const q = new URLSearchParams()
    if (focus) q.set("v", focus)
    if (value !== "oldest") q.set("s", value)
    if (filter && filter !== "all") q.set("f", filter)
    const qs = q.toString()
    return `/velocity-tracker${qs ? `?${qs}` : ""}`
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Sort curves" className={whiteButton("md")}>
        <ArrowUpDown className="size-3.5 text-slate-400" />
        {current.label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44 rounded-xl">
        {SORTS.map((s) => (
          <DropdownMenuItem key={s.value} onClick={() => router.replace(href(s.value), { scroll: false })} className="flex items-center justify-between gap-6 whitespace-nowrap rounded-lg text-sm">
            {s.label}
            {s.value === sort && <Check className="size-4 text-pax2-light-blue" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
