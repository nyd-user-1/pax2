"use client"

import { useRouter } from "next/navigation"
import { ArrowRight, MapPin, Mic } from "lucide-react"

import { useDraft } from "@/components/record/draft"

export type CardData = { id: string; title: string; framing: string; text: string; seconds: number; place: string; notes: { label: string; tone: "good" | "neutral" | "caution" }[] }

/** A script's card. `compact` keeps the title, the opening lines and the length and place, for the
 *  landing's slider; the library shows the framing and the notes as well. */
export function LibraryCard({ s, compact = false }: { s: CardData; compact?: boolean }) {
  const router = useRouter()
  const { update } = useDraft()
  const flat = s.text.replace(/\s+/g, " ")
  const excerpt = flat.length > 110 ? flat.slice(0, flat.lastIndexOf(" ", 110)).replace(/[,.;:—–-]+$/, "") + "…" : flat
  return (
    <button
      type="button"
      onClick={() => {
        update({ mode: "library", scriptId: s.id, title: s.title, text: s.text })
        router.push("/record/script")
      }}
      className="lift group flex flex-col gap-4 surface p-6 text-left"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="text-lg font-semibold leading-snug text-pax2-blue">{s.title}</span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pax2-mist transition-colors group-hover:bg-primary group-hover:text-white">
          <ArrowRight className="size-4" />
        </span>
      </span>
      {!compact && <span className="text-slate-800">{s.framing}</span>}
      <span className="border-l-2 border-primary/30 pl-4 italic text-slate-800">“{excerpt}”</span>
      <span className={compact ? "mt-auto flex flex-wrap gap-2 border-t pt-5" : "flex flex-wrap gap-2"}>
        <span className="flex items-center gap-1.5 rounded-full bg-pax2-mist px-3 py-1 text-sm text-pax2-blue">
          <Mic className="size-3.5" /> About {s.seconds} seconds
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-pax2-mist px-3 py-1 text-sm text-pax2-blue">
          <MapPin className="size-3.5" /> {s.place}
        </span>
      </span>
      {!compact && s.notes.length > 0 && (
        <span className="flex flex-col gap-1 border-t pt-3">
          {s.notes.map((n) => (
            <span key={n.label} className={n.tone === "good" ? "text-sm font-medium text-pax2-blue" : n.tone === "caution" ? "text-sm font-medium text-pax2-red-deep" : "text-sm text-slate-800"}>
              {n.label}
            </span>
          ))}
        </span>
      )}
    </button>
  )
}
