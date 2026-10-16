import Link from "next/link"

import Formula from "@/components/scoring/formula"
import Research from "@/components/scoring/research"
import { cn } from "@/ui/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: "Score method" }

const TABS = [
  { id: "formula", label: "How the score works" },
  { id: "research", label: "What controlled tests found" },
]

export default async function ScoringPage({ searchParams }: { searchParams: Promise<{ tab?: string; o?: string }> }) {
  const sp = await searchParams
  const tab = sp.tab === "research" ? "research" : "formula"
  return (
    <div className="flex flex-col gap-8">
      <div className="flex w-fit gap-1 rounded-full bg-white p-1 shadow-e1">
        {TABS.map((t) => (
          <Link key={t.id} href={`/scoring/method?tab=${t.id}`} className={cn("rounded-full px-4 py-2 text-sm transition-colors", tab === t.id ? "bg-pax2-blue font-semibold text-white" : "text-slate-500 hover:text-pax2-blue")}>
            {t.label}
          </Link>
        ))}
      </div>
      {tab === "research" ? <Research searchParams={Promise.resolve({ o: sp.o })} /> : <Formula />}
    </div>
  )
}
