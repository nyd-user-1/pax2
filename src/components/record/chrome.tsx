import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { cn } from "@/ui/lib/utils"

/** The flow's top bar: the way back, nothing else — the numbered steps never advanced and are gone. */
export function StepBar({ back }: { back: { href: string; label: string } }) {
  return (
    <div className="border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-5 py-4">
        <Link href={back.href} className="flex items-center gap-1.5 text-sm text-slate-800 hover:text-pax2-blue">
          <ArrowLeft className="size-4" /> {back.label}
        </Link>
      </div>
    </div>
  )
}

export function FlowPage({ title, lead, children, wide, className }: { title?: string; lead?: string; children: React.ReactNode; wide?: boolean; className?: string }) {
  return (
    <div className={cn("mx-auto flex w-full flex-col gap-8 px-5 py-12", wide ? "max-w-6xl" : "max-w-3xl", className)}>
      {title && (
        <header className="flex flex-col gap-3">
          <h1 className="font-display text-4xl font-semibold leading-tight text-pax2-blue md:text-5xl">{title}</h1>
          {lead && <p className="text-lg text-slate-800">{lead}</p>}
        </header>
      )}
      {children}
    </div>
  )
}

export function HelpLine() {
  return (
    <p className="text-sm">
      <Link href="/record/guide" className="font-medium text-primary underline underline-offset-4">
        Volunteer Guide
      </Link>
    </p>
  )
}
