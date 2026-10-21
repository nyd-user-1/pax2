import Link from "next/link"

import { TableBlock } from "@/components/blocks"
import { TabRail } from "@/components/tab-rail"
import { WaveHero } from "@/components/wave-hero"
import { currentUser } from "@/lib/auth"
import { originals, STAGE_LABEL, type OriginalRow, type Stage } from "@/lib/originals"
import { channel, configured } from "@/lib/youtube"
import { cn } from "@/ui/lib/utils"

// One page for a video's whole journey, replacing the /drafts, /scoring and /publishing queues:
// every original as a row showing where it stands on the pipeline, its score, and the next action.
// The old routes redirect here with their filter, so nothing links dead.

const FILTERS = [
  { key: "all", label: "All", stages: null as Stage[] | null },
  { key: "drafts", label: "Drafts", stages: ["recorded", "with-owner"] as Stage[] },
  { key: "scoring", label: "Scoring", stages: ["scored", "enhancing"] as Stage[] },
  { key: "publishing", label: "Publishing", stages: ["published", "polled"] as Stage[] },
]

// The pipeline's four milestones; the in-between stages ride the nearest one as a badge.
const MILESTONES = ["Recorded", "Scored", "Published", "Polled"] as const
const REACHED: Record<Stage, number> = { recorded: 0, scored: 1, "with-owner": 1, enhancing: 1, published: 2, polled: 3 }

const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

/** The stage-appropriate next move, pointing into the video's own page. */
function nextAction(r: OriginalRow, admin: boolean): { label: string; href: string } {
  const v = `/v/${r.id}`
  switch (r.stage) {
    case "recorded":
      return { label: "Open", href: v }
    case "scored":
      return admin ? { label: "Review", href: `${v}?tab=scored` } : { label: "See the score", href: `${v}?tab=scored` }
    case "with-owner":
      return { label: "Publish or re-record", href: `${v}?publish=1` }
    case "enhancing":
      return { label: "See the plan", href: v }
    case "published":
      return { label: "See where it went", href: `${v}?tab=published` }
    case "polled":
      return { label: "See the readings", href: `${v}?tab=polled` }
  }
}

function Pipeline({ stage }: { stage: Stage }) {
  const reached = REACHED[stage]
  return (
    <span className="flex items-center" title={STAGE_LABEL[stage]}>
      {MILESTONES.map((m, i) => (
        <span key={m} className="flex items-center">
          {i > 0 && <span className={cn("h-px w-3.5", i <= reached ? "bg-pax2-light-blue" : "bg-slate-200")} />}
          <span className={cn("size-2 rounded-full", i < reached ? "bg-pax2-light-blue" : i === reached ? "bg-pax2-blue ring-4 ring-pax2-lavender" : "border border-slate-300 bg-white")} />
        </span>
      ))}
    </span>
  )
}

function score(r: OriginalRow): string {
  const f = r.evaluation?.forecast
  if (f) return `${Math.round(f.p * 100)}% Hit`
  if (r.evaluation) return `${r.evaluation.lean > 0 ? "+" : ""}${r.evaluation.lean.toFixed(1)} pts`
  return "–"
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

export async function MyVideos({ filter }: { filter?: string }) {
  const user = await currentUser()
  const f = FILTERS.find((x) => x.key === filter) ?? FILTERS[0]
  if (!user)
    return (
      <div className="flex flex-col gap-6">
        <WaveHero next="/my-videos" />
      </div>
    )
  // Every version keeps its place, so two versions can both be published and tracked.
  const all = await originals(user)
  const rows = all.map((r) => ({ ...r, of: chainLength(r, all) }))
  const shown = f.stages ? rows.filter((r) => f.stages!.includes(r.stage)) : rows
  const yt = user.admin ? await channel().catch(() => null) : null
  return (
    <div className="flex flex-col gap-6">
      <TabRail
        tabs={FILTERS.map((x) => ({ key: x.key, label: x.label, href: x.key === "all" ? "/my-videos" : `/my-videos?q=${x.key}`, count: x.stages ? rows.filter((r) => x.stages!.includes(r.stage)).length : rows.length }))}
        active={f.key}
      />
      <TableBlock
        title="Videos"
        height="auto"
        rows={shown.map((r) => ({ video: r.title ?? "Untitled video", status: STAGE_LABEL[r.stage], score: score(r), version: r.version, recorded: r.at }))}
        name="my-videos"
        footer={
          user.admin && !yt
            ? configured()
              ? <Link href="/api/youtube/oauth" className="text-pax2-light-blue hover:underline">Connect the YouTube channel</Link>
              : "No YouTube channel yet; the Google OAuth client is not configured on the server."
            : undefined
        }
      >
        {shown.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr className="[&_th]:whitespace-nowrap [&_th]:py-2 [&_th]:pr-6 [&_th]:font-medium">
                  <th>Video</th>
                  <th>Pipeline</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Version</th>
                  <th>Recorded</th>
                  <th>Next</th>
                  {user.admin && <th>Owner</th>}
                </tr>
              </thead>
              <tbody className="[&_td]:whitespace-nowrap [&_td]:border-t [&_td]:border-slate-100 [&_td]:py-2.5 [&_td]:pr-6">
                {shown.map((r) => {
                  const next = nextAction(r, user.admin)
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/v/${r.id}`} scroll={false} className="font-medium text-slate-900 hover:text-pax2-light-blue">
                          {r.title ?? "Untitled video"}
                        </Link>
                        {r.name && <span className="text-slate-500"> · {r.name}</span>}
                      </td>
                      <td>
                        <Pipeline stage={r.stage} />
                      </td>
                      <td className="text-slate-600">{STAGE_LABEL[r.stage]}</td>
                      <td className="tabular font-semibold text-slate-900">{score(r)}</td>
                      <td className="tabular">{r.version}</td>
                      <td className="tabular">{when(r.at)}</td>
                      <td>
                        <Link href={next.href} scroll={false} className="font-medium text-pax2-light-blue hover:underline">
                          {next.label}
                        </Link>
                      </td>
                      {user.admin && <td className="text-slate-500">{r.owner}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nothing here yet.</p>
        )}
      </TableBlock>
    </div>
  )
}
