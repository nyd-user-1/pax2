"use client"

import * as React from "react"
import Link from "next/link"

import { TableBlock } from "@/components/blocks"
import type { Test } from "@/lib/trials"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/components/nova/table"
import { cn } from "@/ui/lib/utils"

// The message-by-audience grid: every voter group down, the placebo and each video across, the % choosing
// Yes in each cell. A cell is green where the source marks the video above the placebo inside that group
// (90% threshold); italic where the group had under 50 actual responses.
export function TrialGrid({ tests, more }: { tests: Test[]; more?: string }) {
  const [id, setId] = React.useState(tests[tests.length - 1].id)
  const test = tests.find((t) => t.id === id) ?? tests[0]
  const arms = test.arms
  const rows = test.subgroups.flatMap((d) => d.groups.map((g) => ({ dimension: d.dimension, group: g.group, ...Object.fromEntries(arms.map((a) => [a.name, g.cells[a.id].v])) })))
  return (
    <TableBlock
      title="Video × voter group"
      search="Search groups…"
      rows={rows}
      name={`${test.id}-groups`}
      more={more}
      actions={
        <div className="mr-1 flex items-center rounded-full border border-slate-200 p-0.5 text-xs">
          {tests.map((t) => (
            <button key={t.id} type="button" onClick={() => setId(t.id)} className={cn("rounded-full px-3 py-1 font-medium transition-colors", t.id === test.id ? "bg-pax2-blue text-white" : "text-slate-600 hover:text-pax2-blue")}>
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-above-soft ring-1 ring-above/40" /> above placebo in that group, 90% threshold
          </span>
          <span className="italic">italic: under 50 responses</span>
        </div>
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow className="bg-muted/60">
              <TableHead className="w-[30%]">Group</TableHead>
              {arms.map((a) => (
                <TableHead key={a.id} className="text-right">
                  {a.youtube ? (
                    <Link href={`/v/yt-${a.youtube}`} className="underline-offset-2 hover:text-pax2-blue hover:underline">
                      {a.name}
                    </Link>
                  ) : (
                    a.name
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {test.subgroups.flatMap((d) =>
              d.groups.map((g, j) => (
                <TableRow key={`${d.dimension}-${g.group}`}>
                  <TableCell className="whitespace-normal">
                    <span className="font-medium text-slate-900">{g.group}</span>
                    {j === 0 && <span className="ml-2 text-[11px] text-slate-400">{d.dimension}</span>}
                    {j > 0 && <span className="sr-only"> {d.dimension}</span>}
                  </TableCell>
                  {arms.map((a) => {
                    const c = g.cells[a.id]
                    return (
                      <TableCell key={a.id} className="text-right">
                        <span className={cn("tabular inline-block min-w-[3.25rem] rounded-md px-2 py-0.5", a.role === "placebo" ? "text-slate-500" : c.sig ? "bg-above-soft font-semibold text-above" : "text-slate-700", c.small && "italic opacity-70")}>{c.v}%</span>
                      </TableCell>
                    )
                  })}
                </TableRow>
              )),
            )}
          </TableBody>
        </Table>
      </div>
    </TableBlock>
  )
}
