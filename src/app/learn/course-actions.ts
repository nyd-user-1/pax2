"use server"

import { logUsage } from "@/app/usage-actions"
import { currentUser } from "@/lib/auth"
import { markOnce } from "@/lib/course"
import { chapterResult, courseById, myAnswers, rounds, saveAnswer, validAnswer, type Answer, type Result } from "@/lib/courses"

async function chapterOf(courseId: string, n: number) {
  const user = await currentUser()
  if (!user) throw new Error("Sign in to take the course.")
  const course = courseById(courseId)
  if (!course || !course.chapters[n - 1]) throw new Error("No such chapter.")
  return { email: user.email, course, rs: rounds(user.email, course, n) }
}

/** One answer to one round of a learner's own exercise. */
export async function answerRound(courseId: string, n: number, roundId: string, answer: Answer) {
  const { email, course, rs } = await chapterOf(courseId, n)
  const r = rs.find((x) => x.id === roundId)
  if (!r || !validAnswer(r, answer)) throw new Error("That answer does not fit the round.")
  await saveAnswer(email, course.id, n, r, answer)
}

export async function startCourseChapter(courseId: string, n: number) {
  if (!(await currentUser()) || !courseById(courseId)) return
  await logUsage("chapter-start", courseId, { course: courseId, chapter: n })
}

/** The result of a finished exercise. `given` carries the answers this page just wrote, in case the
 *  read lags the write; the ledger's own answers come first. Finishing chapter four with the others
 *  done finishes the course. */
export async function finishCourseChapter(courseId: string, n: number, given: Record<string, Answer>): Promise<Result> {
  const { email, course, rs } = await chapterOf(courseId, n)
  const a = await myAnswers(email, course.id, n)
  for (const r of rs) if (!(r.id in a) && validAnswer(r, given[r.id])) a[r.id] = given[r.id]
  if (!rs.every((r) => r.id in a)) throw new Error("Answer every round first.")
  if (await markOnce(email, "chapter", n, course.id)) await logUsage("chapter-finish", course.id, { course: course.id, chapter: n })
  if (n === course.chapters.length) {
    const others = await Promise.all(course.chapters.slice(0, -1).map(async (c) => {
      const mine = await myAnswers(email, course.id, c.n)
      return rounds(email, course, c.n).every((r) => r.id in mine)
    }))
    if (others.every(Boolean) && (await markOnce(email, "finished", n, course.id))) await logUsage("course-finish", course.id, { course: course.id, chapter: n })
  }
  return chapterResult(course, n, rs, a)
}
