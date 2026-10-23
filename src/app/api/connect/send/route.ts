import { NextResponse } from "next/server"

import { connectAdmin, connectError, writerFor } from "@/lib/connect-run"
import { ATTACH_MAX_BYTES } from "@/lib/connect-types"
import { discordPost } from "@/lib/discord"
import { slackPost } from "@/lib/slack"

// The side panel's post to Slack or Discord, files and all (multipart, so files need no S3 detour).
// Fields: service, channel, parent (a Discord thread's forum), text, mentions (JSON, name to id), files.

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const form = await req.formData()
  const service = form.get("service") === "discord" ? "Discord" : "Slack"
  try {
    const user = await connectAdmin()
    const channel = String(form.get("channel") ?? "")
    const parent = form.get("parent") ? String(form.get("parent")) : undefined
    const text = String(form.get("text") ?? "").trim()
    const mentions = JSON.parse(String(form.get("mentions") ?? "{}")) as Record<string, string>
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0)
    if (!channel) throw new Error("No channel.")
    if (!text && !files.length) throw new Error("Nothing to send.")
    if (files.reduce((n, f) => n + f.size, 0) > ATTACH_MAX_BYTES) throw new Error(`Attachments go up to ${ATTACH_MAX_BYTES / 1024 / 1024} MB per message.`)
    const as = await writerFor(user)
    if (service === "Slack") await slackPost(channel, text, as, mentions, files)
    else await discordPost(channel, text, as, parent, mentions, files)
    return NextResponse.json({ ok: true, data: null })
  } catch (e) {
    return NextResponse.json({ ok: false, error: connectError(e, service) })
  }
}
