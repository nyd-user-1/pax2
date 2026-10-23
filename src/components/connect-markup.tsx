import * as React from "react"

// The side panel's message text (lib/connect-types.ts's markdown) as formatted text: code blocks, quotes
// and lists by line; bold, italic, underline, strike, code and links within a line. Plain React nodes, so
// nothing a message says can become markup.

const INLINE =
  /(`[^`\n]+`)|(\*\*[^*\n]+?\*\*)|(__[^_\n]+?__)|(~~[^~\n]+?~~)|((?<=^|[\s(])\*[^*\s][^*\n]*?\*(?=$|[\s).,!?:;]))|((?<=^|[\s(])_[^_\s][^_\n]*?_(?=$|[\s).,!?:;]))|(\[[^\]\n]+\]\((?:https?|mailto):[^)\s]+\))|(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/g

const LINK = "font-medium text-pax2-light-blue underline-offset-2 hover:underline"

function inline(text: string, key = ""): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let at = 0
  for (const m of text.matchAll(INLINE)) {
    const i = m.index ?? 0
    if (i > at) out.push(text.slice(at, i))
    const s = m[0]
    const k = `${key}${i}`
    if (m[1]) out.push(<code key={k} className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-[12.5px] text-slate-800">{s.slice(1, -1)}</code>)
    else if (m[2]) out.push(<strong key={k} className="font-semibold text-slate-900">{inline(s.slice(2, -2), k)}</strong>)
    else if (m[3]) out.push(<u key={k}>{inline(s.slice(2, -2), k)}</u>)
    else if (m[4]) out.push(<s key={k}>{inline(s.slice(2, -2), k)}</s>)
    else if (m[5] || m[6]) out.push(<em key={k}>{inline(s.slice(1, -1), k)}</em>)
    else if (m[7]) {
      const [, label, href] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(s)!
      out.push(<a key={k} href={href} target="_blank" rel="noreferrer" className={LINK}>{label}</a>)
    } else out.push(<a key={k} href={s} target="_blank" rel="noreferrer" className={cnBreak(LINK)}>{s}</a>)
    at = i + s.length
  }
  if (at < text.length) out.push(text.slice(at))
  return out
}

const cnBreak = (c: string) => `${c} break-all`

type Block = { kind: "p" | "quote" | "ul" | "ol"; lines: string[] } | { kind: "code"; text: string }

function blocks(text: string): Block[] {
  const out: Block[] = []
  const parts = text.split(/```/)
  parts.forEach((part, n) => {
    if (n % 2 === 1) return void out.push({ kind: "code", text: part.replace(/^[\w-]*\n/, "").replace(/\n$/, "") })
    for (const line of part.split("\n")) {
      const kind = /^>\s?/.test(line) ? "quote" : /^\s*[-•*]\s+/.test(line) ? "ul" : /^\s*\d+[.)]\s+/.test(line) ? "ol" : "p"
      const body = kind === "quote" ? line.replace(/^>\s?/, "") : kind === "ul" ? line.replace(/^\s*[-•*]\s+/, "") : kind === "ol" ? line.replace(/^\s*\d+[.)]\s+/, "") : line
      const last = out[out.length - 1]
      if (last && last.kind !== "code" && last.kind === kind) last.lines.push(body)
      else out.push({ kind, lines: [body] })
    }
  })
  // Blank lines the split leaves at a block's edges.
  return out.filter((b) => b.kind === "code" || b.lines.some((l) => l.trim()))
}

export function Markup({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-1.5 text-sm leading-relaxed text-slate-700">
      {blocks(text).map((b, i) =>
        b.kind === "code" ? (
          <pre key={i} className="overflow-x-auto rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[12.5px] leading-relaxed text-slate-800">{b.text}</pre>
        ) : b.kind === "quote" ? (
          <blockquote key={i} className="border-l-2 border-slate-300 pl-3 text-slate-600">{b.lines.map((l, j) => <p key={j}>{inline(l, `${i}-${j}-`)}</p>)}</blockquote>
        ) : b.kind === "ul" ? (
          <ul key={i} className="list-disc pl-5">{b.lines.map((l, j) => <li key={j}>{inline(l, `${i}-${j}-`)}</li>)}</ul>
        ) : b.kind === "ol" ? (
          <ol key={i} className="list-decimal pl-5">{b.lines.map((l, j) => <li key={j}>{inline(l, `${i}-${j}-`)}</li>)}</ol>
        ) : (
          <p key={i} className="whitespace-pre-wrap break-words">{b.lines.map((l, j) => <React.Fragment key={j}>{j > 0 && "\n"}{inline(l, `${i}-${j}-`)}</React.Fragment>)}</p>
        ),
      )}
    </div>
  )
}
