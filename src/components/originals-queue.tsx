import Link from "next/link"

import { TableBlock } from "@/components/blocks"
import { TabRail } from "@/components/tab-rail"
import { currentUser } from "@/lib/auth"
import { originals, STAGE_LABEL, type OriginalRow, type Stage } from "@/lib/originals"

// /recording, /scoring and /publishing: the three queues of original videos, on one tab rail.
// Each video lives at /v/[id]; these pages only list where each one stands.

const QUEUES = [
  { key: "recording", label: "Recording", href: "/recording", stages: ["recorded", "with-owner"] as Stage[] },
  { key: "scoring", label: "Scoring", href: "/scoring", stages: ["scored", "enhancing"] as Stage[] },
  { key: "publishing", label: "Publishing", href: "/publishing", stages: ["published", "polled"] as Stage[] },
]

const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

export async function OriginalsQueue({ queue }: { queue: "recording" | "scoring" | "publishing" }) {
  const user = await currentUser()
  // A re-recorded or enhanced video hands its place in the queues to the version that replaced it.
  const rows = (await originals(user)).filter((r) => !r.replacedBy)
  const q = QUEUES.find((x) => x.key === queue)!
  const shown = rows.filter((r) => q.stages.includes(r.stage))
  return (
    <div className="flex flex-col gap-6">
      <TabRail tabs={QUEUES.map((x) => ({ key: x.key, label: x.label, href: x.href, count: rows.filter((r) => x.stages.includes(r.stage)).length }))} active={queue} />
      {!user ? (
        <p className="text-sm text-slate-500">
          <Link href={`/signin?next=/${queue}`} className="font-medium text-pax-plum hover:underline">
            Sign in
          </Link>{" "}
          to see your videos.
        </p>
      ) : (
        <TableBlock title={q.label} height="auto">
          {shown.length ? <Table rows={shown} admin={user.admin} /> : <p className="text-sm text-slate-500">Nothing here yet.</p>}
        </TableBlock>
      )}
    </div>
  )
}

function Table({ rows, admin }: { rows: OriginalRow[]; admin: boolean }) {
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
                <Link href={`/v/${r.id}`} scroll={false} className="font-medium text-slate-900 hover:text-pax-plum">
                  {r.title ?? "Untitled video"}
                </Link>
                {r.name && <span className="text-slate-500"> · {r.name}</span>}
              </td>
              <td className="tabular">{r.version}</td>
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
