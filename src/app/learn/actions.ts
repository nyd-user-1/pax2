"use server"

import { logUsage } from "@/app/usage-actions"
import { currentUser } from "@/lib/auth"
import { answers, assignment, chapterDone, CHAPTERS, COURSE, markOnce, revealRows, type RevealRow } from "@/lib/course"
import { conversationOf, LABELING_WS, TRAITS } from "@/lib/labeling"
import { recordVote } from "@/lib/review"

/** One person's call on one trait of one video, under their signed-in email. */
export async function labelTrait(conversation: string, tid: number, vote: 1 | -1 | 0) {
  const user = await currentUser()
  if (!user) throw new Error("Sign in to label.")
  if (!/^traits-[\w-]+$/.test(conversation) || !TRAITS.some((t) => t.tid === tid)) throw new Error("No such trait.")
  await recordVote(LABELING_WS, conversation, user.email, tid, vote)
}


/** The learner opens a chapter's questions. */
export async function startChapter(n: number) {
  if (!(await currentUser())) return
  if (CHAPTERS.some((c) => c.n === n)) await logUsage("chapter-start", COURSE, { course: COURSE, chapter: n })
}

/** The reveal for a chapter the learner has answered in full. `given` carries the answers this
 *  page just cast, in case the ledger's read lags the write; the ledger's own answers come first. */
export async function finishChapter(n: number, given: Record<string, 1 | -1 | 0>): Promise<RevealRow[]> {
  const user = await currentUser()
  if (!user) throw new Error("Sign in to take the course.")
  const chapter = CHAPTERS.find((c) => c.n === n)
  if (!chapter) throw new Error("No such chapter.")
  const { videoId } = await assignment(user.email)
  const a = await answers(user.email, videoId)
  for (const k of chapter.keys) if (!(k in a) && [1, -1, 0].includes(given[k])) a[k] = given[k]
  if (!chapterDone(a, n)) throw new Error("Answer all seven first.")
  if (await markOnce(user.email, "chapter", n)) await logUsage("chapter-finish", COURSE, { course: COURSE, chapter: n })
  return revealRows(videoId, chapter.keys, a)
}
