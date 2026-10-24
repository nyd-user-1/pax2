"use client"

import * as React from "react"
import { Check } from "lucide-react"

import type { Lift, Results } from "@/lib/message-test-stats"
import { cn } from "@/ui/lib/utils"

// A message test's results, real or simulated: each video's ballot support and its lift over the placebo,
// then the voter groups for one video. `planted`: the simulator's true lifts, in points, beside the estimates.

const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`)
const pts = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1)}`
const TH = "px-3 py-2 text-left text-xs font-medium text-slate-500"
const TD = "px-3 py-2 text-sm text-slate-800 tabular"

function LiftCell({ l }: { l: Lift | null }) {
  if (!l) return <span className="text-slate-400">—</span>
  const clear = l.lo > 0 || l.hi < 0
  return (
    <span className={cn(clear ? "font-semibold text-slate-900" : "text-slate-600")}>
      {pts(l.est)} <span className="text-xs font-normal text-slate-400">({pts(l.lo)} to {pts(l.hi)})</span>
    </span>
  )
}

export function ResultsTable({ results, planted }: { results: Results; planted?: Record<string, number> }) {
  const [armId, setArmId] = React.useState(results.arms[0]?.arm.id ?? "")
  const [dim, setDim] = React.useState(results.groups.find((g) => g.key === "party")?.key ?? results.groups[0]?.key)
  const p = results.placebo
  const group = results.groups.find((g) => g.key === dim)
  const cells = group?.byArm[armId] ?? []
  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={TH}>Video</th>
              <th className={TH}>Respondents</th>
              <th className={TH}>Support</th>
              {planted && <th className={TH}>Planted</th>}
              <th className={TH}>Lift, adjusted ({results.confidence}% interval)</th>
              <th className={TH}>Lift, unadjusted</th>
              <th className={TH}>Comprehension lift</th>
              <th className={TH}>Holds across {results.arms.length}</th>
              <th className={TH}>Video check</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {p && (
              <tr className="bg-slate-50/60">
                <td className={TD}>{p.arm.label}</td>
                <td className={TD}>{p.n}</td>
                <td className={TD}>{pct(p.yes)}</td>
                {planted && <td className={TD} />}
                <td className={TD} colSpan={5} />
              </tr>
            )}
            {results.arms.map((a) => (
              <tr key={a.arm.id}>
                <td className={TD}>{a.arm.label}</td>
                <td className={TD}>{a.n}</td>
                <td className={TD}>{pct(a.yes)}</td>
                {planted && <td className={TD}>{pts((planted[a.arm.id] ?? 0) / 100)}</td>}
                <td className={TD}>
                  <LiftCell l={a.yesLift} />
                </td>
                <td className={TD}>
                  <LiftCell l={a.yesLiftRaw} />
                </td>
                <td className={TD}>
                  <LiftCell l={a.compLift} />
                </td>
                <td className={TD}>{a.holds ? <Check className="size-4 text-above" /> : <span className="text-slate-300">—</span>}</td>
                <td className={TD}>{pct(a.checkPass)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {results.arms.length > 0 && group && (
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <select value={armId} onChange={(e) => setArmId(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm">
              {results.arms.map((a) => (
                <option key={a.arm.id} value={a.arm.id}>
                  {a.arm.label}
                </option>
              ))}
            </select>
            <select value={dim} onChange={(e) => setDim(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm">
              {results.groups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          <table className="w-full border-collapse">
            <thead className="border-b border-slate-200">
              <tr>
                <th className={TH}>{group.label}</th>
                <th className={TH}>Respondents (video · placebo)</th>
                <th className={TH}>Lift ({results.confidence}% interval)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cells.map((c) => (
                <tr key={c.group} className={cn(c.small && "text-slate-400")}>
                  <td className={TD}>{c.group}</td>
                  <td className={TD}>
                    {c.n} · {c.nPlacebo}
                    {c.small && <span className="ml-2 text-xs text-amber-700">small</span>}
                  </td>
                  <td className={TD}>
                    <LiftCell l={c.lift} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
