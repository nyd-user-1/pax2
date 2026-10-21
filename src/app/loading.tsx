"use client"

import { usePathname } from "next/navigation"

// While a page renders on the server, the shell shows two block skeletons in the blocks' own frame, so
// a click lands at once instead of leaving the last page standing. The full-bleed pages (the landing,
// sign-in, the record entry) and the full-height ones (chat, graph, flows) keep their own look and show
// nothing here.

const BARE = ["/", "/signin", "/signup", "/record"]
const FULL = ["/chat", "/graph", "/app/home", "/flow/"]

function Skeleton({ tall }: { tall?: boolean }) {
  return (
    <div className="mt-5 flex animate-pulse flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 ring-1 ring-foreground/10">
      <div className="flex items-center gap-3 border-b px-4 pb-3">
        <div className="h-5 w-40 rounded-md bg-slate-200" />
        <div className="h-8 w-48 rounded-full bg-slate-100" />
        <div className="ml-auto h-5 w-12 rounded-md bg-slate-100" />
      </div>
      <div className={tall ? "flex h-[360px] flex-col gap-3 px-4" : "flex h-[220px] flex-col gap-3 px-4"}>
        {Array.from({ length: tall ? 8 : 5 }, (_, i) => (
          <div key={i} className="h-6 rounded-md bg-slate-100" style={{ width: `${92 - ((i * 17) % 30)}%` }} />
        ))}
      </div>
    </div>
  )
}

export default function Loading() {
  const path = usePathname()
  if (BARE.includes(path) || FULL.some((p) => path.startsWith(p))) return null
  return (
    <div aria-busy aria-label="Loading" className="flex flex-col">
      <Skeleton tall />
      <Skeleton />
    </div>
  )
}
