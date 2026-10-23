'use client'

// Ported from solar (src/components/SolarPlusMenu.tsx): the + button, its category list, and the
// drill-down drawer with its search field. The categories: Video Analytics (prompts over the record),
// Scripts (every script /scripts lists), Videos (on /chat the e2 videos and more Voter Freedom shorts;
// the scored takes elsewhere), Shorts (the catalog's real shorts), and Voices (the studio's readers —
// hear one, or write for it), Generate video (a script, put in the chat with its shots to generate), and
// Graphics (the cards Remotion draws from a script). Icons wear the sidebar's clothes: 18px, 1.75 stroke, lavender fill on hover.

import { useState, useRef, useEffect } from 'react'
import { Plus, ChevronRight, ArrowLeft, X, ChartColumn, NotebookPen, PlaySquare, Clapperboard, AudioLines, Volume2, Loader2, Film, Shapes } from 'lucide-react'

import { narrate } from '@/app/studio-actions'
import { GRAPHIC_KINDS, type FootageFocus, type GraphicKind } from '@/lib/footage'
import type { ListedScript } from '@/lib/script-list'
import { VOICES, type VoiceId } from '@/lib/studio-style'

/* ------------------------------------------------------------------ */
/*  Video Analytics prompts                                            */
/* ------------------------------------------------------------------ */

/*  Each one teaches a metric the site shows: the video page's blocks, /metrics' tabs and the graph. */
const ANALYTICS_PROMPTS = [
  'What is Resonance, and how do I read its gauge: the needle, the dashed tick and the number in the center?',
  'What is a Resonance score made of, and what moves it up or down?',
  'What is a persuasion score, and which traits add to it or take away from it?',
  'What does "outperformed 3x" mean, and why is it measured against the channel\'s own median?',
  'What is the Outlier Score, and how is it different from a view count?',
  'What does the Mode match measure, and what makes a mode a winning one?',
  'How do I read the Craft template, axis by axis?',
  'What do Resonant Length and Resonant Topic tell me about a video?',
  'What do the Swayable, Wesleyan and Upworthy blocks each measure, and how far can I trust them?',
  'What are the Recommendations based on, and why do some say there is no verdict yet?',
  'What do Lab Tested and e² mean?',
  'What does the Live tab on /metrics show, and why the first 72 hours?',
  'What does the Complete tab add that the Live tab does not have?',
  'How do I read the Patterns tab: the share at 3x and the lift?',
  'What makes a short an outlier on the Outliers tab?',
  'What does Feature worth show, and how was each feature\'s worth measured?',
  'What is a neighborhood on the graph, and what does a cluster tell me?',
]

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type DrillStep = 'categories' | 'prompts' | 'pick-script' | 'pick-video' | 'pick-short' | 'pick-voice' | 'generate' | 'graphics' | 'graphic-script'

export type ScriptChip = { id: string; title: string; short: string }
/** `youtube`: a YouTube video, whose score is its Outlier Score (views over its channel's median). */
export type VideoChip = { id: string; label: string; poster?: string; score: number | null; youtube?: boolean }

interface Props {
  videos: VideoChip[]
  shorts?: VideoChip[]
  onSelect: (text: string) => void
  /** A video picked from the menu: the chat attaches its page as context (and a short brings the question bank's chips). */
  onShort?: (v: VideoChip) => void
  /** Once the input is pinned to the bottom of the page, the menu opens upward. */
  dropUp?: boolean
  /** A script picked under Generate video or Graphics: the chat shows it with its footage, `focus` lit. */
  onFootage?: (script: string, focus: FootageFocus) => void
  /** A graphic picked while the chat already holds a script: that script's footage lights it. */
  onGraphic?: (kind: GraphicKind) => void
  /** Whether the conversation holds a finished script for a graphic to come from. */
  hasScript?: boolean
}

/* Sidebar dress for every menu icon (shell.tsx's item): 18px, 1.75 stroke, lavender fill on row hover. */
const ICON = 'icon-pop size-[18px] shrink-0 transition-colors text-slate-500 group-hover:fill-pax2-lavender group-hover:text-pax2-blue'

