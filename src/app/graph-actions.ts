"use server"

import { currentUser } from "@/lib/auth"
import { canvasKind, type CanvasRow, type CanvasState } from "@/lib/graph-data"
import { get, now, putOnce, query, type Item } from "@/lib/ledger"
import { workspace } from "@/lib/review"

// The /graph workspace's server side: files dropped on the canvas go straight to S3 by presigned
// PUT under canvas/<workspace>/, and saved canvases live in the ledger, append-only:
//
//   pk          sk          item
//   VIEW#<id>   V#<iso>     one saved version: name, saver, kind, the canvas state
//   VIEWS       <id>        the index row, written on the first save
//
// The latest version of a canvas is its newest sk. Recipes are for admins only: never listed,
// loaded or saved for anyone else.

const BUCKET = process.env.PAX2_BUCKET ?? "pax-2-638175140432"
const REGION = process.env.PAX2_REGION ?? "us-east-1"
const MAX_STATE = 350_000 // bytes of JSON; a ledger item holds 400 KB

const prefix = async () => `canvas/${await workspace()}/`

export async function canvasUploadUrl(name: string, type: string) {
  if (!(await currentUser())) throw new Error("Sign in to drop files on the canvas.")
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3")
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner")
  const safe = name.replace(/[^\w.-]+/g, "-").replace(/^-+/, "").slice(-120) || "file"
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const key = `${await prefix()}${id}-${safe}`
  const s3 = new S3Client({ region: REGION })
  const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: type || "application/octet-stream" }), { expiresIn: 900 })
  return { key, url }
}

export type CanvasFile = { key: string; name: string; size: number; modified: string | null }

export async function listCanvasFiles(): Promise<CanvasFile[]> {
  if (!(await currentUser())) return []
  const { S3Client, ListObjectsV2Command } = await import("@aws-sdk/client-s3")
  const s3 = new S3Client({ region: REGION })
  const p = await prefix()
  const out: CanvasFile[] = []
  let token: string | undefined
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: p, ContinuationToken: token }))
    for (const o of r.Contents ?? []) {
      if (!o.Key) continue
      out.push({ key: o.Key, name: o.Key.slice(p.length).replace(/^[a-z0-9]+-/, ""), size: o.Size ?? 0, modified: o.LastModified?.toISOString() ?? null })
    }
    token = r.IsTruncated ? r.NextContinuationToken : undefined
  } while (token && out.length < 2000)
  return out.sort((a, b) => (b.modified ?? "").localeCompare(a.modified ?? ""))
}

type Version = Item & { name: string; by: string; kind: CanvasRow["kind"]; at: string; state: CanvasState }

const latest = async (id: string) => (await query<Version>(`VIEW#${id}`, "V#")).at(-1) ?? null

export async function saveCanvas(input: { id?: string; name: string; state: CanvasState }): Promise<CanvasRow> {
  const user = await currentUser()
  if (!user) throw new Error("Sign in to save a canvas.")
  const name = input.name.trim().slice(0, 120)
  if (!name) throw new Error("Name the canvas.")
  const state = input.state
  if (!Array.isArray(state?.nodes) || !Array.isArray(state?.edges)) throw new Error("Nothing to save.")
  if (JSON.stringify(state).length > MAX_STATE) throw new Error("This canvas is too large to save.")
  const kind = canvasKind(state)
  if (kind === "recipe" && !user.admin) throw new Error("Recipes are for admins.")
  // Saving again appends a version to the same canvas; someone else's canvas forks to a new one.
  let id = input.id && /^[\w-]{1,64}$/.test(input.id) ? input.id : undefined
  if (id) {
    const head = await get<Item & { by: string }>("VIEWS", id)
    if (head && head.by !== user.email && !user.admin) id = undefined
  }
  id ??= `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const at = now()
  await putOnce({ pk: `VIEW#${id}`, sk: `V#${at}`, name, by: user.email, kind, at, state })
  await putOnce({ pk: "VIEWS", sk: id, name, by: user.email, kind, at })
  return { id, name, by: user.email, kind, at, nodes: state.nodes.length }
}

export async function listCanvases(): Promise<CanvasRow[]> {
  const user = await currentUser()
  const index = await query<Item>("VIEWS")
  // The latest version decides the kind: a view can become a recipe and back.
  const rows = await Promise.all(index.map(async (i) => {
    const v = await latest(i.sk)
    if (!v || (v.kind === "recipe" && !user?.admin)) return null
    return { id: i.sk, name: v.name, by: v.by, kind: v.kind, at: v.at, nodes: v.state?.nodes?.length ?? 0 } satisfies CanvasRow
  }))
  return rows.filter((r): r is CanvasRow => !!r).sort((a, b) => b.at.localeCompare(a.at))
}

export async function loadCanvas(id: string): Promise<CanvasRow & { state: CanvasState }> {
  const user = await currentUser()
  const v = /^[\w-]{1,64}$/.test(id) ? await latest(id) : null
  if (!v || (v.kind === "recipe" && !user?.admin)) throw new Error("Canvas not found.")
  return { id, name: v.name, by: v.by, kind: v.kind, at: v.at, nodes: v.state.nodes.length, state: v.state }
}
