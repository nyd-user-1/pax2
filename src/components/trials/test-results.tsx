import Link from "next/link"

import { signed, videoArms, type Arm, type Outcome, type Test } from "@/lib/trials"
import { cn } from "@/ui/lib/utils"

// One test's videos against its own placebo: the lift in ballot support as a bar on a 0 to 20 point scale,
// green where the source marks it (90% threshold), and the lift in comprehension beside it.
const SCALE = 20

export function armHref(a: Arm) {
  return a.youtube ? `/v/yt-${a.youtube}` : (a.tested ?? a.review ?? null)
}

export function TestResults({ test }: { test: Test }) {
  const arms = videoArms(test)
  const placebo = test.arms.find((a) => a.role === "placebo")
  return (
    <div className="flex flex-col gap-4">
      <p className="tabular text-xs text-slate-500">
        {test.weighted.toLocaleString()} weighted · placebo n={placebo?.n}
        {test.placebo && ` · ${test.placebo.yes}% Yes, ${test.placebo.comprehension}% correct`}
        {test.cards && " · explanation cards on screen"}
      </p>
      <div className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_2.75rem_4.5rem] items-center gap-x-3 gap-y-2.5 text-sm sm:grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_3rem_6rem]">
        <span />
        <span className="text-xs font-medium text-slate-500">Ballot support, points</span>
        <span />
        <span className="text-right text-xs font-medium text-slate-500">Comprehension</span>
        {arms.map((a, i) => {
          const href = armHref(a)
          const y: Outcome = a.yes ?? {}
          const c: Outcome = a.comprehension ?? {}
          const name = <span className="truncate font-medium text-slate-800">{a.name}</span>
          return (
            <div key={a.id} className="contents">
              {href ? (
                <Link href={href} target={href.startsWith("/") ? undefined : "_blank"} className="flex min-w-0 flex-col leading-tight hover:text-pax2-blue">
                  {name}
                  <span className="truncate text-[11px] text-slate-400">{[a.producer === "Campaign" ? "Campaign ad" : a.format, a.seconds && `${a.seconds} s`, `n=${a.n}`].filter(Boolean).join(" · ")}</span>
                </Link>
              ) : (
                name
              )}
              <div className="relative h-6 overflow-hidden rounded-md bg-slate-100" title={y.level != null ? `${y.level}% Yes against ${test.placebo?.yes}% after the placebo` : undefined}>
                <div className={cn("grow h-full rounded-md", y.sig ? "bg-above" : "bg-slate-300")} style={{ width: `${Math.max(0, Math.min(100, ((y.lift ?? 0) / SCALE) * 100))}%`, ["--i" as string]: i }} />
              </div>
              <span className={cn("tabular text-right font-semibold", y.sig ? "text-above" : "text-slate-400")}>{signed(y.lift ?? 0)}</span>
              <span className={cn("tabular text-right", c.sig ? "font-semibold text-above" : "text-slate-400")}>
                {signed(c.lift ?? 0)}
                {c.level != null && <span className="ml-1 text-[11px] font-normal text-slate-400">{c.level}%</span>}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-above" /> above placebo at the 90% threshold
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-slate-300" /> not distinguishable from placebo
        </span>
      </div>
    </div>
  )
}