const VOICE_LINE = 'Open primaries let every voter pick the person, not the party.'

const outlier = (x: number) => `${x >= 10 ? x.toFixed(0) : x.toFixed(1)}×`

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PlusMenu({ videos, shorts = [], onSelect, onShort, dropUp = false, onFootage, onGraphic, hasScript = false }: Props) {
  const [scripts, setScripts] = useState<ListedScript[] | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [step, setStep] = useState<DrillStep>('categories')
  const [search, setSearch] = useState('')
  const [hearing, setHearing] = useState<string | null>(null)
  const [kind, setKind] = useState<GraphicKind | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    function h(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeMenu()
    }
    if (menuOpen) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])

  // The script list loads the first time the menu opens.
  useEffect(() => {
    if (menuOpen && !scripts) import('@/lib/script-list').then((m) => setScripts(m.SCRIPT_LIST))
  }, [menuOpen, scripts])

  const closeMenu = () => { setMenuOpen(false); setStep('categories'); setSearch('') }
  const askYouTube = (v: VideoChip) => { onSelect(`What explains how “${v.label.split(' · ')[0]}” performed?`); onShort?.(v) }
  const goBack = () => { setStep('categories'); setSearch('') }
  const handleCategoryClick = (cat: Exclude<DrillStep, 'categories'>) => { setSearch(''); setStep(cat) }

  /** Road test: the voice reads one line, made by the studio's own narrate. */
  const hear = async (voiceId: VoiceId) => {
    if (hearing) return
    setHearing(voiceId)
    try {
      const n = await narrate(VOICE_LINE, voiceId)
      audioRef.current?.pause()
      audioRef.current = new Audio(n.url)
      await audioRef.current.play()
    } catch {
      /* the voice stays silent; the row simply unspins */
    } finally {
      setHearing(null)
    }
  }

  const q = search.toLowerCase()
  const filteredPrompts = ANALYTICS_PROMPTS.filter(p => !search || p.toLowerCase().includes(q))
  const filteredScripts = (scripts ?? []).filter(s => !search || s.title.toLowerCase().includes(q) || s.framing.toLowerCase().includes(q) || s.text.toLowerCase().includes(q))
  const filteredVideos = videos.filter(v => !search || v.label.toLowerCase().includes(q))
  const filteredShorts = shorts.filter(v => !search || v.label.toLowerCase().includes(q))
  const voices = VOICES.filter(v => v.provider !== 'none').filter(v => !search || v.label.toLowerCase().includes(q))

  const getStepLabel = () => {
    if (step === 'prompts') return 'Video Analytics'
    if (step === 'pick-script') return 'Scripts'
    if (step === 'pick-video') return 'Videos'
    if (step === 'pick-short') return 'Shorts'
    if (step === 'pick-voice') return 'Voices'
    if (step === 'generate') return 'Generate video'
    if (step === 'graphics') return 'Graphics'
    if (step === 'graphic-script') return 'Scripts'
    return ''
  }

  const isDrawer = step !== 'categories'

  const CATEGORIES: { key: Exclude<DrillStep, 'categories'>; label: string; icon: React.ReactNode }[] = [
    { key: 'prompts', label: 'Video Analytics', icon: <ChartColumn className={ICON} strokeWidth={1.75} /> },
    { key: 'pick-script', label: 'Scripts', icon: <NotebookPen className={ICON} strokeWidth={1.75} /> },
    ...(videos.length ? [{ key: 'pick-video' as const, label: 'Videos', icon: <PlaySquare className={ICON} strokeWidth={1.75} /> }] : []),
    ...(shorts.length ? [{ key: 'pick-short' as const, label: 'Shorts', icon: <Clapperboard className={ICON} strokeWidth={1.75} /> }] : []),
    { key: 'pick-voice', label: 'Voices', icon: <AudioLines className={ICON} strokeWidth={1.75} /> },
    { key: 'generate', label: 'Generate video', icon: <Film className={ICON} strokeWidth={1.75} /> },
    { key: 'graphics', label: 'Graphics', icon: <Shapes className={ICON} strokeWidth={1.75} /> },
  ]

  const scriptRows = (pick: (s: ListedScript) => void) => (
    <>
      {filteredScripts.map((s, i) => (
        <button key={s.id} onClick={() => { pick(s); closeMenu() }} className={row(i)}>
          <NotebookPen className={ICON} strokeWidth={1.75} />
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-sm font-semibold text-[var(--txt)]">{s.title}</span>
            <span className="block truncate text-xs text-[var(--muted)]">{s.framing}</span>
          </span>
        </button>
      ))}
      {scripts && filteredScripts.length === 0 && <p className="px-4 py-3 text-xs text-[var(--muted)]">No matches</p>}
    </>
  )

  const row = (i: number) => `group flex w-full items-center gap-3 px-4 py-3 hover:bg-[var(--inp-bg)] transition-colors ${i > 0 ? 'border-t border-[var(--border)]' : ''}`

  const panelSide = dropUp ? 'bottom-full mb-2' : 'top-full mt-2'

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => { if (menuOpen) { closeMenu() } else { setMenuOpen(true); setStep('categories'); setSearch('') } }}
        className={`order-1 sm:order-2 flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
          menuOpen ? 'bg-[rgba(0,0,0,0.07)] text-[var(--txt)]' : 'text-[var(--muted)] hover:bg-[rgba(0,0,0,0.07)] hover:text-[var(--txt)]'
        }`}
      >
        {menuOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      </button>

      {/* Category screen */}
      {menuOpen && !isDrawer && (
        <div className={`absolute left-0 ${panelSide} w-56 max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl overflow-hidden z-20`}>
          <div className="py-1">
            {CATEGORIES.map((cat, i) => (
              <button key={cat.key} onClick={() => handleCategoryClick(cat.key)} className={row(i) + ' text-sm font-medium'}>
                {cat.icon}
                <span className="text-[var(--txt)]">{cat.label}</span>
                <ChevronRight className="h-4 w-4 ml-auto text-[var(--muted)]" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Drill-down drawer */}
      {menuOpen && isDrawer && (
        <div className={`absolute left-0 ${panelSide} w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl overflow-hidden z-20`}>
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border)]">
            <button onClick={goBack} className="text-[var(--muted)] hover:text-[var(--txt)] shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${getStepLabel()}…`} autoFocus
              className="flex-1 bg-transparent text-base text-[var(--txt)] outline-none placeholder:text-[var(--muted2)]"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-[var(--muted)] hover:text-[var(--txt)] shrink-0">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="max-h-[320px] overflow-y-auto no-scrollbar">

            {/* Video Analytics — prompts over the record */}
            {step === 'prompts' && (
              <>
                {filteredPrompts.map((p, i) => (
                  <button key={p} onClick={() => { onSelect(p); closeMenu() }} className={row(i) + ' items-start'}>
                    <span className="text-sm text-[var(--txt)] text-left">{p}</span>
                  </button>
                ))}
                {filteredPrompts.length === 0 && <p className="px-4 py-3 text-xs text-[var(--muted)]">No matches</p>}
              </>
            )}

            {/* Generate video — a script, shown in the chat with its shots ready to generate */}
            {step === 'generate' && scriptRows((s) => onFootage?.(s.text, 'shots'))}

            {/* Graphics — the cards Remotion draws from a script, at no cost */}
            {step === 'graphics' && (
              <>
                {GRAPHIC_KINDS.filter((k) => !search || k.label.toLowerCase().includes(q) || k.about.toLowerCase().includes(q)).map((k, i) => (
                  <button
                    key={k.id}
                    onClick={() => {
                      if (hasScript) { onGraphic?.(k.id); closeMenu() } else { setKind(k.id); setSearch(''); setStep('graphic-script') }
                    }}
                    className={row(i) + ' items-start'}
                  >
                    <Shapes className={ICON} strokeWidth={1.75} />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-sm font-semibold text-[var(--txt)]">{k.label}</span>
                      <span className="block text-xs text-[var(--muted)]">{k.about}</span>
                    </span>
                  </button>
                ))}
              </>
            )}

            {/* A graphic picked with no script in the chat yet: the script it comes from */}
            {step === 'graphic-script' && scriptRows((s) => onFootage?.(s.text, kind ?? 'checklist'))}

            {/* Scripts — the /scripts catalog; picking one brings its text in to make yours */}
            {step === 'pick-script' && (
              <>
                {filteredScripts.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => { onSelect(`Make this script mine — keep it under 25 seconds, first person, and end with the ask:\n\n“${s.text}”`); closeMenu() }}
                    className={row(i)}
                  >
                    <NotebookPen className={ICON} strokeWidth={1.75} />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-sm font-semibold text-[var(--txt)]">{s.title}</span>
                      <span className="block truncate text-xs text-[var(--muted)]">{s.framing}</span>
                    </span>
                  </button>
                ))}
                {scripts && filteredScripts.length === 0 && <p className="px-4 py-3 text-xs text-[var(--muted)]">No matches</p>}
              </>
            )}

            {/* Videos — YouTube videos ask like a short; a take asks about its score */}
            {step === 'pick-video' && (
              filteredVideos.length === 0
                ? <p className="px-4 py-3 text-xs text-[var(--muted)]">No matches</p>
                : filteredVideos.map((v, i) => (
                  <button key={v.id} onClick={() => { if (v.youtube) askYouTube(v); else { onSelect(`What explains the score on ${v.label}?`); onShort?.(v) } closeMenu() }} className={row(i)}>
                    {v.poster
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={v.poster} alt="" className="h-8 w-5 object-cover rounded-sm shrink-0 border border-[var(--border)]" />
                      : <PlaySquare className={ICON} strokeWidth={1.75} />}
                    <span className="flex-1 text-left text-sm font-semibold text-[var(--txt)]">{v.label}</span>
                    {v.score != null && <span className="text-xs text-[var(--muted)] tabular">{v.youtube ? outlier(v.score) : v.score.toFixed(0)}</span>}
                  </button>
                ))
            )}

            {/* Shorts — real shorts, highest Outlier Score first */}
            {step === 'pick-short' && (
              filteredShorts.length === 0
                ? <p className="px-4 py-3 text-xs text-[var(--muted)]">No matches</p>
                : filteredShorts.map((v, i) => (
                  <button key={v.id} onClick={() => { askYouTube(v); closeMenu() }} className={row(i)}>
                    {v.poster
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={v.poster} alt="" className="h-8 w-12 object-cover rounded-sm shrink-0 border border-[var(--border)]" />
                      : <Clapperboard className={ICON} strokeWidth={1.75} />}
                    <span className="flex-1 min-w-0 text-left text-sm font-semibold text-[var(--txt)] truncate">{v.label}</span>
                    {v.score != null && <span className="text-xs text-[var(--muted)] tabular">{outlier(v.score)}</span>}
                  </button>
                ))
            )}

            {/* Voices — hear one read a line, or write a script for it */}
            {step === 'pick-voice' && (
              <>
                {voices.map((v, i) => (
                  <div key={v.id} className={row(i) + ' cursor-default'}>
                    <AudioLines className={ICON} strokeWidth={1.75} />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-sm font-semibold text-[var(--txt)]">{v.label}</span>
                      <span className="block text-xs text-[var(--muted)]">{v.provider}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => hear(v.id)}
                      disabled={!!hearing}
                      title={`Hear ${v.label}`}
                      className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[rgba(0,0,0,0.07)] hover:text-pax2-blue disabled:opacity-40"
                    >
                      {hearing === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => { onSelect(`Write a 25-second open-primaries script for ${v.label} to read — hook under 12 words, first person, one concrete number, end with what the viewer should do.`); closeMenu() }}
                      className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-pax2-blue hover:bg-pax2-lavender/60"
                    >
                      Write
                    </button>
                  </div>
                ))}
                {voices.length === 0 && <p className="px-4 py-3 text-xs text-[var(--muted)]">No matches</p>}
              </>
            )}

          </div>
        </div>
      )}
    </div>
  )
}
