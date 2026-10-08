"use server"

import { revalidatePath } from "next/cache"

import { currentUser, requireAdmin } from "@/lib/auth"
import { evaluate } from "@/lib/evaluate"
import { ADMINS, layout, send, SITE } from "@/lib/mail"
import { addEvent, createOriginal, latestEvaluation, originalRow, type OriginalRow } from "@/lib/originals"
import { addToWatch } from "@/lib/velocity-store"

// Every step of an original video's way from the recording to the wild. Admin-only steps check the
// session themselves; the owner's one choice (publish as is) checks that the caller owns the video.

const link = (id: string, tab?: string) => `${SITE}/v/${id}${tab ? `?tab=${tab}` : ""}`
const refresh = (id: string) => {
  revalidatePath(`/v/${id}`)
  for (const p of ["/recording", "/scoring", "/publishing"]) revalidatePath(p)
}

async function must(id: string): Promise<OriginalRow> {
  const row = await originalRow(id)
  if (!row) throw new Error("No such video.")
  return row
}

export async function viewer() {
  return currentUser()
}

/** The script and messenger of a video being re-recorded, for its owner (or an admin). */
export async function againDraft(id: string) {
  const user = await currentUser()
  const row = await originalRow(id)
  if (!row || !user || (user.email !== row.owner && !user.admin)) return null
  return { title: row.title, text: row.text, name: row.name, role: row.role, town: row.town }
}

/** A recording lands. It is scored straight away when automatic scoring is on (HERMES_AUTOSCORE=1);
 *  otherwise it waits on /recording for an admin to press Score. */
export async function submitOriginal(input: { id: string; key: string; email?: string; scriptId?: string; title?: string; text?: string; name?: string; role?: string; town?: string; seconds: number; consent: boolean; parent?: string }) {
  const user = await currentUser()
  const owner = (user?.email ?? input.email ?? "").trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(owner)) throw new Error("An email address is needed, so Hermes can send the link.")
  const parent = input.parent ? await originalRow(input.parent) : null
  await createOriginal({ id: input.id, owner, key: input.key, version: parent ? parent.version + 1 : 1, parent: parent?.id, title: input.title, text: input.text, name: input.name, role: input.role, town: input.town, seconds: input.seconds, consent: input.consent })
  if (parent) await addEvent(parent.id, { kind: "replaced", by: owner, child: input.id })
  if (process.env.HERMES_AUTOSCORE === "1") await score(input.id)
  refresh(input.id)
  return { ok: true }
}

async function score(id: string) {
  const row = await must(id)
  const evaluation = await evaluate(row)
  await addEvent(id, { kind: "scored", by: "hermes", evaluation })
  const body = layout({
    heading: "Original Content ready for review",
    paragraphs: [`${row.title ?? "A new video"}${row.name ? `, recorded by ${row.name}` : ""}${row.version > 1 ? ` (version ${row.version})` : ""}, has been scored.`, evaluation.summary],
    buttons: [{ label: "Review it", href: link(id, "scored") }],
  })
  await send(ADMINS, "Original Content ready for review", body, id)
}

export async function scoreOriginal(id: string) {
  await requireAdmin()
  await score(id)
  refresh(id)
}

export async function saveNote(id: string, note: string) {
  const admin = await requireAdmin()
  if (note.trim()) await addEvent(id, { kind: "note", by: admin.email, note: note.trim() })
  refresh(id)
}

async function publish(row: OriginalRow, by: string) {
  // The Hermes channels don't exist yet: each destination is recorded and waits for its link.
  await addEvent(row.id, { kind: "published", by, destinations: ["YouTube", "TikTok", "Instagram"].map((platform) => ({ platform, url: null })) })
  const body = layout({
    heading: "Your video is published",
    paragraphs: [`${row.title ?? "Your video"} is going out on the Hermes channels. Hermes will watch how it does in its first days and show it on the video's page.`],
    buttons: [{ label: "See your video", href: link(row.id, "published") }],
  })
  await send([row.owner], "Your video is published", body, row.id)
}

/** The admin's three buttons. */
export async function review(id: string, decision: "rerecord" | "approved" | "enhance", note: string) {
  const admin = await requireAdmin()
  const row = await must(id)
  const evaluation = latestEvaluation(row.events)
  if (!evaluation) throw new Error("Score the video first.")
  if (note.trim()) await addEvent(id, { kind: "note", by: admin.email, note: note.trim() })

  if (decision === "rerecord") {
    await addEvent(id, { kind: "rerecord", by: admin.email })
    const body = layout({
      heading: "Findings",
      paragraphs: [
        `Great video! Wanna do it again? The following recommendations are shown to increase the Virality and Persuasion potential of your video by as much as ${evaluation.upliftPct}%.`,
        ...(note.trim() ? [note.trim()] : []),
      ],
      list: evaluation.recommendations.map((r) => r.change),
      buttons: [
        { label: "Re-record", href: `${SITE}/record/camera?again=${id}` },
        { label: "Nah, publish it", href: `${SITE}/v/${id}?publish=1` },
      ],
    })
    await send([row.owner], "Findings on your video", body, id)
  } else if (decision === "approved") {
    await addEvent(id, { kind: "approved", by: admin.email })
    await publish(row, admin.email)
  } else {
    await addEvent(id, { kind: "enhance", by: admin.email, plan: evaluation.recommendations.map((r) => r.change) })
  }
  refresh(id)
}

/** The owner's answer to the findings: publish the video as it is. */
export async function ownerPublish(id: string) {
  const user = await currentUser()
  const row = await must(id)
  if (!user || (user.email !== row.owner && !user.admin)) throw new Error("Sign in as the video's owner to publish it.")
  if (row.stage !== "with-owner") throw new Error("This video isn't waiting on you.")
  await addEvent(id, { kind: "owner-publish", by: user.email })
  await publish(row, user.email)
  refresh(id)
}

/** The Enrichment Engine's enhanced cut comes back as the next version, and is scored like any recording. */
export async function submitEnhanced(input: { parent: string; id: string; key: string; seconds: number }) {
  const admin = await requireAdmin()
  const parent = await must(input.parent)
  await createOriginal({ id: input.id, owner: parent.owner, key: input.key, version: parent.version + 1, parent: parent.id, title: parent.title, text: parent.text, name: parent.name, role: parent.role, town: parent.town, seconds: input.seconds, consent: parent.consent })
  await addEvent(parent.id, { kind: "replaced", by: admin.email, child: input.id })
  if (process.env.HERMES_AUTOSCORE === "1") await score(input.id)
  refresh(parent.id)
  refresh(input.id)
  return { id: input.id }
}

/** Once the video is live on YouTube, the poller watches it like every catalog short. */
export async function watchOnYouTube(id: string, url: string) {
  const admin = await requireAdmin()
  const youtubeId = url.match(/(?:shorts\/|v=|youtu\.be\/)([\w-]{11})/)?.[1] ?? (/^[\w-]{11}$/.test(url.trim()) ? url.trim() : null)
  if (!youtubeId) throw new Error("That doesn't look like a YouTube link.")
  await addToWatch({ youtubeId, original: id, at: new Date().toISOString() })
  await addEvent(id, { kind: "watching", by: admin.email, youtubeId, destinations: [{ platform: "YouTube", url: `https://youtube.com/shorts/${youtubeId}` }] })
  refresh(id)
}
