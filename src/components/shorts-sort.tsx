"use client"

import { useRouter } from "next/navigation"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/components/nova/select"

export const SORTS = [
  { value: "perday", label: "Views per day" },
  { value: "views", label: "Views" },
  { value: "likes", label: "Likes" },
  { value: "comments", label: "Comments" },
  { value: "newest", label: "Newest" },
] as const

export function ShortsSort({ channel, sort }: { channel: string; sort: string }) {
  const router = useRouter()
  return (
    <Select value={sort} onValueChange={(v) => v && router.replace(`/campaigns?c=${channel}&s=${v}`, { scroll: false })}>
      <SelectTrigger className="w-max min-w-40" size="sm" aria-label="Sort shorts">
        <SelectValue>{() => SORTS.find((s) => s.value === sort)?.label ?? "Views per day"}</SelectValue>
      </SelectTrigger>
      <SelectContent className="w-max min-w-44 rounded-xl">
        {SORTS.map((s) => (
          <SelectItem key={s.value} value={s.value} className="whitespace-nowrap">
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
