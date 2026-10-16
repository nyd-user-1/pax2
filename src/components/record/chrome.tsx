import Link from "next/link"
import { ArrowLeft, Check } from "lucide-react"

import { cn } from "@/ui/lib/utils"

const STEPS = ["Script", "Video", "Send"]

/** The flow's top bar: a back link and the three steps. */
export function StepBar({ step, back }: { step: 1 | 2 | 3; back: { href: string; label: string } }) {
  return (
    <div className="border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
        <Link href={back.href} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-pax2-blue">
          <ArrowLeft className="size-4" /> {back.label}
        </Link>
        <ol className="flex items-center gap-2 text-sm">
          {STEPS.map((s, i) => {
            const n = i + 1
            const done = n < step
            const on = n === step
            return (
              <li key={s} className="flex items-center gap-2">
                {i > 0 && <span className="h-px w-6 bg-border sm:w-10" />}
                <span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-medium", done ? "bg-primary/80 text-white" : on ? "bg-pax2-blue text-white ring-4 ring-primary/15" : "border text-muted-foreground")}>
                  {done ? <Check className="size-3.5" /> : n}
                </span>
                <span className={cn("hidden sm:inline", on ? "font-medium text-pax2-blue" : "text-muted-foreground")}>{s}</span>
              </li>
            )
          })}
        </ol>
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
          {lead && <p className="text-lg text-muted-foreground">{lead}</p>}
        </header>
      )}
      {children}
    </div>
  )
}

export function HelpLine() {
  return (
    <p className="text-center text-sm">
      <Link href="/record/guide" className="font-medium text-primary underline underline-offset-4">
        Volunteer Guide
      </Link>
    </p>
  )
}
