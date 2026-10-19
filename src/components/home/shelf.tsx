"use client"

// Below the home's fold, the reference's Recents / Quickstarts shelf in PAX2's terms. Recents are
// the scored takes, best first — a searchable list (or grid, by the view toggle) opening each take
// at /v/[id]. Quickstarts are the Studio's effects (src/lib/studio-presets.ts): picking one writes
// the draft with the effect's script, hands the Studio the style preset, and lands there with the
// voice, bed and look already set — one click from card to styled take.

import * as React from "react"
import { useRouter } from "next/navigation"
import { LayoutGrid, List, PlaySquare, Search } from "lucide-react"

import { useDraft } from "@/components/record/draft"
import { EFFECTS, PRESET_KEY, type StudioEffect } from "@/lib/studio-presets"
import { FONTS, LOOKS, voiceLabel } from "@/lib/studio-style"
import { cn } from "@/ui/lib/utils"

export type RecentTake = { id: string; label: string; poster?: string; voice: string; score: number | null }
export type QuickScript = { id: string; title: string; text: string }

// An effect's card wears its own preset: the look paints it, the font sets the title, the chip
// names the voice.
function EffectCard({ e, onClick }: { e: StudioEffect; onClick: () => void }) {
  const look = LOOKS.find((l) => l.id === (e.style.color ?? "navy")) ?? LOOKS[0]
  const font = FONTS.find((f) => f.id === (e.style.font ?? "display")) ?? FONTS[0]
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-[4/3] overflow-hidden rounded-2xl text-left shadow-e1 transition-shadow hover:shadow-e3"
      style={{ background: `linear-gradient(135deg, ${look.background}, ${look.muted})` }}
    >
      <span className="absolute right-2.5 top-2.5 rounded-full bg-black/45 px-2 py-0.5 text-xs font-semibold text-white">{voiceLabel(e.style.voice ?? "none")}</span>
      <span className="absolute bottom-3 left-3.5 right-3.5 text-[17px] font-semibold leading-snug" style={{ color: look.ink, fontFamily: font.family }}>
        {e.title}
      </span>
    </button>
  )
}

function Card({ title, poster, bg, onClick, corner }: { title: string; poster?: string; bg?: string; onClick: () => void; corner?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-[4/3] overflow-hidden rounded-2xl text-left shadow-e1 transition-shadow hover:shadow-e3"
      style={poster ? { backgroundImage: `url(${poster})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: bg }}
    >
      <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
      {corner && <span className="absolute right-2.5 top-2.5 rounded-full bg-black/45 px-2 py-0.5 text-xs font-semibold text-white tabular">{corner}</span>}
      <span className="absolute bottom-3 left-3.5 right-3.5 text-[15px] font-semibold leading-snug text-white">{title}</span>
    </button>
  )
}

export function Shelf({ takes, scripts }: { takes: RecentTake[]; scripts: QuickScript[] }) {
  const router = useRouter()
  const { update } = useDraft()
  const [tab, setTab] = React.useState<"recents" | "quickstarts">("recents")
  const [q, setQ] = React.useState("")
  const [view, setView] = React.useState<"list" | "grid">("list")
  const needle = q.trim().toLowerCase()
  const foundTakes = needle ? takes.filter((t) => t.label.toLowerCase().includes(needle)) : takes
  const foundEffects = needle ? EFFECTS.filter((e) => `${e.title} ${voiceLabel(e.style.voice ?? "none")}`.toLowerCase().includes(needle)) : EFFECTS
  const run = (e: StudioEffect) => {
    const s = scripts.find((x) => x.id === e.scriptId) ?? scripts[0]
    if (!s) return
    update({ mode: "library", scriptId: s.id, title: s.title, text: s.text })
    try {
      sessionStorage.setItem(PRESET_KEY, JSON.stringify(e.style))
    } catch {}
    router.push("/record/studio")
  }
  const recents = tab === "recents"
  return (
    <div className="px-4 pb-16">
      <div className="mx-auto w-full max-w-[1094px]">
        <div className="flex gap-6 border-b border-slate-200 pb-3">
          {(["recents", "quickstarts"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t)
                setQ("")
              }}
              aria-current={tab === t || undefined}
              className={cn(
                "relative text-[15px] font-medium transition-colors after:absolute after:-bottom-[13px] after:left-0 after:right-0 after:h-0.5 after:rounded-full",
                tab === t ? "text-slate-900 after:bg-slate-900" : "text-slate-400 hover:text-slate-600",
              )}
            >
              {t === "recents" ? "Recents" : "Quickstarts"}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex h-11 flex-1 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 transition-colors focus-within:border-slate-300">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={recents ? "Search recents…" : "Search quickstarts…"}
              aria-label={recents ? "Search recents" : "Search quickstarts"}
              className="w-full bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
          {recents && (
            <div className="flex h-11 items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
              {(
                [
                  ["list", List, "List view"],
                  ["grid", LayoutGrid, "Grid view"],
                ] as const
              ).map(([v, Icon, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-label={label}
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={cn("flex h-full w-9 items-center justify-center rounded-lg transition-colors", view === v ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-600")}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          )}
        </div>
        {recents ? (
          foundTakes.length === 0 ? (
            <p className="py-8 text-sm text-slate-500">No matches.</p>
          ) : view === "list" ? (
            <div className="mt-2">
              {foundTakes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => router.push(`/v/${t.id}`)}
                  className="flex w-full items-center gap-3.5 border-b border-slate-200/70 px-1 py-3 text-left transition-colors hover:bg-slate-200/40"
                >
                  {t.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.poster} alt="" className="size-10 shrink-0 rounded-lg border border-slate-200 object-cover" />
                  ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                      <PlaySquare className="size-4 text-slate-400" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-slate-900">{t.label}</span>
                  <span className="hidden w-24 text-sm text-slate-500 sm:block">{t.voice}</span>
                  <span className="w-12 text-right text-sm text-slate-700 tabular">{t.score != null ? t.score.toFixed(0) : "—"}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
              {foundTakes.map((t) => (
                <Card key={t.id} title={t.label} poster={t.poster} bg="linear-gradient(135deg,#1e3a8a,#2563eb)" corner={t.score != null ? t.score.toFixed(0) : undefined} onClick={() => router.push(`/v/${t.id}`)} />
              ))}
            </div>
          )
        ) : foundEffects.length === 0 ? (
          <p className="py-8 text-sm text-slate-500">No matches.</p>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            {foundEffects.map((e) => (
              <EffectCard key={e.id} e={e} onClick={() => run(e)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
