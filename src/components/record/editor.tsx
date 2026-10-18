"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Check, Circle, Mic } from "lucide-react"

import { codeDraft, scoreOpeningLine, type DraftCodes } from "@/app/draft-actions"
import { secondsAt, useDraft, words } from "@/components/record/draft"
import { CAMPAIGN_FAMILY, organicCheck, organicEvidence, patternCheck } from "@/lib/organic-evidence"
import { cn } from "@/ui/lib/utils"

export type Research = { key: string; label: string; diff: number; low: number; high: number }

type CheckResult = { ok: boolean; title: string; detail: string; lines?: { ok: boolean; text: string }[] }

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`

/** The sixth check: the traits that measurably lift or sink on the campaign's own channels, each with
 *  its lift as metadata-lift.json states it and the line that carries it (src/lib/organic-evidence.ts). */
function channelCheck(text: string): CheckResult {
  const rows = organicCheck(text, secondsAt(text), CAMPAIGN_FAMILY)
  const scope = rows[0]?.scope ?? "these channels"
  return {
    ok: words(text) > 0 && rows.every((r) => r.good),
    title: `Travels on ${scope}`,
    detail: `Points in the share of shorts reaching 3x their channel's median, within channel, with the 90% range; measured on the titles and lengths of the ${scope}' own shorts.`,
    lines: rows.map((r) => ({
      ok: words(text) > 0 && r.good,
      text: `${r.label}: ${signed(r.points)} points (${signed(r.low)} to ${signed(r.high)}), ${r.channels} channels. ${r.line ? `Line ${r.line}: “${r.where}”` : r.where[0].toUpperCase() + r.where.slice(1)}`,
    })),
  }
}

/** The seventh check: the draft, coded on the words by PAX2 Trait Labeler when the reader presses the
 *  button, against the delivery patterns that separate the coded reform shorts that broke out from the
 *  rest (src/lib/organic-evidence.ts, patternCheck). */
function patternResult(coded: DraftCodes | null, stale: boolean): CheckResult {
  const { counts } = organicEvidence(CAMPAIGN_FAMILY)
  const n = counts.above + counts.below
  if (!coded) return { ok: false, title: "Delivery of the coded shorts", detail: `Code the draft to set it against the ${n} coded reform shorts: the patterns more common in the ones that broke out, and the ones more common in the rest.` }
  const rows = patternCheck(coded.codes, coded.quotes, CAMPAIGN_FAMILY)
  return {
    ok: !stale && rows.every((r) => r.good),
    title: stale ? "Delivery of the coded shorts (the draft changed since)" : "Delivery of the coded shorts",
    detail: `How many of the ${counts.above} coded reform shorts above the set's median carried each pattern, and of the ${counts.below} below; the draft coded from its words alone.`,
    lines: rows.map((r) => ({
      ok: !stale && r.good,
      text: `${r.label}: ${r.aboveN} of ${counts.above} above (${r.above}%), ${r.belowN} of ${counts.below} below (${r.below}%). ${r.present ? `Present${r.quote ? `: “${r.quote}”` : ""}` : "Not present"}.`,
    })),
  }
}

function checks(text: string, research: Record<string, Research>, opening: { percentile: number; accuracy: number } | null): CheckResult[] {
  const first = (text.trim().split(/(?<=[.!?])\s+/)[0] ?? "").trim()
  const fw = words(first)
  const lower = text.toLowerCase()
  const r = (k: string) => research[k]
  const pts = (x?: Research) => (x ? `${x.diff >= 0 ? "+" : ""}${x.diff.toFixed(1)} pts of vote choice (95% range ${x.low.toFixed(1)} to ${x.high.toFixed(1)})` : "")
  return [
    {
      ok: fw > 0 && fw <= 12,
      title: fw ? `Opening line: ${fw} words` : "No opening line yet",
      detail: `The first line is what Engage measures: whether the scroll stops. “${first.slice(0, 80)}${first.length > 80 ? "…" : ""}”${opening ? ` PAX2 Headline Ranker v1 scores it above ${opening.percentile}% of Upworthy's tested headlines (pairwise accuracy ${opening.accuracy} held out).` : ""}`,
    },
    {
      ok: /\bvote (yes|for)\b|\byes on (question )?3\b/.test(lower),
      title: "Ends with a clear ask",
      detail: `In tested campaign ads, an explicit ask to vote was worth ${pts(r("explicit_vote_for"))}.`,
    },
    {
      ok: /\b(i|i'm|i've|my|me)\b/.test(lower),
      title: "Sounds like you",
      detail: `Plain, first-person appeals from ordinary people: ${pts(r("technique_plain_folks"))}.`,
    },
    {
      ok: /\bquestion 3\b/.test(lower),
      title: "Names Question 3",
      detail: "Viewers can only act on a ballot question they can find on the ballot.",
    },
    {
      ok: /\d/.test(text),
      title: "Offers a fact",
      detail: "A concrete number gives the claim weight; check it against the campaign's sources before recording.",
    },
    channelCheck(text),
  ]
}

