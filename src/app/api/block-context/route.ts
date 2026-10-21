import { NextResponse, type NextRequest } from "next/server"

// A block dropped on the chat travels as a reference — its page and its anchor — and is read here, at
// drop time, so the chat gets what the block shows now. Without an anchor (a short dropped from the
// shelf travels as its video page) every block on the page is read, each under its title and the
// [[block:…]] reference the chat can answer with, the transcript last so it can't crowd out the numbers. The page is fetched as the signed-in reader (their
// cookies ride along, so the page's own door decides what comes back); the block is the card around the
// anchor; its text is the context: table rows as lines, cells split by " | ", chart labels kept.

const MAX = 12_000
const PAGE_MAX = 16_000
const BLOCK_MAX = 3_000

/** The card that holds the anchor, as raw HTML: from the nearest card opening before the anchor to its
 *  matching close. */
function cardAround(html: string, anchor: string): string | null {
  const at = html.indexOf(`id="${anchor}"`)
  if (at < 0) return null
  const slot = html.lastIndexOf('data-slot="card"', at)
  if (slot < 0) return null
  const start = html.lastIndexOf("<div", slot)
  if (start < 0) return null
  return cardFrom(html, start)
}

/** Every titled block on a page: its anchor, its title and its card's HTML, outermost cards only. */
function cardsOf(html: string): { anchor: string; title: string; card: string }[] {
  const out: { anchor: string; title: string; card: string }[] = []
  let end = 0
  for (const m of html.matchAll(/data-slot="card"/g)) {
    const start = html.lastIndexOf("<div", m.index)
    if (start < end) continue
    const card = cardFrom(html, start)
    end = start + card.length
    const t = /data-slot="card-title"[^>]*\bid="([\w-]+)"[^>]*>([\s\S]*?)<\/div>/.exec(card) ?? /\bid="([\w-]+)"[^>]*data-slot="card-title"[^>]*>([\s\S]*?)<\/div>/.exec(card)
    if (t) out.push({ anchor: t[1], title: textOf(t[2]).split("\n")[0], card })
  }
  return out
}

function cardFrom(html: string, start: number): string {
  const tag = /<\/?div\b/g
  tag.lastIndex = start
  let depth = 0
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    depth += m[0] === "<div" ? 1 : -1
    if (depth === 0) return html.slice(start, html.indexOf(">", m.index) + 1)
  }
  return html.slice(start)
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", mdash: "—", ndash: "–", hellip: "…", times: "×" }

/** The card's readable text: scripts and styles dropped, rows on their own lines, cells split. */
function textOf(html: string): string {
  return html
    .replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(td|th)>/gi, " | ")
    .replace(/<\/(tr|p|li|h[1-6]|div|section|header)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(text|span)>(?=<)/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => ENTITIES[e] ?? (e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : m))
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").replace(/(\s*\|\s*)+$/, "").trim())
    .filter((l) => l && l !== "Glossary")
    .join("\n")
}

export async function POST(req: NextRequest) {
  const { path, anchor, html: asHtml } = (await req.json().catch(() => ({}))) as { path?: string; anchor?: string; html?: boolean }
  // Our own pages only; an anchor, when given, names one block.
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || (anchor != null && (typeof anchor !== "string" || !/^[\w-]+$/.test(anchor)))) return NextResponse.json({ error: "A page path is needed, and an anchor must be a block's." }, { status: 400 })
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "")
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host
  try {
    const res = await fetch(`${proto}://${host}${path}`, { headers: { cookie: req.headers.get("cookie") ?? "" }, redirect: "manual", signal: AbortSignal.timeout(20_000), cache: "no-store" })
    if (!res.ok) return NextResponse.json({ error: `The page answered ${res.status}.` }, { status: 502 })
    const html = await res.text()
    if (!anchor) {
      const cards = cardsOf(html)
      if (!cards.length) return NextResponse.json({ error: "No blocks on that page." }, { status: 404 })
      const order = [...cards.filter((c) => !/transcript/i.test(c.title)), ...cards.filter((c) => /transcript/i.test(c.title))]
      let text = ""
      for (const c of order) {
        const body = textOf(c.card)
        // Stand-in copy (lorem ipsum where a short has no comments of its own) is not evidence; leave it out.
        if (/lorem ipsum|dolor sit amet|consectetur adipiscing/i.test(body)) continue
        // A block whose measures are all still dashes (no score, no spend yet) says nothing; skip it.
        if ((body.match(/(^|[\s|])-(?=[\s|]|$)/gm) ?? []).length >= 4) continue
        const piece = `\n\n### ${c.title} [[block:${path}#${c.anchor}]]\n${body.length > BLOCK_MAX ? `${body.slice(0, BLOCK_MAX)}…` : body}`
        if (text.length + piece.length > PAGE_MAX) break
        text += piece
      }
      return NextResponse.json({ text: text.trim(), blocks: order.map((c) => ({ anchor: c.anchor, title: c.title })) })
    }
    const card = cardAround(html, anchor)
    if (!card) return NextResponse.json({ error: "That block isn't on its page anymore." }, { status: 404 })
    // For the chat's inline embed: the card's own markup, scripts out, as it stands on its page now.
    if (asHtml) return NextResponse.json({ html: card.replace(/<(script|template)\b[\s\S]*?<\/\1>/gi, "").replace(/\son\w+="[^"]*"/gi, "") })
    const text = textOf(card)
    return NextResponse.json({ text: `[[block:${path}#${anchor}]]\n${text.length > MAX ? `${text.slice(0, MAX)}\n… (cut at ${MAX.toLocaleString()} characters)` : text}` })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
