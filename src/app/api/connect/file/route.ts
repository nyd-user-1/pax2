import { connectAdmin } from "@/lib/connect-run"
import { slackFile } from "@/lib/slack"

// A Slack file for the side panel: Slack serves files only to its token, so the app fetches it and passes
// the bytes on, to admins. ?u= is the file's url_private or thumbnail.

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    await connectAdmin()
    const u = new URL(req.url).searchParams.get("u")
    if (!u) return new Response("Missing ?u=", { status: 400 })
    const r = await slackFile(u)
    if (!r.ok || !r.body) return new Response("Slack would not serve that file.", { status: 502 })
    const headers = new Headers({ "content-type": r.headers.get("content-type") ?? "application/octet-stream", "cache-control": "private, max-age=300" })
    const disposition = r.headers.get("content-disposition")
    if (disposition) headers.set("content-disposition", disposition)
    return new Response(r.body, { headers })
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Not available.", { status: 403 })
  }
}
