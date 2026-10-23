import Link from "next/link"
import { Video } from "lucide-react"

import ma from "../../../data/generated/ma-house-2022.json"
import maps from "../../../data/generated/campaign-maps.json"
import polling from "../../../data/polling.json"
import { ChartBlock, ListBlock, MapBlock, TableBlock, TwoHalfBlock, TwoThirdBlock } from "@/components/blocks"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { UncontestedMap } from "@/components/map/maps"
import { cn } from "@/ui/lib/utils"
import { currentUser } from "@/lib/auth"
import { AskReport, ReportView } from "@/components/library/report-view"
import { ReportShelf } from "@/components/library/report-shelf"
import { TabRail } from "@/components/tab-rail"
import { AudienceFinder } from "@/components/trials/audience-finder"
import { DetectableLift } from "@/components/trials/detectable-lift"
import { Gaps, OpenQuestions } from "@/components/trials/gaps"
import { PredictionVsTrial } from "@/components/trials/prediction-vs-trial"
import { TestResults } from "@/components/trials/test-results"
import { TrialGrid } from "@/components/trials/trial-grid"
import { REPORTS, reportAbout, reportBySlug, reportContext } from "@/lib/reports"
import { fieldDates, reportHref, trialsText, TRIALS, videoArms } from "@/lib/trials"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/components/nova/table"
import { redirect } from "next/navigation"

export const metadata = { title: "Polling" }

function Source({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-xs text-slate-400 transition-colors hover:text-pax2-light-blue">
      {children}
    </a>
  )
}

/** Two tabs (Brendan, 2026-10-23). Question 3 tests: the workspace for the Grow Progress message-testing
 *  report, the trial set beside what PAX2 measures, the audiences each video moved, the open audiences and
 *  the size of test that could close them, the report's open questions, and the report itself with the
 *  discussion panel. Archives: every report and poll in the library searched page by page, then the earlier
 *  polling (MassINC's topline, the idea on other ballots, uncontested districts). */
