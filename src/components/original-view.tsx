import Link from "next/link"

import { CardBlock, ListBlock, TableBlock } from "@/components/blocks"
import { OriginalAdmin, OwnerPublish, ScoreButton, WatchForm } from "@/components/original-admin"
import { TabRail, type RailTab } from "@/components/tab-rail"
import { UsageOpen } from "@/components/usage-beacon"
import { Player } from "@/components/workbench"
import { currentUser } from "@/lib/auth"
import { outbox } from "@/lib/mail"
import { gainOf, STAGE_LABEL, type Evaluation, type OriginalEvent, type OriginalRow } from "@/lib/originals"
import { pollsFrom, recentPolls } from "@/lib/velocity-store"
import { versions } from "@/lib/versions"
import { cn } from "@/ui/lib/utils"

// The PAX2 channels as they will appear; a video's own link replaces its channel once it is posted.
const CHANNELS: Record<string, string> = { YouTube: "PAX2 · @pax2videos", TikTok: "PAX2 · @pax2videos", Instagram: "PAX2 · @pax2videos" }

const TABS = ["recorded", "scored", "published", "polled"] as const
type Tab = (typeof TABS)[number]
const TAB_LABEL: Record<Tab, string> = { recorded: "Recorded", scored: "Scored", published: "Published", polled: "Polled" }

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
const pts = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(2)}`
const pp = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(1)}`
const pct = (x: number) => `${Math.round(x * 100)}%`
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })

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
      <UsageOpen subject={row.id} />
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl text-slate-900">{row.title ?? "Untitled video"}</h1>
        <p className="text-sm text-slate-500">
          {[row.name, row.role, row.town].filter(Boolean).join(", ") || row.owner} · version {row.version} · {STAGE_LABEL[row.stage]}
          {row.provenance === "backfilled" && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Backfilled</span>}
          {row.parent && (
            <>
              {" · "}
              <Link href={`/v/${row.parent}`} className="text-pax2-light-blue hover:underline">
                version {row.version - 1}
              </Link>
            </>
          )}
          {row.replacedBy && (
            <>
              {" · "}
              <Link href={`/v/${row.replacedBy}`} className="text-pax2-light-blue hover:underline">
                replaced by version {row.version + 1}
              </Link>
            </>
          )}
        </p>
      </div>

      {publish && row.stage === "with-owner" && user?.email === row.owner && <OwnerPublish id={row.id} />}

      <TabRail tabs={tabs} active={active} />

      <Versions id={row.id} />

      {active === "recorded" && (
        <div className="grid gap-6 @3xl:grid-cols-[300px_1fr]">
          {row.sourceYoutubeId ? (
            <div className="aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-2xl bg-slate-900 shadow-e2">
              <iframe src={`https://www.youtube.com/embed/${row.sourceYoutubeId}`} title={row.title ?? "YouTube short"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="size-full border-0" />
            </div>
          ) : (
            <Player src={`/api/video/${row.id}`} subject={row.id} className="shadow-e2" />
          )}
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
            <ListBlock title="History" height="auto">
              <div className="flex flex-col divide-y divide-slate-100">
                {row.events.map((e) => (
                  <div key={e.sk} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
                    <span className="text-slate-800">{historyLine(e)}</span>
                    <span className="text-xs text-slate-500">{when(e.at)}</span>
                  </div>
                ))}
              </div>
            </ListBlock>
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
          {admin && row.stage === "scored" && <OriginalAdmin id={row.id} enhancing={false} />}
          {admin && row.stage === "enhancing" && <OriginalAdmin id={row.id} enhancing plan={row.events.filter((e) => e.kind === "enhance").at(-1)?.plan ?? []} />}

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

          {row.evaluation.forecast && <ForecastCard f={row.evaluation.forecast} />}

          <ListBlock title="Recommendations" height="auto">
            <div className="flex flex-col divide-y divide-slate-100">
              {row.evaluation.recommendations.map((r) => (
                <div key={r.change} className="flex flex-col gap-1 py-3">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900">{r.change}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs", r.axis === "persuasion" ? "bg-pax2-light-blue/10 text-pax2-light-blue" : "bg-slate-100 text-slate-600")}>{r.axis === "persuasion" ? "Persuasion" : "Virality"}</span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {r.why}
                    {r.low != null && r.high != null && ` 90% range ${pts(r.low)} to ${pts(r.high)}.`}
                  </span>
                </div>
              ))}
              {row.evaluation.distribution?.changes.map((r) => {
                const g = gainOf(r)
                return (
                  <div key={r.key} className="flex flex-col gap-1 py-3">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900">{r.action}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Distribution</span>
                    </span>
                    <span className="tabular text-xs text-slate-500">
                      {pp(g.points)} pts ({pp(g.low)} to {pp(g.high)}), measured on {r.scope}
                    </span>
                  </div>
                )
              })}
            </div>
            {!!row.evaluation.distribution?.keeps.length && (
              <details className="group mt-2 border-t border-slate-100 pt-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">Already in place</summary>
                <div className="mt-2 flex flex-col gap-2">
                  {row.evaluation.distribution.keeps.map((r) => {
                    const g = gainOf(r)
                    return (
                      <span key={r.key} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                        <span className="text-slate-800">{r.points > 0 ? r.label : `Not: ${r.label.toLowerCase()}`}</span>
                        <span className="tabular text-xs text-slate-500">
                          {pp(g.points)} pts ({pp(g.low)} to {pp(g.high)}), {r.scope}
                        </span>
                      </span>
                    )
                  })}
                </div>
              </details>
            )}
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

const HISTORY: Record<OriginalEvent["kind"], string> = {
  recorded: "Recorded",
  transcoded: "Converted to MP4",
  scored: "Scored by PAX2",
  note: "Note added",
  rerecord: "Sent back to re-record",
  approved: "Approved",
  enhance: "Sent to the Enrichment Engine",
  replaced: "Replaced by a new version",
  "owner-publish": "Published as is by the owner",
  published: "Published",
  watching: "Watched on YouTube",
}

function historyLine(e: OriginalEvent) {
  if (e.kind === "transcoded" && e.bytes != null && e.seconds != null) return `${HISTORY.transcoded}, ${(e.bytes / 1e6).toFixed(1)} MB in ${e.seconds}s`
  return e.kind === "recorded" || e.kind === "transcoded" ? HISTORY[e.kind] : `${HISTORY[e.kind]} · ${e.by}`
}

/** Every version of the video side by side, and the version delta once two of them have been read
 *  at 72 hours. */
async function Versions({ id }: { id: string }) {
  const { rows, delta } = await versions(id)
  if (rows.length < 2) return null
  return (
    <TableBlock title="Versions" height="auto" footer={delta ? `Version delta: ${pts(delta.mean)} in ratio to the channel's median over ${delta.n} measured ${delta.n === 1 ? "pair" : "pairs"}, 90% range ${pts(delta.low)} to ${pts(delta.high)}` : "No measured pair yet."}>
      <div className="overflow-x-auto">
        <table className="tabular w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr className="[&_th]:whitespace-nowrap [&_th]:py-2 [&_th]:pr-6 [&_th]:font-medium">
              <th>Version</th>
              <th>Stage</th>
              <th>Lean, pts</th>
              <th>Chance of a Hit</th>
              <th>Views at 72h</th>
              <th>Ratio at 72h</th>
              {rows.some((r) => r.paid) && <th>Paid</th>}
            </tr>
          </thead>
          <tbody className="[&_td]:whitespace-nowrap [&_td]:border-t [&_td]:border-slate-100 [&_td]:py-2 [&_td]:pr-6">
            {rows.map((r) => (
              <tr key={r.id} className={cn(r.current && "bg-pax2-mist")}>
                <td>
                  {r.current ? (
                    <span className="font-semibold text-slate-900">v{r.version}</span>
                  ) : (
                    <Link href={`/v/${r.id}`} scroll={false} className="font-medium text-pax2-light-blue hover:underline">
                      v{r.version}
                    </Link>
                  )}
                </td>
                <td>
                  {r.stage}
                  {r.backfilled && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Backfilled</span>}
                </td>
                <td>{r.lean == null ? "-" : pts(r.lean)}</td>
                <td>{r.p == null ? "-" : pct(r.p)}</td>
                <td>{r.views == null ? "-" : `${r.views.toLocaleString("en-US")}${r.hour != null && r.hour < 71 ? ` (h${r.hour})` : ""}`}</td>
                <td>{r.ratio72 == null ? "-" : `${r.ratio72.toFixed(2)}x`}</td>
                {rows.some((x) => x.paid) && <td>{r.paid ? `$${Math.round(r.paid.spend).toLocaleString("en-US")} · ${compact.format(r.paid.impressions)} impressions · ${compact.format(r.paid.thruplays)} ThruPlays${r.paid.runs > 1 ? ` · ${r.paid.runs} runs` : ""}` : "-"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TableBlock>
  )
}

const MODEL_NAME = { metadata: "The metadata model", image: "The image model", transcript: "The transcript model" } as const

/** PAX2 Classifier's chance of a Hit and the views to expect, with the measured strength of the model that answered and the six strongest pulls. */
function ForecastCard({ f }: { f: NonNullable<Evaluation["forecast"]> }) {
  const s = f.strength
  const e = f.expected
  return (
    <CardBlock title="Forecast" height="auto">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span className="font-display text-5xl text-pax2-blue">{pct(f.p)}</span>
          {e && <span className="tabular text-sm text-slate-800">{e.views.toLocaleString("en-US")} expected views</span>}
          {f.base.family != null && (
            <span className="tabular text-sm text-slate-600">
              {f.base.familyName} channels: {pct(f.base.family)}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-600">
          {f.model ? `${MODEL_NAME[f.model]}, trained` : "Trained"} on {s.n.toLocaleString("en-US")} shorts{s.channels ? ` from ${s.channels} channels` : ""}; ranks new videos at AUC {s.auc.toFixed(2)} across channels{s.withinChannelAuc != null && ` and ${s.withinChannelAuc.toFixed(2)} within a channel`}.
          {e && f.anchor.median != null && ` Expected views: ${compact.format(f.anchor.median)}${e.medianSource ? `, ${e.medianSource},` : ""} times ${e.hitRatio} for a Hit or ${e.restRatio} otherwise, weighted by the chance.`}
        </p>
        <ul className="flex flex-col gap-1.5">
          {f.contributions.map((c) => (
            <li key={c.key} className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-slate-800">{c.label}</span>
              <span className={cn("tabular text-xs", c.pull > 0 ? "text-pax2-light-blue" : "text-slate-500")}>{pts(c.pull)}</span>
            </li>
          ))}
        </ul>
      </div>
    </CardBlock>
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
                    <a href={url} target="_blank" rel="noreferrer" className="text-pax2-light-blue hover:underline">
                      {url.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    CHANNELS[platform]
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
  const watching = row.events.filter((e) => e.kind === "watching").at(-1)
  const youtubeId = watching?.youtubeId
  // A video PAX2 knows the publish time of reads its own first days; otherwise the last four.
  const polls = watching?.published ? await pollsFrom(new Date(Date.parse(watching.published) - 864e5).toISOString(), 5) : await recentPolls(4)
  const readings = polls.filter((r) => r.id === youtubeId).sort((a, b) => a.hour - b.hour)
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
