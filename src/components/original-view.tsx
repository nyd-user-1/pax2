import Link from "next/link"

import { CardBlock, ListBlock, TableBlock } from "@/components/blocks"
import { OriginalAdmin, OwnerPublish, ScoreButton, WatchForm } from "@/components/original-admin"
import { TabRail, type RailTab } from "@/components/tab-rail"
import { currentUser } from "@/lib/auth"
import { outbox } from "@/lib/mail"
import { STAGE_LABEL, type OriginalRow } from "@/lib/originals"
import { recentPolls } from "@/lib/velocity-store"
import { cn } from "@/ui/lib/utils"

const TABS = ["recorded", "scored", "published", "polled"] as const
type Tab = (typeof TABS)[number]
const TAB_LABEL: Record<Tab, string> = { recorded: "Recorded", scored: "Scored", published: "Published", polled: "Polled" }

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
const pts = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(2)}`

/** One page per original video, from the recording to the wild; each stage is a tab on the rail,
 *  open once the video has reached it. */
export async function OriginalView({ row, tab, publish }: { row: OriginalRow; tab?: string; publish?: boolean }) {
  const user = await currentUser()
  const admin = !!user?.admin
  const reached: Record<Tab, boolean> = {
    recorded: true,
    scored: !!row.evaluation,
    published: row.stage === "published" || row.stage === "polled",
    polled: row.stage === "polled",
  }
  const latest = [...TABS].reverse().find((t) => reached[t])!
  const active: Tab = TABS.includes(tab as Tab) && reached[tab as Tab] ? (tab as Tab) : latest
  const tabs: RailTab[] = TABS.map((t) => ({ key: t, label: TAB_LABEL[t], href: `/v/${row.id}?tab=${t}`, disabled: !reached[t] }))
  const notes = row.events.filter((e) => e.kind === "note")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl text-slate-900">{row.title ?? "Untitled video"}</h1>
        <p className="text-sm text-slate-500">
          {[row.name, row.role, row.town].filter(Boolean).join(", ") || row.owner} · version {row.version} · {STAGE_LABEL[row.stage]}
          {row.parent && (
            <>
              {" · "}
              <Link href={`/v/${row.parent}`} className="text-pax-plum hover:underline">
                version {row.version - 1}
              </Link>
            </>
          )}
          {row.replacedBy && (
            <>
              {" · "}
              <Link href={`/v/${row.replacedBy}`} className="text-pax-plum hover:underline">
                replaced by version {row.version + 1}
              </Link>
            </>
          )}
        </p>
      </div>

      {publish && row.stage === "with-owner" && user?.email === row.owner && <OwnerPublish id={row.id} />}

      <TabRail tabs={tabs} active={active} />

      {active === "recorded" && (
        <div className="grid gap-6 @3xl:grid-cols-[300px_1fr]">
          <video src={`/api/video/${row.id}`} controls playsInline className="aspect-[9/16] w-full max-w-[300px] rounded-2xl bg-black object-cover shadow-e2" />
          <div className="flex min-w-0 flex-col gap-6">
            <CardBlock title="Recording" height="auto">
              <div className="grid grid-cols-2 gap-4 @lg:grid-cols-4">
                {[
                  ["Recorded", when(row.at)],
                  ["Length", `${row.seconds}s`],
                  ["Owner", row.owner],
                  ["Consent", row.consent ? "Given" : "Not given"],
                ].map(([label, value]) => (
                  <div key={label} className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-slate-900">{value}</span>
                    <span className="text-xs text-slate-500">{label}</span>
                  </div>
                ))}
              </div>
            </CardBlock>
            {row.text && (
              <ListBlock title="Script" height="auto">
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{row.text}</p>
              </ListBlock>
            )}
            {admin && !row.evaluation && (
              <CardBlock title="Score" height="auto">
                <ScoreButton id={row.id} />
              </CardBlock>
            )}
          </div>
        </div>
      )}

      {active === "scored" && row.evaluation && (
        <div className="flex flex-col gap-6">
          {admin && row.stage === "scored" && !row.replacedBy && <OriginalAdmin id={row.id} enhancing={false} />}
          {admin && row.stage === "enhancing" && !row.replacedBy && <OriginalAdmin id={row.id} enhancing plan={row.events.filter((e) => e.kind === "enhance").at(-1)?.plan ?? []} />}

          <CardBlock title="Evaluation" height="auto" footer={`Scored ${when(row.events.filter((e) => e.kind === "scored").at(-1)!.at)}`}>
            <div className="flex flex-col gap-5">
              <p className="text-sm leading-relaxed text-slate-700">{row.evaluation.summary}</p>
              <div className="grid grid-cols-2 gap-4 @lg:grid-cols-3">
                <div className="flex flex-col">
                  <span className="tabular text-lg font-semibold text-slate-900">{pts(row.evaluation.lean)} pts</span>
                  <span className="text-xs text-slate-500">Persuasion lean against a typical ad</span>
                </div>
                <div className="flex flex-col">
                  <span className="tabular text-lg font-semibold text-slate-900">{row.evaluation.traits.length}</span>
                  <span className="text-xs text-slate-500">Swayable traits found</span>
                </div>
                <div className="flex flex-col">
                  <span className="tabular text-lg font-semibold text-slate-900">{row.evaluation.title.filter((t) => t.has).length}</span>
                  <span className="text-xs text-slate-500">Headline patterns in the title</span>
                </div>
              </div>
            </div>
          </CardBlock>

          <ListBlock title="Recommendations" height="auto">
            <div className="flex flex-col divide-y divide-slate-100">
              {row.evaluation.recommendations.map((r) => (
                <div key={r.change} className="flex flex-col gap-1 py-3">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900">{r.change}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs", r.axis === "persuasion" ? "bg-pax-plum/10 text-pax-plum" : "bg-slate-100 text-slate-600")}>{r.axis === "persuasion" ? "Persuasion" : "Virality"}</span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {r.why}
                    {r.low != null && r.high != null && ` 90% range ${pts(r.low)} to ${pts(r.high)}.`}
                  </span>
                </div>
              ))}
            </div>
          </ListBlock>

          <TableBlock title="Traits" height="auto">
            <div className="overflow-x-auto">
              <table className="tabular w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr className="[&_th]:whitespace-nowrap [&_th]:py-2 [&_th]:pr-6 [&_th]:font-medium">
                    <th>Trait</th>
                    <th>Line</th>
                    <th>Lean, pts</th>
                  </tr>
                </thead>
                <tbody className="[&_td]:border-t [&_td]:border-slate-100 [&_td]:py-2 [&_td]:pr-6 [&_td]:align-top">
                  {row.evaluation.traits.map((t) => (
                    <tr key={t.key}>
                      <td className="whitespace-nowrap font-medium text-slate-900">{t.label}</td>
                      <td className="text-slate-600">{t.quote ? `“${t.quote}”` : "-"}</td>
                      <td className="whitespace-nowrap">
                        {pts(t.diff)} <span className="text-xs text-slate-400">({pts(t.low)} to {pts(t.high)})</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableBlock>

          {notes.length > 0 && (
            <ListBlock title="Notes" height="auto">
              <div className="flex flex-col divide-y divide-slate-100">
                {notes.map((n) => (
                  <div key={n.at} className="flex flex-col gap-0.5 py-3">
                    <span className="whitespace-pre-line text-sm text-slate-800">{n.note}</span>
                    <span className="text-xs text-slate-500">
                      {n.by} · {when(n.at)}
                    </span>
                  </div>
                ))}
              </div>
            </ListBlock>
          )}
        </div>
      )}

      {active === "published" && <Published row={row} admin={admin} />}
      {active === "polled" && <Polled row={row} />}
    </div>
  )
}

async function Published({ row, admin }: { row: OriginalRow; admin: boolean }) {
  const published = row.events.filter((e) => e.kind === "published").at(-1)!
  const watching = row.events.filter((e) => e.kind === "watching").at(-1)
  const links = new Map((published.destinations ?? []).map((d) => [d.platform, d.url]))
  for (const d of watching?.destinations ?? []) links.set(d.platform, d.url)
  const mail = await outbox(row.id)
  return (
    <div className="flex flex-col gap-6">
      <TableBlock title="Destinations" height="auto" footer={`Published ${when(published.at)}`}>
        <table className="w-full text-sm">
          <tbody className="[&_td]:border-t [&_td]:border-slate-100 [&_td]:py-2 [&_td]:pr-6 first:[&_tr_td]:border-t-0">
            {[...links].map(([platform, url]) => (
              <tr key={platform}>
                <td className="font-medium text-slate-900">{platform}</td>
                <td className="text-slate-600">
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer" className="text-pax-plum hover:underline">
                      {url.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    "Waiting for the Hermes channel"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableBlock>
      {admin && !watching && (
        <CardBlock title="Watch it" height="auto">
          <WatchForm id={row.id} />
        </CardBlock>
      )}
      {admin && mail.length > 0 && (
        <ListBlock title="Emails" height="auto">
          <div className="flex flex-col divide-y divide-slate-100">
            {mail.map((m) => (
              <div key={m.sk} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
                <span className="text-slate-900">
                  {m.subject} <span className="text-slate-500">to {m.to.join(", ")}</span>
                </span>
                <span className={cn("text-xs", m.status === "sent" ? "text-slate-500" : "text-below")} title={m.error}>
                  {m.status === "sent" ? when(m.at) : "Not sent"}
                </span>
              </div>
            ))}
          </div>
        </ListBlock>
      )}
    </div>
  )
}

async function Polled({ row }: { row: OriginalRow }) {
  const youtubeId = row.events.filter((e) => e.kind === "watching").at(-1)?.youtubeId
  const readings = (await recentPolls(4)).filter((r) => r.id === youtubeId).sort((a, b) => a.hour - b.hour)
  const last = readings.at(-1)
  return (
    <div className="flex flex-col gap-6">
      <CardBlock title="In the wild" height="auto" footer={last ? `Hour ${last.hour} since posting` : "The poller reads it every 15 minutes for its first 72 hours"}>
        <div className="grid grid-cols-2 gap-4 @lg:grid-cols-4">
          {[
            ["Views", last?.views],
            ["Likes", last?.likes],
            ["Comments", last?.comments],
            ["Readings", readings.length],
          ].map(([label, value]) => (
            <div key={label as string} className="flex flex-col">
              <span className="tabular text-lg font-semibold text-slate-900">{value == null ? "-" : Number(value).toLocaleString("en-US")}</span>
              <span className="text-xs text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </CardBlock>
    </div>
  )
}
