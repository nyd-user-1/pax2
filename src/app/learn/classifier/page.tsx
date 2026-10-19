import Link from "next/link"

import { logUsage } from "@/app/usage-actions"
import { ListBlock } from "@/components/blocks"
import { CourseChapter } from "@/components/course-chapter"
import { WaveHero } from "@/components/wave-hero"
import { currentUser } from "@/lib/auth"
import { answers, assignment, chapterDone, chapterOrder, CHAPTERS, COURSE, courseVideo, markOnce, revealRows, tidOf } from "@/lib/course"
import { LESSONS } from "@/lib/course-lessons"
import { conversationOf, TRAITS } from "@/lib/labeling"
import { SOURCE_NOTE, TRAIT_DEFINITIONS, TRAIT_NAMES } from "@/lib/trait-definitions"
import { cn } from "@/ui/lib/utils"

export const dynamic = "force-dynamic"
export const metadata = { title: "The Classifier" }

/** Teach a Model, the Classifier: one video for the whole course, four chapters of seven traits. */
export default async function ClassifierCoursePage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const user = await currentUser()
  if (!user) return <WaveHero next="/learn/classifier" />
  const { videoId, fresh } = await assignment(user.email)
  if (fresh) await logUsage("course-start", COURSE, { course: COURSE, chapter: 1 })
  const v = courseVideo(videoId)!
  const a = await answers(user.email, videoId)
  // The open chapter: the one asked for, if the learner has reached it; otherwise the first unfinished.
  const reached = CHAPTERS.find((c) => !chapterDone(a, c.n))?.n ?? CHAPTERS.length
  const n = Math.min(reached, Math.max(1, Number((await searchParams).c) || reached))
  const chapter = CHAPTERS[n - 1]
  const done = chapterDone(a, n)
  if (done && (await markOnce(user.email, "chapter", n))) await logUsage("chapter-finish", COURSE, { course: COURSE, chapter: n })
  const statements = chapterOrder(user.email, videoId, n).map((key) => {
    const label = TRAITS.find((t) => t.key === key)!.label
    return { tid: tidOf(key), key, text: `This video has: ${label.charAt(0).toLowerCase()}${label.slice(1)}.`, detail: TRAIT_DEFINITIONS[key], label: TRAIT_NAMES[key] }
  })
  const given = Object.fromEntries(chapter.keys.filter((k) => k in a).map((k) => [k, a[k]]))
  const next = n < CHAPTERS.length ? { href: `/learn/classifier?c=${n + 1}`, label: "Next chapter" } : { href: "/learn/classifier/finish", label: "Finish" }
  return (
    <div className="flex flex-col gap-6">
      <nav className="grid grid-cols-4 gap-1.5">
        {CHAPTERS.map((c) => {
          const open = c.n === n
          const finished = chapterDone(a, c.n)
          const cls = cn("flex flex-col gap-1.5 text-xs", c.n > reached && "pointer-events-none opacity-40")
          const bar = <span className={cn("h-1 rounded-full", open ? "bg-pax2-blue" : finished ? "bg-pax2-light-blue" : "bg-slate-200")} />
          return (
            <Link key={c.n} href={`/learn/classifier?c=${c.n}`} aria-current={open ? "step" : undefined} aria-disabled={c.n > reached} className={cls}>
              {bar}
              <span className={cn("truncate", open ? "font-semibold text-pax2-blue" : "text-slate-500")}>
                {c.n}. {c.title}
              </span>
            </Link>
          )
        })}
      </nav>
      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="aspect-[9/16] w-full max-w-[320px] overflow-hidden rounded-2xl bg-slate-900 shadow-e2">
            <iframe src={`https://www.youtube.com/embed/${v.yt}`} title={v.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="size-full border-0" />
          </div>
          <ListBlock title="Transcript" height="auto">
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{v.transcript ?? "No transcript."}</p>
          </ListBlock>
        </div>
        <section className="flex min-w-0 flex-col gap-4">
          <h2 className="font-display text-2xl text-pax2-blue">{chapter.title}</h2>
          <CourseChapter key={n} n={n} lesson={LESSONS[n]} slug={conversationOf(videoId)} voter={user.email} statements={statements} given={given} voted={{ [user.email]: Object.keys(given).map(tidOf) }} reveal={done ? revealRows(videoId, chapter.keys, a) : null} next={next} note={SOURCE_NOTE} />
        </section>
      </div>
    </div>
  )
}
