"use client"

// The create row from the ElevenLabs home (elevenlabs.io/app/home), kept whole as the map of the
// audio/video features to build one at a time. Ten equal cells with no gap between them, each cell
// the hover surface, so one tile's hover wash ends where the next begins, as the reference's does.
// A tile whose feature exists links to it: Speech and Music to the Studio, where the narration
// voices and the sound beds live, Video to the record flow's front door. The rest sit muted until
// each is built, and More holds the overflow five the reference keeps behind its ellipsis,
// disabled the way the account menu holds its not-yet pages.

import Link from "next/link"
import { AudioLines, AudioWaveform, BookAudio, Captions, Clapperboard, Ellipsis, FileAudio, Globe, Image as ImageIcon, MicVocal, Music, Sparkles, UserRoundPlus, UsersRound, Video } from "lucide-react"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/components/nova/dropdown-menu"
import { cn } from "@/ui/lib/utils"

type Tile = { label: string; icon: typeof Music; href?: string }

const TILES: Tile[] = [
  { label: "Speech", icon: AudioLines, href: "/record/studio" },
  { label: "Music", icon: Music, href: "/record/studio" },
  { label: "Voice Clone", icon: UsersRound },
  { label: "Image", icon: ImageIcon },
  { label: "Video", icon: Video, href: "/record" },
  { label: "Dubbing", icon: Captions },
  { label: "Avatar", icon: UserRoundPlus },
  { label: "Transcribe", icon: FileAudio },
  { label: "Audiobooks", icon: BookAudio },
]

const MORE: Tile[] = [
  { label: "Voice Changer", icon: MicVocal },
  { label: "Sound Effects", icon: Sparkles },
  { label: "Voice Isolator", icon: AudioWaveform },
  { label: "Audio Native", icon: Globe },
  { label: "Productions", icon: Clapperboard },
]

const cell = "flex flex-col items-center gap-2.5 rounded-2xl px-1 py-3 transition-colors hover:bg-slate-200/60"

function TileBody({ label, icon: Icon, dim = false }: { label: string; icon: typeof Music; dim?: boolean }) {
  return (
    <>
      <span className={cn("flex size-12 items-center justify-center rounded-xl border bg-white", dim ? "border-slate-200/70" : "border-slate-200")}>
        <Icon className={cn("size-5", dim ? "text-slate-300" : "text-slate-600")} strokeWidth={1.75} />
      </span>
      <span className={cn("text-center text-[15px] leading-tight", dim ? "text-slate-400" : "text-slate-800")}>{label}</span>
    </>
  )
}

export function CreateTiles() {
  return (
    <div className="grid w-full grid-cols-5 md:grid-cols-10">
      {TILES.map((t) =>
        t.href ? (
          <Link key={t.label} href={t.href} className={cn(cell, "press")}>
            <TileBody label={t.label} icon={t.icon} />
          </Link>
        ) : (
          <div key={t.label} aria-disabled className={cn(cell, "cursor-default")}>
            <TileBody label={t.label} icon={t.icon} dim />
          </div>
        ),
      )}
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(cell, "outline-none data-[popup-open]:bg-slate-200/60")}>
          <TileBody label="More" icon={Ellipsis} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="min-w-56 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-e3 ring-0">
          {MORE.map((m) => (
            <DropdownMenuItem key={m.label} disabled className="gap-3 rounded-xl px-2 py-1.5 text-[15px] text-slate-500">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <m.icon className="size-4 text-slate-500" />
              </span>
              {m.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
