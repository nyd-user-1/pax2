import Link from "next/link"
import { notFound } from "next/navigation"

import { logUsage } from "@/app/usage-actions"
import { CourseExercise } from "@/components/course-exercise"
import { WaveHero } from "@/components/wave-hero"
import { currentUser } from "@/lib/auth"
import { markOnce } from "@/lib/course"
import { chapterResult, courseById, myAnswers, rounds } from "@/lib/courses"
import { cn } from "@/ui/lib/utils"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ course: string }> }) {
  return { title: courseById((await params).course)?.title ?? "Teach a Model" }
}

/** One of Teach a Model's courses past the Classifier: four chapters, each a lesson and an exercise. */
export default async function CoursePage({ params, searchParams }: { params: Promise<{ course: string }>; searchParams: Promise<{ c?: string }> }) {
  const course = courseById((await params).course)
  if (!course) notFound()
  const user = await currentUser()
  if (!user) return <WaveHero next={`/labeling/${course.id}`} />
  if (await markOnce(user.email, "started", 0, course.id)) await logUsage("course-start", course.id, { course: course.id, chapter: 1 })
  const all = await Promise.all(course.chapters.map(async (c) => {
    const rs = rounds(user.email, course, c.n)
    const a = await myAnswers(user.email, course.id, c.n)
    return { rs, a, done: rs.every((r) => r.id in a) }
  }))
  const reached = (all.findIndex((c) => !c.done) + 1) || course.chapters.length
  const n = Math.min(reached, Math.max(1, Number((await searchParams).c) || reached))
  const { rs, a, done } = all[n - 1]
  const chapter = course.chapters[n - 1]
  const next = n < course.chapters.length ? { href: `/labeling/${course.id}?c=${n + 1}`, label: "Next chapter" } : { href: "/labeling", label: "Finish" }
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl text-slate-900">{course.title}</h1>
      <nav className="grid grid-cols-4 gap-1.5">
        {course.chapters.map((c, i) => {
          const open = c.n === n
          return (
            <Link key={c.n} href={`/labeling/${course.id}?c=${c.n}`} aria-current={open ? "step" : undefined} aria-disabled={c.n > reached} className={cn("flex flex-col gap-1.5 text-xs", c.n > reached && "pointer-events-none opacity-40")}>
              <span className={cn("h-1 rounded-full", open ? "bg-pax2-blue" : all[i].done ? "bg-pax2-light-blue" : "bg-slate-200")} />
              <span className={cn("truncate", open ? "font-semibold text-pax2-blue" : "text-slate-500")}>
                {c.n}. {c.title}
              </span>
            </Link>
          )
        })}
      </nav>
      <section className="flex min-w-0 max-w-3xl flex-col gap-4">
        <h2 className="font-display text-2xl text-pax2-blue">{chapter.title}</h2>
        <CourseExercise key={`${course.id}-${n}`} course={course.id} n={n} lesson={chapter.lesson} rounds={rs} given={a} result={done ? chapterResult(course, n, rs, a) : null} next={next} />
      </section>
    </div>
  )
}
