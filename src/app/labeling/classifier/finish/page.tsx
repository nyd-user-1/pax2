import Link from "next/link"
import { redirect } from "next/navigation"

import { logUsage } from "@/app/usage-actions"
import { agrees } from "@/components/course-reveal"
import { WaveHero } from "@/components/wave-hero"
import { currentUser } from "@/lib/auth"
import { answers, assignment, chapterDone, CHAPTERS, COURSE, labelersByVideo, markOnce, revealRows } from "@/lib/course"

export const dynamic = "force-dynamic"
export const metadata = { title: "The Classifier" }

/** The end of the Classifier course: the learner against the classifier on all twenty-eight. */
export default async function ClassifierFinishPage() {
  const user = await currentUser()
  if (!user) return <WaveHero next="/labeling/classifier/finish" />
  const { videoId } = await assignment(user.email)
  const a = await answers(user.email, videoId)
  if (!CHAPTERS.every((c) => chapterDone(a, c.n))) redirect("/labeling/classifier")
  if (await markOnce(user.email, "finished", CHAPTERS.length)) await logUsage("course-finish", COURSE, { course: COURSE, chapter: CHAPTERS.length })
  const rows = revealRows(videoId, CHAPTERS.flatMap((c) => c.keys), a)
  const agreed = rows.filter(agrees).length
  const passed = rows.filter((r) => r.answer === 0).length
  const labelers = (await labelersByVideo()).get(videoId) ?? 1
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl text-slate-900">The Classifier</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1 rounded-2xl border bg-card p-6">
          <span className="tabular font-display text-4xl text-pax2-blue">
            {agreed} of {rows.length}
          </span>
          <span className="text-sm text-slate-600">traits on which the learner and the classifier agreed{passed ? `; ${passed} passed` : ""}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border bg-card p-6">
          <span className="tabular font-display text-4xl text-pax2-blue">{labelers}</span>
          <span className="text-sm text-slate-600">{labelers === 1 ? "person has labeled this video" : "people have labeled this video"}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href={`/v/${videoId}`} className="press rounded-full bg-pax2-blue px-6 py-3 font-medium text-white">
          The video
        </Link>
        <Link href="/labeling" className="rounded-full border px-6 py-3 font-medium text-pax2-blue">
          Teach a Model
        </Link>
      </div>
    </div>
  )
}
