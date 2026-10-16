"use client"

import { useRouter } from "next/navigation"
import { ArrowUpDown, Check } from "lucide-react"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/components/nova/dropdown-menu"

export const SORTS = [
  { value: "perday", label: "Views per day" },
  { value: "views", label: "Views" },
  { value: "likes", label: "Likes" },
  { value: "comments", label: "Comments" },
  { value: "newest", label: "Newest" },
] as const

/** Same menu anatomy as the Videos grid's Sort — one dropdown look everywhere. */
export function ShortsSort({ channel, sort }: { channel: string; sort: string }) {
  const router = useRouter()
  const current = SORTS.find((s) => s.value === sort) ?? SORTS[0]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Sort shorts" className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm text-slate-700 shadow-e1 outline-none transition-shadow hover:shadow-e2 data-[popup-open]:shadow-e2">
        <ArrowUpDown className="size-3.5 text-slate-400" />
        {current.label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44 rounded-xl">
        {SORTS.map((s) => (
          <DropdownMenuItem key={s.value} onClick={() => router.replace(`/campaigns?c=${channel}&s=${s.value}`, { scroll: false })} className="flex items-center justify-between gap-6 whitespace-nowrap rounded-lg text-sm">
            {s.label}
            {s.value === sort && <Check className="size-4 text-pax2-light-blue" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