export function Editor({ research }: { research: Record<string, Research> }) {
  const own = useSearchParams().has("own")
  const { draft, update, ready } = useDraft()
  const [text, setText] = React.useState("")
  React.useEffect(() => {
    if (!ready) return
    if (own && draft.mode !== "own") {
      update({ mode: "own", scriptId: undefined, title: "My own words", text: "" })
      setText("")
    } else setText(draft.text ?? "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])
  const [coded, setCoded] = React.useState<DraftCodes | null>(null)
  const [codedText, setCodedText] = React.useState("")
  const [coding, setCoding] = React.useState(false)
  const [codeError, setCodeError] = React.useState<string | null>(null)
  const code = async () => {
    setCoding(true)
    setCodeError(null)
    try {
      setCoded(await codeDraft(text, CAMPAIGN_FAMILY))
      setCodedText(text)
    } catch (e) {
      setCodeError((e as Error).message)
    } finally {
      setCoding(false)
    }
  }
  const [opening, setOpening] = React.useState<{ percentile: number; accuracy: number } | null>(null)
  React.useEffect(() => {
    const first = (text.trim().split(/(?<=[.!?])\s+/)[0] ?? "").trim()
    if (first.split(/\s+/).filter(Boolean).length < 3) {
      setOpening(null)
      return
    }
    const t = setTimeout(() => {
      scoreOpeningLine(text).then(setOpening).catch(() => setOpening(null))
    }, 1200)
    return () => clearTimeout(t)
  }, [text])
  const cs = [...checks(text, research, opening), patternResult(coded, !!coded && codedText !== text)]
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <ScriptBox
        text={text}
        onText={(t) => {
          setText(t)
          update({ text: t })
        }}
      />
      <aside className="flex h-fit flex-col gap-3 surface p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-800">Before you record</p>
        {cs.map((c) => (
          <div key={c.title} className="flex gap-3">
            <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full", c.ok ? "bg-primary text-white" : "border text-slate-800")}>{c.ok ? <Check className="size-3" /> : <Circle className="size-2" />}</span>
            <span className="flex flex-col">
              <span className={cn("text-sm font-medium", c.ok ? "text-pax2-blue" : "text-slate-800")}>{c.title}</span>
              <span className="text-xs leading-relaxed text-slate-800">{c.detail}</span>
              {c.lines && (
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {c.lines.map((l) => (
                    <li key={l.text} className="flex gap-2 text-xs leading-relaxed text-slate-800">
                      <span className={cn("mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full", l.ok ? "bg-primary text-white" : "border text-slate-800")}>{l.ok ? <Check className="size-2.5" /> : <Circle className="size-1.5" />}</span>
                      <span className="min-w-0">{l.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </span>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={coding || words(text) < 20} onClick={code} className="rounded-full bg-pax2-blue px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
            {coding ? "Coding the draft…" : coded ? "Code the draft again" : "Code the draft"}
          </button>
          {codeError && <span className="text-xs text-destructive">{codeError}</span>}
        </div>
        <p className="border-t pt-3 text-[11px] leading-relaxed text-slate-800">Vote-choice figures come from 617 campaign ads tested against control groups; channel figures from the campaigns&apos; own channels. They are priors, not promises: style alone predicts little, which is why every take is measured.</p>
      </aside>
    </div>
  )
}

/** The script's text box with its word count and length, and the two ways on: record, or pick a
 *  different script. Shared by /record/script and the landing, where a picked script opens in
 *  place; there `onPickDifferent` returns to the scripts instead of going to /record/library. */
export function ScriptBox({ text, onText, onPickDifferent, onRecord }: { text: string; onText: (t: string) => void; onPickDifferent?: () => void; onRecord?: () => void }) {
  const router = useRouter()
  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden surface shadow-sm">
        <textarea
          value={text}
          onChange={(e) => onText(e.target.value)}
          placeholder="Say it the way you'd say it to a neighbor."
          className="h-80 w-full resize-y bg-transparent p-7 text-lg leading-relaxed text-pax2-blue outline-none"
        />
        <div className="flex items-center justify-between border-t bg-pax2-mist px-7 py-3 text-sm">
          <span className="text-slate-800">{words(text)} words</span>
          <span className="flex items-center gap-1.5 font-medium text-pax2-blue">
            <Mic className="size-4" /> About {secondsAt(text)} seconds to say
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <button type="button" disabled={!words(text)} onClick={() => (onRecord ? onRecord() : router.push("/record/camera"))} className="flex items-center gap-2 rounded-full bg-pax2-blue px-7 py-4 font-medium text-white shadow-lg disabled:opacity-40">
          Looks good, let&apos;s record <ArrowRight className="size-4" />
        </button>
        {onPickDifferent ? (
          <button type="button" onClick={onPickDifferent} className="font-medium text-primary">
            Pick a different script
          </button>
        ) : (
          <Link href="/record/library" className="font-medium text-primary">
            Pick a different script
          </Link>
        )}
      </div>
    </div>
  )
}
