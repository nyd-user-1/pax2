import Link from "next/link"

import { TableBlock } from "@/components/blocks"
import { TabRail } from "@/components/tab-rail"
import { WaveHero } from "@/components/wave-hero"
import { currentUser } from "@/lib/auth"
import { originals, STAGE_LABEL, type OriginalRow, type Stage } from "@/lib/originals"

// /drafts, /scoring and /publishing: the three queues of original videos, on one tab rail.
// Each video lives at /v/[id]; these pages only list where each one stands.

const QUEUES = [
  { key: "recording", label: "Drafts", href: "/drafts", stages: ["recorded", "with-owner"] as Stage[] },
  { key: "scoring", label: "Scoring", href: "/scoring", stages: ["scored", "enhancing"] as Stage[] },
  { key: "publishing", label: "Publishing", href: "/publishing", stages: ["published", "polled"] as Stage[] },
]

const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

export async function OriginalsQueue({ queue }: { queue: "recording" | "scoring" | "publishing" }) {
  const user = await currentUser()
  // Every version keeps its place in the queues, so two versions can both be published and tracked.
  const all = await originals(user)
  const rows = all.map((r) => ({ ...r, of: chainLength(r, all) }))
  const q = QUEUES.find((x) => x.key === queue)!
  const shown = rows.filter((r) => q.stages.includes(r.stage))
  return (
    <div className="flex flex-col gap-6">
      <TabRail tabs={QUEUES.map((x) => ({ key: x.key, label: x.label, href: x.href, count: rows.filter((r) => x.stages.includes(r.stage)).length }))} active={queue} />
      {!user ? (
        <WaveHero next={`/${queue}`} />
      ) : (
        <TableBlock title={q.label} height="auto">
          {shown.length ? <Table rows={shown} admin={user.admin} /> : <p className="text-sm text-slate-500">Nothing here yet.</p>}
        </TableBlock>
      )}
    </div>
  )
}

/** How many versions the row's chain has, counted from the rows the viewer can see. */
function chainLength(r: OriginalRow, all: OriginalRow[]) {
  const byId = new Map(all.map((x) => [x.id, x]))
  let root = r
  while (root.parent && byId.has(root.parent)) root = byId.get(root.parent)!
  let n = 1
  let at = root
  while (at.replacedBy && byId.has(at.replacedBy)) {
    at = byId.get(at.replacedBy)!
    n += 1
  }
  return n
}

function Table({ rows, admin }: { rows: (OriginalRow & { of: number })[]; admin: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500">
          <tr className="[&_th]:whitespace-nowrap [&_th]:py-2 [&_th]:pr-6 [&_th]:font-medium">
            <th>Video</th>
            <th>Version</th>
            <th>Stage</th>
            <th>Recorded</th>
            {admin && <th>Owner</th>}
          </tr>
        </thead>
        <tbody className="[&_td]:whitespace-nowrap [&_td]:border-t [&_td]:border-slate-100 [&_td]:py-2.5 [&_td]:pr-6">
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link href={`/v/${r.id}`} scroll={false} className="font-medium text-slate-900 hover:text-pax2-light-blue">
                  {r.title ?? "Untitled video"}
                </Link>
                {r.name && <span className="text-slate-500"> · {r.name}</span>}
              </td>
              <td className="tabular">{r.of > 1 ? `v${r.version} of ${r.of}` : r.version}</td>
              <td>{STAGE_LABEL[r.stage]}</td>
              <td className="tabular">{when(r.at)}</td>
              {admin && <td className="text-slate-500">{r.owner}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
