import { notFound } from "next/navigation"

import { HOME_BLOCK } from "@/app/_home/height"
import { currentUser } from "@/lib/auth"
import { cn } from "@/ui/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: "Data" }

// Data (Brendan, 2026-10-23), under Admin: the HOME working document, served from S3 at
// /sketches/HOME.html (src/app/sketches/[name]/route.ts), shown whole in the page in its own styling.
export default async function DataPage() {
  if (!(await currentUser())?.admin) notFound()
  return <iframe src="/sketches/HOME.html" title="Data" className={cn("w-full rounded-2xl border border-slate-200 bg-white", HOME_BLOCK)} />
}
