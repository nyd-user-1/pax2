"use client"

import { useRouter } from "next/navigation"
import { ArrowUpDown, Check } from "lucide-react"

import type { VelocitySort } from "@/app/velocity-actions"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/components/nova/dropdown-menu"

export const SORTS: { value: VelocitySort; label: string }[] = [
  { value: "oldest", label: "Oldest" },
  { value: "views", label: "Most views" },
  { value: "az", label: "A–Z" },
]

/** Same menu anatomy as ShortsSort — one dropdown look everywhere. */
export function VelocitySortMenu({ sort, focus }: { sort: VelocitySort; focus?: string }) {
  const router = useRouter()
  const current = SORTS.find((s) => s.value === sort) ?? SORTS[0]
  const href = (value: VelocitySort) => {
    const q = new URLSearchParams()
    if (focus) q.set("v", focus)
    if (value !== "oldest") q.set("s", value)
    const qs = q.toString()
    return `/velocity-tracker${qs ? `?${qs}` : ""}`
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Sort curves" className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm text-slate-700 shadow-e1 outline-none transition-shadow hover:shadow-e2 data-[popup-open]:shadow-e2">
        <ArrowUpDown className="size-3.5 text-slate-400" />
        {current.label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44 rounded-xl">
        {SORTS.map((s) => (
          <DropdownMenuItem key={s.value} onClick={() => router.replace(href(s.value), { scroll: false })} className="flex items-center justify-between gap-6 whitespace-nowrap rounded-lg text-sm">
            {s.label}
            {s.value === sort && <Check className="size-4 text-hermes-plum" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
