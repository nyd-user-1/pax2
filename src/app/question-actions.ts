"use server"

import { chipsFor, resolveQuestion, type Answer, type ChipOffer, type Surface } from "@/lib/question-resolver"

// The question bank's chips and answers, from the browser to the stored measurements. No model call.

const YT = /^[\w-]{11}$/

/** The chips for a video on a surface, drawn fresh; `exclude` holds the chips already tapped this session. */
export async function chipOffers(ytId: string, surface: Surface, exclude: string[] = []): Promise<ChipOffer[]> {
  if (!YT.test(ytId) || (surface !== "video-panel" && surface !== "chat")) return []
  return chipsFor(ytId, surface, exclude.slice(0, 60).map(String))
}

/** One chip's answer for a video. */
export async function answerChip(questionId: string, ytId: string): Promise<Answer | null> {
  if (!YT.test(ytId)) return null
  return resolveQuestion(String(questionId), ytId)
}
