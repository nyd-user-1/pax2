"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"

import { LandscapeCard, ListRow, SearchBar, ShortCard, type FeedVideo } from "@/components/record/feed"
import { tagId } from "@/lib/tags"
import { cn } from "@/ui/lib/utils"

// /tags as govblock lays its tags out (components/tags/tags-explorer.tsx, after daily.dev): a search
// over every tag, a letter bar, then every tag A to Z. Here each tag's section carries its videos in the
// root feed's layouts. A letter or a search narrows the A-to-Z list.

export type TagSection = { tag: string; videos: FeedVideo[] }

const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "#"]
const letterOf = (name: string) => {
  const first = name.charAt(0).toUpperCase()
  return /[A-Z]/.test(first) ? first : "#"
}
const letterId = (letter: string) => `letter-${letter === "#" ? "other" : letter.toLowerCase()}`

/** The letter copies a link to its own section; the copy icon shows on hover. */
function LetterHeading({ letter }: { letter: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <h2 className="text-2xl font-semibold text-slate-900">
      <button
        type="button"
        aria-label={`Copy a link to ${letter}`}
        onClick={() => {
          void navigator.clipboard.writeText(`${window.location.origin}/tags#${letterId(letter)}`)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        className="group/letter flex items-center gap-2"
      >
        {letter}
        {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover/letter:opacity-100" />}
      </button>
    </h2>
  )
}

/** The mark over each run of cards: YouTube's for landscape, the Shorts mark for Shorts. */
function RunLabel({ shorts }: { shorts: boolean }) {
  return (
    <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shorts ? "/logos/youtube-shorts.svg" : "/logos/youtube.png"} alt="" className={shorts ? "h-5 w-auto" : "h-4 w-auto"} /> {shorts ? "Shorts" : "Videos"}
    </span>
  )
}

/** A tag's videos: one is a full-width row, two sit side by side, three or more take turns —
 *  six landscape cards three across, then six Shorts — each run under its mark. */
function TagVideos({ videos }: { videos: FeedVideo[] }) {
  if (videos.length === 1)
    return (
      <div className="flex flex-col gap-3">
        <RunLabel shorts={false} />
        <ListRow v={videos[0]} />
      </div>
    )
  if (videos.length === 2)
    return (
      <div className="flex flex-col gap-3">
        <RunLabel shorts={false} />
        <div className="grid gap-8 sm:grid-cols-2">
          {videos.map((v) => (
            <LandscapeCard key={v.id} v={v} />
          ))}
        </div>
      </div>
    )
  const runs: FeedVideo[][] = []
  for (let i = 0; i < videos.length; i += 6) runs.push(videos.slice(i, i + 6))
  return (
    <div className="flex flex-col gap-8">
      {runs.map((run, i) =>
        i % 2 === 0 ? (
          <div key={i} className="flex flex-col gap-3">
            <RunLabel shorts={false} />
            <div className="grid gap-8 sm:grid-cols-3">
              {run.map((v) => (
                <LandscapeCard key={v.id} v={v} />
              ))}
            </div>
          </div>
        ) : (
          <div key={i} className="flex flex-col gap-3">
            <RunLabel shorts />
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {run.map((v) => (
                <ShortCard key={v.id} v={v} />
              ))}
            </div>
          </div>
        ),
      )}
    </div>
  )
}

export function TagsExplorer({ sections }: { sections: TagSection[] }) {
  const [query, setQuery] = React.useState("")
  const [letter, setLetter] = React.useState<string | null>(null)

  const present = React.useMemo(() => new Set(sections.map((s) => letterOf(s.tag))), [sections])
  const q = query.trim().toLowerCase()
  const groups = React.useMemo(() => {
    const by = new Map<string, TagSection[]>()
    for (const s of sections) {
      if (letter && letterOf(s.tag) !== letter) continue
      if (q && !s.tag.toLowerCase().includes(q)) continue
      const l = letterOf(s.tag)
      by.set(l, [...(by.get(l) ?? []), s])
    }
    return LETTERS.filter((l) => by.has(l)).map((l) => ({ letter: l, sections: by.get(l)! }))
  }, [sections, letter, q])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div className="sticky top-2.5 z-40 mx-auto w-full max-w-2xl">
        <SearchBar q={query} setQ={setQuery} placeholder="Search all tags" />
      </div>

      <nav aria-label="Letters" className="flex flex-wrap justify-center gap-1">
        {[null, ...LETTERS].map((l) => {
          const on = letter === l
          const empty = l !== null && !present.has(l)
          return (
            <button
              key={l ?? "all"}
              type="button"
              disabled={empty}
              onClick={() => setLetter(l)}
              className={cn("min-w-8 rounded-md px-2 py-1 text-sm font-medium tabular-nums transition-colors", on ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground", empty && "pointer-events-none opacity-35")}
            >
              {l ?? "ALL"}
            </button>
          )
        })}
      </nav>

      <hr className="border-border" />

      <div className="flex flex-col gap-12">
        {groups.map((g) => (
          <section key={g.letter} id={letterId(g.letter)} className="flex scroll-mt-24 flex-col gap-8">
            <div className="flex items-center gap-4">
              <LetterHeading letter={g.letter} />
              <span className="h-px flex-1 bg-border" />
            </div>
            {g.sections.map((s) => (
              <section key={s.tag} id={tagId(s.tag)} className="flex scroll-mt-24 flex-col gap-4">
                <h3 className="text-lg font-semibold text-slate-900">{s.tag[0].toUpperCase() + s.tag.slice(1)}</h3>
                <TagVideos videos={s.videos} />
              </section>
            ))}
          </section>
        ))}
        {!groups.length && <p className="py-16 text-center text-slate-500">No tag matches &ldquo;{query}&rdquo;.</p>}
      </div>
    </div>
  )
}
