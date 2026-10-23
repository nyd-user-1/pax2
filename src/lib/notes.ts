import "server-only"

import { get, put, query, remove, type Item } from "@/lib/ledger"

// A reader's notes on a video (the video page's Notes tab), kept in the ledger table (DynamoDB) like the
// chats, rewritten in place:
//
//   pk              sk          item
//   NOTES#<reader>  <note id>   videoId, title, bodyMd (markdown), createdAt, updatedAt

export type Note = { id: string; videoId: string; title: string; bodyMd: string; createdAt: string; updatedAt: string }

type Row = Item & Omit<Note, "id">

const noteOf = (r: Row): Note => ({ id: r.sk, videoId: r.videoId, title: r.title, bodyMd: r.bodyMd, createdAt: r.createdAt, updatedAt: r.updatedAt })

// DynamoDB refuses an item over 400 KB.
const MAX_BYTES = 350_000

/** The reader's notes on one video, newest edit first. */
export async function listNotes(who: string, videoId: string): Promise<Note[]> {
  return (await query<Row>(`NOTES#${who}`))
    .filter((r) => r.videoId === videoId)
    .map(noteOf)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function readNote(who: string, id: string): Promise<Note | null> {
  const r = await get<Row>(`NOTES#${who}`, id)
  return r ? noteOf(r) : null
}

export async function writeNote(who: string, id: string, videoId: string, patch: { title: string; bodyMd: string }): Promise<Note> {
  const prev = await get<Row>(`NOTES#${who}`, id)
  const at = new Date().toISOString()
  const row: Row = { pk: `NOTES#${who}`, sk: id, videoId: prev?.videoId ?? videoId, title: patch.title.slice(0, 200), bodyMd: patch.bodyMd.slice(0, MAX_BYTES), createdAt: prev?.createdAt ?? at, updatedAt: at }
  await put(row)
  return noteOf(row)
}

export async function deleteNote(who: string, id: string) {
  await remove(`NOTES#${who}`, id)
}
