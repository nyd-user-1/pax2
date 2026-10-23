import { redirect } from "next/navigation"

import { ChartBlock, ListBlock, TwoHalfBlock } from "@/components/blocks"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { TestResults } from "@/components/trials/test-results"
import { TrialGrid } from "@/components/trials/trial-grid"
import { currentUser } from "@/lib/auth"
import { fieldDates, reportHref, TRIALS } from "@/lib/trials"

export const metadata = { title: "Experiments" }

// Randomized message tests: each respondent saw one video or the placebo video, then said how they would
// vote and what the measure does. The data and its checks: scripts/trials/ma-q3.mjs.
export default async function ExperimentsPage() {
  if (!(await currentUser())) redirect("/signin?next=/experiments")
  const [t1, t2] = TRIALS.tests
  const o = TRIALS.outcomes
  return (
    <BlockOrder page="experiments" initial={["results", "grid", "questions"]}>
      <OrderedBlock id="results" label="Ballot support and comprehension">
        <TwoHalfBlock>
          {[t1, t2].map((t) => (
            <ChartBlock key={t.id} title={`${t.label} · ${fieldDates(t)}`} id={t.id} more={reportHref(t.pages.summary as number)} rows={t.arms.map((a) => ({ video: a.name, n: a.n, yes_lift: a.yes?.lift ?? null, yes_marked: a.yes?.sig ?? null, comprehension_lift: a.comprehension?.lift ?? null, comprehension_marked: a.comprehension?.sig ?? null }))} name={t.id}>
              <TestResults test={t} />
            </ChartBlock>
          ))}
        </TwoHalfBlock>
      </OrderedBlock>

      <OrderedBlock id="grid" label="Video × voter group">
        <TrialGrid tests={TRIALS.tests} more={reportHref(t2.pages.pairings as number)} />
      </OrderedBlock>

      <OrderedBlock id="questions" label="Questions asked">
        <ListBlock title="Questions asked" more={reportHref(t2.pages.method as number)}>
          <dl className="flex flex-col gap-4 text-sm">
            <div data-find className="flex flex-col gap-1">
              <dt className="font-semibold text-slate-900">{o.yes.label}</dt>
              <dd className="text-slate-700">{o.yes.question}</dd>
              <dd className="text-xs text-slate-500">{o.yes.definition}.</dd>
            </div>
            <div data-find className="flex flex-col gap-1">
              <dt className="font-semibold text-slate-900">{o.comprehension.label}</dt>
              <dd className="text-slate-700">{o.comprehension.question}</dd>
              <dd className="text-slate-700">
                <span className="text-xs font-semibold text-above">Correct</span> {o.comprehension.answer}
              </dd>
              <dd className="text-xs text-slate-500">{o.comprehension.definition}.</dd>
            </div>
            <div data-find className="flex flex-col gap-1 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <span>
                {TRIALS.measure}. {TRIALS.population}. Fielded by {TRIALS.fieldedBy} for {TRIALS.preparedBy}; threshold {TRIALS.threshold}.
              </span>
            </div>
          </dl>
        </ListBlock>
      </OrderedBlock>
    </BlockOrder>
  )
}
