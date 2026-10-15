"use client"

import { useRouter } from "next/navigation"
import { ArrowRight, MapPin, Mic } from "lucide-react"

import { useDraft } from "@/components/record/draft"

export type CardData = { id: string; title: string; framing: string; text: string; seconds: number; place: string; notes: { label: string; tone: "good" | "neutral" | "caution" }[] }

export function LibraryCard({ s }: { s: CardData }) {
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
        <span className="text-lg font-semibold leading-snug text-hermes-ink">{s.title}</span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-hermes-mist transition-colors group-hover:bg-primary group-hover:text-white">
          <ArrowRight className="size-4" />
        </span>
      </span>
      <span className="text-muted-foreground">{s.framing}</span>
      <span className="border-l-2 border-primary/30 pl-4 italic text-muted-foreground">“{excerpt}”</span>
      <span className="flex flex-wrap gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-hermes-mist px-3 py-1 text-sm text-hermes-ink">
          <Mic className="size-3.5" /> About {s.seconds} seconds
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-hermes-mist px-3 py-1 text-sm text-hermes-ink">
          <MapPin className="size-3.5" /> {s.place}
        </span>
      </span>
      {s.notes.length > 0 && (
        <span className="flex flex-col gap-1 border-t pt-3">
          {s.notes.map((n) => (
            <span key={n.label} className={n.tone === "good" ? "text-sm font-medium text-hermes-ink" : n.tone === "caution" ? "text-sm font-medium text-hermes-red-deep" : "text-sm text-muted-foreground"}>
              {n.label}
            </span>
          ))}
        </span>
      )}
    </button>
  )
}
