import Link from "next/link"

import { labelTrait } from "@/app/labeling/actions"
import { CardBlock, ListBlock } from "@/components/blocks"
import { ConsensusVote } from "@/components/consensus-vote"
import { WaveHero } from "@/components/wave-hero"
import { currentUser } from "@/lib/auth"
import { conversationOf, LABEL_VIDEOS, LABELING_WS, TRAITS } from "@/lib/labeling"
import { SOURCE_NOTE, TRAIT_DEFINITIONS } from "@/lib/trait-definitions"
import { votes } from "@/lib/review"
import { cn } from "@/ui/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: "Labeling" }

const STATEMENTS = TRAITS.map((t) => ({ tid: t.tid, text: `This video has: ${t.label.charAt(0).toLowerCase()}${t.label.slice(1)}.`, detail: TRAIT_DEFINITIONS[t.key] }))

/** People label the forty coded campaign shorts on Swayable's traits, one video at a time, so
 *  PAX2 Trait Labeler's codes can be measured against them. The model's own codes stay hidden. */
export default async function LabelingPage({ searchParams }: { searchParams: Promise<{ i?: string }> }) {
  const user = await currentUser()
  if (!user) return <WaveHero next="/labeling" />
  const n = LABEL_VIDEOS.length
  const i = Math.min(n - 1, Math.max(0, Number((await searchParams).i) || 0))
  const v = LABEL_VIDEOS[i]
  const mine = await Promise.all(LABEL_VIDEOS.map(async (x) => new Set((await votes(LABELING_WS, conversationOf(x.id))).filter((r) => r.voter === user.email).map((r) => r.tid))))
  const finished = mine.filter((s) => TRAITS.every((t) => s.has(t.tid))).length
  const nav = (to: number, label: string) => (
    <Link href={`/labeling?i=${to}`} aria-disabled={to < 0 || to >= n} className={cn("rounded-full border px-4 py-2 text-sm font-medium text-pax2-blue", (to < 0 || to >= n) && "pointer-events-none opacity-40")}>
      {label}
    </Link>
  )
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-slate-900">Labeling</h1>
        <span className="tabular text-sm text-slate-600">
          {finished} of {n} videos finished
        </span>
      </div>
      <div className="grid gap-6 @3xl:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-4">
          <div className="aspect-[9/16] w-full max-w-[320px] overflow-hidden rounded-2xl bg-slate-900 shadow-e2">
            <iframe src={`https://www.youtube.com/embed/${v.yt}`} title={v.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="size-full border-0" />
          </div>
          <div className="flex items-center gap-2">
            {nav(i - 1, "Previous")}
            <span className="tabular px-2 text-sm text-slate-500">
              {i + 1} / {n}
            </span>
            {nav(i + 1, "Next")}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <CardBlock title={v.title} height="auto" footer={[v.channel, SOURCE_NOTE].filter(Boolean).join(" · ")}>
            <ConsensusVote key={v.id} slug={conversationOf(v.id)} statements={STATEMENTS} voted={{ [user.email]: [...mine[i]] }} voter={user.email} cast={labelTrait} finished="Every trait judged for this video." />
          </CardBlock>
          <ListBlock title="Transcript" height="auto">
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{v.transcript ?? "No transcript."}</p>
          </ListBlock>
        </div>
      </div>
    </div>
  )
}