export default async function PollingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab === "archives" ? "archives" : "tests"
  const gatekeeper = await currentUser()
  if (!gatekeeper) redirect("/signin?next=/polling")
  const q = polling.q3
  const unc = (maps.uncontested as Record<string, { races: number; uncontested: number; pct: number }>).MA
  const districts = Object.entries((ma as unknown as { districts: Record<string, number> }).districts)
  const oneName = districts.filter(([, n]) => n <= 1).map(([d]) => d)
  const votes = [...polling.votes].sort((a, b) => a.year - b.year || b.yes - a.yes)
  // The placebo arm of each test: what adults said about Question 3 after a non-political video and the
  // ballot explanation. Groups present in both tests line up; Test 2 alone has the media market.
  const [t1, t2] = TRIALS.tests
  const groups = t2.subgroups.flatMap((d) => d.groups.map((g) => ({ dimension: d.dimension, group: g.group, t2: g.cells.placebo, t1: t1.subgroups.find((x) => x.dimension === d.dimension)?.groups.find((x) => x.group === g.group)?.cells.placebo ?? null })))
  const trust = [
    { label: "TV or broadcast ad", t1: t1.mediaTrust.tv, t2: t2.mediaTrust.tv },
    { label: "Person speaking to camera", t1: t1.mediaTrust.camera, t2: t2.mediaTrust.camera },
    { label: "Podcast or interview clip", t1: t1.mediaTrust.podcast, t2: t2.mediaTrust.podcast },
  ]

  const report = reportBySlug(TRIALS.report)!
  const context = reportContext(report, trialsText())
  const unmatched = TRIALS.tests.flatMap((t) => videoArms(t).filter((a) => !a.youtube).map((a) => a.name))
  const armN = Math.round(TRIALS.tests.flatMap((t) => t.arms).reduce((s, a) => s + a.n, 0) / TRIALS.tests.flatMap((t) => t.arms).length)
  const docs = REPORTS.map((r) => ({ slug: r.slug, title: r.title, publisher: r.publisher, date: r.date, summary: reportAbout(r.slug).summary, pages: r.pages.map((p) => ({ n: p.n, text: p.text })), context: reportContext(r, r.slug === TRIALS.report ? trialsText() : undefined) }))

  const rail = (
    <TabRail
      tabs={[
        { key: "tests", label: "Question 3 tests", href: "/polling" },
        { key: "archives", label: "Archives", href: "/polling?tab=archives", count: REPORTS.length },
      ]}
      active={tab}
    />
  )

  if (tab === "tests")
    return (
      <div className="flex flex-col">
        {rail}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <AskReport context={context} />
          <Link href={reportHref()} className="press flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-e1 transition-colors hover:border-pax2-light-blue hover:text-pax2-blue">
            Open the report
          </Link>
          <span className="text-xs text-slate-500">
            {TRIALS.fieldedBy} for {TRIALS.preparedBy} · {TRIALS.tests.map((t) => `${t.label} ${fieldDates(t)}`).join(" · ")}
          </span>
        </div>
        <BlockOrder page="polling-tests" initial={["prediction", "finder", "results", "gaps", "groups", "grid", "questions", "report"]}>
          <OrderedBlock id="prediction" label="Prediction against the trial">
            <TableBlock title="Prediction against the trial" more="/experiments" rows={TRIALS.tests.flatMap((t) => t.arms.filter((a) => a.pax2).map((a) => ({ test: t.label, video: a.name, youtube: a.youtube, trial_yes_lift: a.yes?.lift ?? null, trial_comprehension_lift: a.comprehension?.lift ?? null, views: a.pax2!.views, outlier_score: a.pax2!.outlier, resonance: a.pax2!.resonance, persuasion_score: a.pax2!.persuasion })))} name="prediction-vs-trial">
              <PredictionVsTrial tests={TRIALS.tests} />
            </TableBlock>
          </OrderedBlock>

          <OrderedBlock id="finder" label="Audience finder">
            <ChartBlock title="Audience finder" more={reportHref(TRIALS.tests[1].pages.pairings as number)}>
              <AudienceFinder tests={TRIALS.tests} />
            </ChartBlock>
          </OrderedBlock>

          <OrderedBlock id="results" label="Ballot support and comprehension">
            <TwoHalfBlock>
              {TRIALS.tests.map((t) => (
                <ChartBlock key={t.id} title={`${t.label} · ${fieldDates(t)}`} id={`polling-${t.id}`} more={reportHref(t.pages.summary as number)} rows={t.arms.map((a) => ({ video: a.name, n: a.n, yes_lift: a.yes?.lift ?? null, comprehension_lift: a.comprehension?.lift ?? null }))} name={t.id}>
                  <TestResults test={t} />
                </ChartBlock>
              ))}
            </TwoHalfBlock>
          </OrderedBlock>

          <OrderedBlock id="gaps" label="Open audiences">
            <TwoThirdBlock>
              <ListBlock title="Open audiences" className="xl:col-span-2" search="Search groups…">
                <Gaps tests={TRIALS.tests} />
              </ListBlock>
              <ChartBlock title="Detectable lift">
                <DetectableLift armN={armN} />
              </ChartBlock>
            </TwoThirdBlock>
          </OrderedBlock>

      <OrderedBlock id="groups" label="Question 3 by voter group">
        <TwoThirdBlock>
          <TableBlock title="Question 3 by voter group" className="xl:col-span-2" search="Search groups…" more={reportHref(t2.pages.subgroups instanceof Array ? t2.pages.subgroups[0] : undefined)} rows={groups.map((g) => ({ dimension: g.dimension, group: g.group, test1_yes: g.t1?.v ?? null, test2_yes: g.t2.v }))} name="question-3-groups">
            <div className="flex flex-col gap-3">
              <Source href={reportHref()}>
                {TRIALS.fieldedBy} placebo arms · {fieldDates(t1)} (n={t1.arms[0].n}) and {fieldDates(t2)} (n={t2.arms[0].n}) · MA adults, after the ballot explanation
              </Source>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60">
                    <TableHead className="w-[46%]">Group</TableHead>
                    <TableHead className="text-right">{t1.label} Yes</TableHead>
                    <TableHead className="text-right">{t2.label} Yes</TableHead>
                    <TableHead className="w-[28%]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-semibold text-slate-900">All adults</TableCell>
                    <TableCell className="tabular text-right text-slate-400">—</TableCell>
                    <TableCell className="tabular text-right font-semibold text-slate-900">{t2.placebo?.yes}%</TableCell>
                    <TableCell>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-above" style={{ width: `${t2.placebo?.yes ?? 0}%` }} />
                      </div>
                    </TableCell>
                  </TableRow>
                  {groups.map((g, i) => (
                    <TableRow key={`${g.dimension}-${g.group}`}>
                      <TableCell className="whitespace-normal">
                        <span className="font-medium text-slate-900">{g.group}</span>
                        <span className="ml-2 text-[11px] text-slate-400">{g.dimension}</span>
                      </TableCell>
                      <TableCell className={cn("tabular text-right text-slate-700", g.t1?.small && "italic opacity-70")}>{g.t1 ? `${g.t1.v}%` : "—"}</TableCell>
                      <TableCell className={cn("tabular text-right font-semibold text-slate-900", g.t2.small && "italic opacity-70")}>{g.t2.v}%</TableCell>
                      <TableCell>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className={cn("grow h-full rounded-full", g.t2.v >= 50 ? "bg-above" : "bg-below/80")} style={{ width: `${g.t2.v}%`, ["--i" as string]: i }} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <span className="text-[11px] italic text-slate-400">italic: under 50 responses</span>
            </div>
          </TableBlock>
          <ChartBlock title="Most trusted format" more={reportHref(t2.mediaTrust.page)} rows={trust} name="format-trust">
            <div className="flex flex-col gap-4">
              <Source href={reportHref(t2.mediaTrust.page)}>
                Asked before any video · {t1.weighted.toLocaleString()} and {t2.weighted.toLocaleString()} weighted
              </Source>
              <ul className="flex flex-col gap-4">
                {trust.map((x, i) => (
                  <li key={x.label} className="flex flex-col gap-1.5">
                    <span className="text-sm text-slate-700">{x.label}</span>
                    {[
                      [t1.label, x.t1],
                      [t2.label, x.t2],
                    ].map(([label, v], k) => (
                      <div key={label as string} className="grid grid-cols-[3.25rem_minmax(0,1fr)_3rem] items-center gap-2 text-xs">
                        <span className="text-slate-400">{label}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className={cn("grow h-full rounded-full", k ? "bg-pax2-blue" : "bg-pax2-light-blue")} style={{ width: `${v}%`, ["--i" as string]: i * 2 + k }} />
                        </div>
                        <span className="tabular text-right font-semibold text-slate-800">{Math.round(v as number)}%</span>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          </ChartBlock>
        </TwoThirdBlock>
      </OrderedBlock>

          <OrderedBlock id="grid" label="Video × voter group">
            <TrialGrid tests={TRIALS.tests} more={reportHref(TRIALS.tests[1].pages.pairings as number)} />
          </OrderedBlock>

          <OrderedBlock id="questions" label="Open questions">
            <ListBlock title="Open questions" more={reportHref(16)}>
              <OpenQuestions unmatched={unmatched} />
            </ListBlock>
          </OrderedBlock>

          <OrderedBlock id="report" label={report.title}>
            <ReportView bare slug={report.slug} title={report.title} pages={report.pages} context="" />
          </OrderedBlock>
        </BlockOrder>
      </div>
    )

  return (
    <div className="flex flex-col">
      {rail}
      <div className="mt-6">
        <ReportShelf docs={docs} />
      </div>
    <BlockOrder page="polling-archives" initial={["q3", "ballots", "uncontested"]}>
      <OrderedBlock id="q3" label="Top-Two Primary Elections Initiative (2026)">
        <ChartBlock title="Top-Two Primary Elections Initiative (2026)" rows={[{ yes: q.yes, no: q.no, undecided: q.undecided, refused: q.refused, pollster: q.pollster, sample: q.sample, field: q.field, moe: q.moe }]} name="question-3">
          <div className="flex flex-col gap-5">
            <div>
              <Source href={q.url}>
                {q.pollster} · {q.sample} · {q.field} · {q.moe}
              </Source>
            </div>
            <div className="flex h-12 overflow-hidden rounded-xl">
              <div className="grow flex items-center bg-above px-3 text-sm font-bold text-white" style={{ width: `${q.yes}%` }}>
                Yes {q.yes}%
              </div>
              <div className="grow flex items-center justify-center bg-slate-200 text-sm font-semibold text-slate-600" style={{ width: `${q.undecided + q.refused}%`, ["--i" as string]: 1 }}>
                {q.undecided}%
              </div>
              <div className="grow flex items-center justify-end bg-below px-3 text-sm font-bold text-white" style={{ width: `${q.no}%`, ["--i" as string]: 2 }}>
                No {q.no}%
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-4">
                <span className="tabular font-display text-3xl text-slate-900">{q.undecided}%</span>
                <span className="text-sm text-slate-600">undecided: the voters a script has to win</span>
              </div>
              <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-4">
                <span className="tabular font-display text-3xl text-slate-900">{polling.enrollment.unenrolled}%</span>
                <span className="text-sm text-slate-600">of registered voters belong to no party</span>
              </div>
              <div className="flex flex-col gap-1 rounded-xl bg-slate-50 p-4">
                <span className="tabular font-display text-3xl text-below">{unc.pct}%</span>
                <span className="text-sm text-slate-600">of legislative races uncontested, 2014–2022</span>
              </div>
            </div>
          </div>
        </ChartBlock>
      </OrderedBlock>

      <OrderedBlock id="ballots" label="On other ballots">
        <TwoThirdBlock>
          <ChartBlock title="On other ballots" className="xl:col-span-2" tools={<span className="text-xs text-slate-400">50% passes</span>} rows={votes.map((v) => ({ state: v.state, year: v.year, measure: v.measure, yes: v.yes, source: v.url }))} name="other-ballots">
            <div className="flex flex-col gap-3">
              <span className="text-sm font-semibold text-slate-900">Yes vote on open and top-two primaries</span>
              <ul className="flex flex-col gap-2.5">
                {votes.map((v, i) => {
                  const pass = v.yes >= 50
                  return (
                    <li key={`${v.state}-${v.year}`} className="grid grid-cols-[9.5rem_minmax(0,1fr)_3.5rem] items-center gap-3">
                      <a href={v.url} target="_blank" rel="noreferrer" className="flex flex-col leading-tight hover:text-pax2-light-blue">
                        <span className="text-sm font-medium text-slate-800">
                          {v.state} <span className="font-normal text-slate-400">{v.year}</span>
                        </span>
                        <span className="truncate text-[11px] text-slate-400">{v.measure}</span>
                      </a>
                      <div className="relative h-6 overflow-hidden rounded-md bg-slate-100">
                        <div className={cn("grow h-full rounded-md", pass ? "bg-above" : "bg-below/80")} style={{ width: `${v.yes}%`, ["--i" as string]: i }} />
                        <div className="absolute inset-y-0 left-1/2 w-px bg-slate-900/40" />
                      </div>
                      <span className={cn("tabular text-right text-sm font-semibold", pass ? "text-above" : "text-below")}>{v.yes.toFixed(1)}%</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </ChartBlock>
          <ChartBlock title="Nationally" rows={Object.entries(polling.national.byParty).map(([party, support]) => ({ party, support }))} name="national">
            <div className="flex h-full flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="tabular font-display text-5xl text-above">{polling.national.support}%</span>
                <span className="text-sm text-slate-600">back open primaries</span>
              </div>
              <ul className="flex flex-col gap-2">
                {Object.entries(polling.national.byParty).map(([p, n], i) => (
                  <li key={p} className="grid grid-cols-[6.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm">
                    <span className="text-slate-600">{p}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="grow h-full rounded-full bg-above" style={{ width: `${n}%`, ["--i" as string]: i }} />
                    </div>
                    <span className="tabular text-right font-semibold text-slate-800">{n}%</span>
                  </li>
                ))}
              </ul>
              <ul className="flex flex-col gap-2 border-t border-slate-100 pt-4">
                {polling.national.arguments.map((x) => (
                  <li key={x.text} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-slate-700">{x.text}</span>
                    <span className="tabular shrink-0 font-semibold text-slate-900">{x.agree}%</span>
                  </li>
                ))}
              </ul>
              <a href={polling.national.url} target="_blank" rel="noreferrer" className="mt-auto text-xs text-slate-400 hover:text-pax2-light-blue">
                Emerson · {polling.national.field}
              </a>
            </div>
          </ChartBlock>
        </TwoThirdBlock>
      </OrderedBlock>

      <OrderedBlock id="uncontested" label="Uncontested districts">
        <TwoThirdBlock>
          <MapBlock title="Uncontested districts" className="xl:col-span-2">
            <UncontestedMap height="100%" bare />
          </MapBlock>
          <ListBlock title="One name on the ballot" search="Search districts…" rows={oneName.map((district) => ({ district }))} name="uncontested-districts" actions={<Link href="/recording" className="press inline-flex w-fit items-center gap-2 rounded-full bg-pax2-blue px-4 py-1.5 text-sm font-semibold text-white shadow-e1"><Video className="size-4" /> Record</Link>}>
            <div className="flex flex-col gap-4">
              <div className="flex items-baseline gap-2">
                <span className="tabular font-display text-5xl text-below">{oneName.length}</span>
                <span className="text-sm text-slate-600">uncontested districts</span>
              </div>
              <div className="flex flex-wrap content-start gap-1.5">
                {oneName.map((d) => (
                  <span key={d} data-find className="rounded-full bg-pax2-red-soft px-2.5 py-1 text-xs font-medium text-pax2-red-deep">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </ListBlock>
        </TwoThirdBlock>
      </OrderedBlock>
    </BlockOrder>
    </div>
  )
}
