import "server-only"

import { now, putOnce, query, type Item } from "@/lib/ledger"

// Email through Amazon SES, every message also written to the ledger's outbox (MAIL / <iso>), sent
// or not, so a failed send is visible in the app. SES is in its sandbox until production access is
// granted: until then it only delivers to verified addresses, and the sender (HERMES_MAIL_FROM)
// must itself be verified.

const FROM = process.env.HERMES_MAIL_FROM ?? "brendan@nysgpt.com"
export const SITE = (process.env.HERMES_URL ?? "http://localhost:3000").replace(/\/$/, "")
export const ADMINS = (process.env.ADMIN_EMAILS ?? "brendan@nysgpt.com").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)

export type Mail = Item & { at: string; to: string[]; subject: string; text: string; html: string; about?: string; status: "sent" | "failed"; error?: string }

export type Button = { label: string; href: string }

/** A plain, single-column message: heading, paragraphs, an optional list, then buttons. */
export function layout({ heading, paragraphs, list, buttons }: { heading: string; paragraphs: string[]; list?: string[]; buttons?: Button[] }) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
<h1 style="font-size:22px;margin:0 0 16px">${esc(heading)}</h1>
${paragraphs.map((p) => `<p style="font-size:15px;line-height:1.55;margin:0 0 14px">${esc(p)}</p>`).join("\n")}
${list?.length ? `<ul style="font-size:15px;line-height:1.55;padding-left:20px;margin:0 0 18px">${list.map((l) => `<li style="margin-bottom:6px">${esc(l)}</li>`).join("")}</ul>` : ""}
${(buttons ?? []).map((b, i) => `<a href="${b.href}" style="display:inline-block;margin:6px 8px 0 0;padding:11px 20px;border-radius:999px;font-weight:600;font-size:15px;text-decoration:none;${i === 0 ? "background:#0f172a;color:#fff" : "border:1px solid #cbd5e1;color:#0f172a"}">${esc(b.label)}</a>`).join("")}
</div>`
  const text = [heading, "", ...paragraphs, ...(list?.length ? ["", ...list.map((l) => `- ${l}`)] : []), ...(buttons?.length ? ["", ...buttons.map((b) => `${b.label}: ${b.href}`)] : [])].join("\n")
  return { html, text }
}

export async function send(to: string[], subject: string, body: { html: string; text: string }, about?: string) {
  let status: Mail["status"] = "sent"
  let error: string | undefined
  try {
    const { SESv2Client, SendEmailCommand } = await import("@aws-sdk/client-sesv2")
    const ses = new SESv2Client({ region: process.env.HERMES_REGION ?? "us-east-1" })
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: `Hermes <${FROM}>`,
        Destination: { ToAddresses: to },
        Content: { Simple: { Subject: { Data: subject }, Body: { Html: { Data: body.html }, Text: { Data: body.text } } } },
      }),
    )
  } catch (e) {
    status = "failed"
    error = (e as Error).message
  }
  const at = now()
  await putOnce({ pk: "MAIL", sk: `${at}#${Math.random().toString(36).slice(2, 6)}`, at, to, subject, ...body, about, status, error })
  return { status, error }
}

export const outbox = async (about?: string) => (await query<Mail>("MAIL")).filter((m) => !about || m.about === about).sort((a, b) => b.at.localeCompare(a.at))
