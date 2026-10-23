"use server"

import { currentUser } from "@/lib/auth"
import { listChats, patchChat, readChat, writeChat, type ChatMessage, type ChatMeta } from "@/lib/chats"

// The reader's saved /chat conversations. Signed out, or on a shared demo account, nothing is kept:
// a demo login is one account for every visitor, so its chats would be everyone's.

async function reader(): Promise<string | null> {
  const u = await currentUser()
  return u && !u.demo ? u.email : null
}

const ID = /^[\w-]{8,64}$/

export async function myChats(): Promise<ChatMeta[]> {
  const who = await reader()
  return who ? listChats(who) : []
}

export async function saveChat(id: string, messages: ChatMessage[]): Promise<ChatMeta | null> {
  const who = await reader()
  if (!who || !ID.test(id) || messages.length === 0) return null
  const clean = messages.map((m) => ({ id: String(m.id), role: m.role === "user" ? ("user" as const) : ("assistant" as const), content: String(m.content ?? ""), ...(m.model ? { model: String(m.model) } : {}) }))
  return writeChat(who, id, clean)
}

export async function updateChat(id: string, patch: { title?: string; favorite?: boolean; pinned?: boolean; hidden?: boolean; archived?: boolean }): Promise<ChatMeta | null> {
  const who = await reader()
  if (!who || !ID.test(id)) return null
  const p: typeof patch = {}
  if (typeof patch.title === "string") p.title = patch.title.slice(0, 120)
  for (const k of ["favorite", "pinned", "hidden", "archived"] as const) if (typeof patch[k] === "boolean") p[k] = patch[k]
  return patchChat(who, id, p)
}

/** For the /chat page's server render. */
export async function openChat(id: string) {
  const who = await reader()
  return who && ID.test(id) ? readChat(who, id) : null
}

/** The evidence behind a chat script's citations, by id (unknown ids left out), and every fact a
 *  script may state, so the panel can mark a number that is in none of them. */
export async function citeEvidence(ids: string[]) {
  const { scriptEvidence } = await import("@/lib/script-evidence")
  const want = new Set(ids.slice(0, 200))
  const all = scriptEvidence()
  return {
    cites: Object.fromEntries(all.filter((e) => want.has(e.id)).map((e) => [e.id, e.cite])),
    facts: all.filter((e) => e.kind === "fact").map((e) => e.cite.finding),
  }
}
