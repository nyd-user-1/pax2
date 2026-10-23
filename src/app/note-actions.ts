"use server"

import { currentUser } from "@/lib/auth"
import { deleteNote, listNotes, readNote, writeNote, type Note } from "@/lib/notes"

// The reader's notes on a video, from the Notes tab and its note window. Signed out, or on a shared demo
// account, nothing is kept: a demo login is one account for every visitor, so its notes would be everyone's.

async function reader(): Promise<string | null> {
  const u = await currentUser()
  return u && !u.demo ? u.email : null
}

const YT = /^[\w-]{11}$/
const ID = /^[\w-]{8,64}$/

/** First non-empty line of the markdown, its syntax stripped: the note's title. */
const titleOf = (md: string) =>
  (md.split("\n").map((l) => l.replace(/^[#>\-*+\s]+|\d+\.\s+/g, "").replace(/[*_`]/g, "").trim()).find(Boolean) ?? "Untitled note").slice(0, 120)

export async function videoNotes(ytId: string): Promise<{ notes: Note[]; kept: boolean }> {
  const who = await reader()
  if (!who || !YT.test(ytId)) return { notes: [], kept: !!who }
  return { notes: await listNotes(who, ytId), kept: true }
}

export async function createNote(ytId: string): Promise<Note | null> {
  const who = await reader()
  if (!who || !YT.test(ytId)) return null
  return writeNote(who, crypto.randomUUID(), ytId, { title: "Untitled note", bodyMd: "" })
}

export async function openNote(id: string): Promise<Note | null> {
  const who = await reader()
  if (!who || !ID.test(id)) return null
  return readNote(who, id)
}

export async function saveNote(id: string, bodyMd: string): Promise<Note | null> {
  const who = await reader()
  if (!who || !ID.test(id)) return null
  const prev = await readNote(who, id)
  if (!prev) return null
  return writeNote(who, id, prev.videoId, { title: titleOf(bodyMd), bodyMd: String(bodyMd) })
}

export async function removeNote(id: string): Promise<boolean> {
  const who = await reader()
  if (!who || !ID.test(id)) return false
  await deleteNote(who, id)
  return true
}
