// The Quickstarts behind the home's shelf: each a studio effect — a preset of the Studio's style
// record (voice, sound bed, look, motion, type, pacing, cards) paired with the library script it
// suits — staged into the Studio in one click, the way the reference's quickstart templates stage
// their inputs. The card's face previews the preset: the look paints the background, the font sets
// the title, the chip names the voice. The Studio reads the preset from sessionStorage under
// PRESET_KEY on arrival and clears it.

import { VOICES, type StyleRecord } from "@/lib/studio-style"

export const PRESET_KEY = "pax2-studio-preset"

export type StudioEffect = { id: string; title: string; scriptId: string; style: Partial<StyleRecord> }

const voice = (label: string) => VOICES.find((v) => v.label === label)?.id ?? "none"

export const EFFECTS: StudioEffect[] = [
  { id: "compare-voices", title: "Compare voices", scriptId: "coin", style: { voice: voice("Sarah") } },
  { id: "night-mode", title: "Night mode", scriptId: "listen", style: { color: "night", motion: "zoom", voice: voice("Brian"), music: "calm" } },
  { id: "paper-edit", title: "Paper edit", scriptId: "already", style: { color: "paper", font: "serif", voice: voice("Matilda") } },
  { id: "red-alert", title: "Red alert", scriptId: "majority", style: { color: "flag", motion: "type", size: "l", voice: voice("Eric"), music: "pulse" } },
  { id: "word-by-word", title: "Word by word", scriptId: "district", style: { motion: "type", font: "mono", wpm: 130 } },
  { id: "hook-first", title: "Hook first", scriptId: "noparty", style: { hookCard: true, voice: voice("Sarah"), music: "bright" } },
  { id: "slow-burn", title: "Slow burn", scriptId: "calm", style: { color: "night", size: "l", position: "lower", wpm: 110, music: "calm" } },
  { id: "anchor-read", title: "Anchor read", scriptId: "coin", style: { position: "lower", voice: voice("Matthew") } },
  // ElevenLabs' social-media and narration voices, each set in a look that suits how it reads.
  { id: "creator-cut", title: "Creator cut", scriptId: "noparty", style: { motion: "type", size: "l", hookCard: true, voice: voice("Liam"), music: "bright" } },
  { id: "street-talk", title: "Street talk", scriptId: "majority", style: { color: "flag", motion: "zoom", voice: voice("Laura"), music: "pulse" } },
  { id: "kitchen-table", title: "Kitchen table", scriptId: "listen", style: { color: "paper", font: "serif", position: "lower", voice: voice("Jessica"), music: "calm" } },
  { id: "elder-statesman", title: "Elder statesman", scriptId: "already", style: { color: "night", font: "serif", voice: voice("Bill"), music: "calm" } },
  { id: "evening-news", title: "Evening news", scriptId: "district", style: { position: "lower", voice: voice("Daniel") } },
  { id: "explainer", title: "Explainer", scriptId: "coin", style: { color: "paper", motion: "type", voice: voice("Alice") } },
  { id: "storyteller", title: "Storyteller", scriptId: "calm", style: { color: "night", size: "l", voice: voice("George"), music: "calm" } },
  { id: "hard-line", title: "Hard line", scriptId: "majority", style: { color: "flag", motion: "type", size: "l", voice: voice("Adam"), music: "pulse" } },
]
