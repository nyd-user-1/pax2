"use server"

import { currentUser } from "@/lib/auth"
import { conversationOf, LABELING_WS, TRAITS } from "@/lib/labeling"
import { recordVote } from "@/lib/review"

/** One person's call on one trait of one video, under their signed-in email. */
export async function labelTrait(conversation: string, tid: number, vote: 1 | -1 | 0) {
  const user = await currentUser()
  if (!user) throw new Error("Sign in to label.")
  if (!/^traits-[\w-]+$/.test(conversation) || !TRAITS.some((t) => t.tid === tid)) throw new Error("No such trait.")
  await recordVote(LABELING_WS, conversation, user.email, tid, vote)
}

