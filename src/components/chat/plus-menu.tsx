'use client'

// Ported from solar (src/components/SolarPlusMenu.tsx): the + button, its category list, and the
// drill-down drawer with its search field. The categories: Video Analytics (prompts over the record),
// Scripts (the open-primaries sample batch), Videos (the scored takes), Shorts (the catalog's real
// shorts), and Voices (the studio's readers — hear one, or write for it). Icons wear the sidebar's
// clothes: 18px, 1.75 stroke, lavender fill on hover.

import { useState, useRef, useEffect } from 'react'
import { Plus, ChevronRight, ArrowLeft, X, ChartColumn, NotebookPen, PlaySquare, Clapperboard, AudioLines, Volume2, Loader2 } from 'lucide-react'

import { narrate } from '@/app/studio-actions'
import { OPEN_SCRIPTS } from '@/lib/open-scripts'
import { VOICES } from '@/lib/studio-style'

/* ------------------------------------------------------------------ */
/*  Video Analytics prompts                                            */
/* ------------------------------------------------------------------ */

const ANALYTICS_PROMPTS = [
  'Rank the takes by Resonance and explain the spread.',
  'Compare the highest and lowest scoring takes — name what separates them.',
  'List the takes whose range still spans the reference average, and what each needs.',
  'Break the latest take into Engage, Interest and Act, and say which moved its score.',
  'Say which component — Engage, Interest or Act — explains more of the spread, with numbers.',
  'Propose the next three tests the evidence supports.',
]

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type DrillStep = 'categories' | 'prompts' | 'pick-script' | 'pick-video' | 'pick-short' | 'pick-voice'

export type ScriptChip = { id: string; title: string; short: string }
export type VideoChip = { id: string; label: string; poster?: string; score: number | null }

interface Props {
  videos: VideoChip[]
  shorts?: VideoChip[]
  onSelect: (text: string) => void
  /** Once the input is pinned to the bottom of the page, the menu opens upward. */
  dropUp?: boolean
}

/* Sidebar dress for every menu icon (shell.tsx's item): 18px, 1.75 stroke, lavender fill on row hover. */
const ICON = 'icon-pop size-[18px] shrink-0 transition-colors text-slate-500 group-hover:fill-pax2-lavender group-hover:text-pax2-blue'

const VOICE_LINE = 'Open primaries let every voter pick the person, not the party.'

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PlusMenu({ videos, shorts = [], onSelect, dropUp = false }: Props) {
  const scripts = OPEN_SCRIPTS
  const [menuOpen, setMenuOpen] = useState(false)
  const [step, setStep] = useState<DrillStep>('categories')
  const [search, setSearch] = useState('')
  const [hearing, setHearing] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    function h(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeMenu()
    }
    if (menuOpen) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])

  const closeMenu = () => { setMenuOpen(false); setStep('categories'); setSearch('') }
  const goBack = () => { setStep('categories'); setSearch('') }
  const handleCategoryClick = (cat: Exclude<DrillStep, 'categories'>) => { setSearch(''); setStep(cat) }

  /** Road test: the voice reads one line, made by the studio's own narrate. */
  const hear = async (voiceId: string) => {
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
  const filteredScripts = scripts.filter(s => !search || s.title.toLowerCase().includes(q) || s.text.toLowerCase().includes(q))
  const filteredVideos = videos.filter(v => !search || v.label.toLowerCase().includes(q))
  const filteredShorts = shorts.filter(v => !search || v.label.toLowerCase().includes(q))
  const voices = VOICES.filter(v => v.provider !== 'none').filter(v => !search || v.label.toLowerCase().includes(q))

  const getStepLabel = () => {
    if (step === 'prompts') return 'Video Analytics'
    if (step === 'pick-script') return 'Scripts'
    if (step === 'pick-video') return 'Videos'
    if (step === 'pick-short') return 'Shorts'
    if (step === 'pick-voice') return 'Voices'
    return ''
  }

  const isDrawer = step !== 'categories'

  const CATEGORIES: { key: Exclude<DrillStep, 'categories'>; label: string; icon: React.ReactNode }[] = [
    { key: 'prompts', label: 'Video Analytics', icon: <ChartColumn className={ICON} strokeWidth={1.75} /> },
    ...(scripts.length ? [{ key: 'pick-script' as const, label: 'Scripts', icon: <NotebookPen className={ICON} strokeWidth={1.75} /> }] : []),
    ...(videos.length ? [{ key: 'pick-video' as const, label: 'Videos', icon: <PlaySquare className={ICON} strokeWidth={1.75} /> }] : []),
    ...(shorts.length ? [{ key: 'pick-short' as const, label: 'Shorts', icon: <Clapperboard className={ICON} strokeWidth={1.75} /> }] : []),
    { key: 'pick-voice', label: 'Voices', icon: <AudioLines className={ICON} strokeWidth={1.75} /> },
  ]

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

            {/* Scripts — the open-primaries batch; picking one brings its text in to make yours */}
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
                      <span className="block truncate text-xs text-[var(--muted)]">{s.hook}</span>
                    </span>
                  </button>
                ))}
                {filteredScripts.length === 0 && <p className="px-4 py-3 text-xs text-[var(--muted)]">No matches</p>}
              </>
            )}

            {/* Videos — the scored takes */}
            {step === 'pick-video' && (
              filteredVideos.length === 0
                ? <p className="px-4 py-3 text-xs text-[var(--muted)]">No matches</p>
                : filteredVideos.map((v, i) => (
                  <button key={v.id} onClick={() => { onSelect(`What explains the score on ${v.label}?`); closeMenu() }} className={row(i)}>
                    {v.poster
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={v.poster} alt="" className="h-8 w-5 object-cover rounded-sm shrink-0 border border-[var(--border)]" />
                      : <PlaySquare className={ICON} strokeWidth={1.75} />}
                    <span className="flex-1 text-left text-sm font-semibold text-[var(--txt)]">{v.label}</span>
                    {v.score != null && <span className="text-xs text-[var(--muted)] tabular">{v.score.toFixed(0)}</span>}
                  </button>
                ))
            )}

            {/* Shorts — the catalog's real shorts, strongest against their channel median first */}
            {step === 'pick-short' && (
              filteredShorts.length === 0
                ? <p className="px-4 py-3 text-xs text-[var(--muted)]">No matches</p>
                : filteredShorts.map((v, i) => (
                  <button key={v.id} onClick={() => { onSelect(`What explains how “${v.label.split(' · ')[0]}” performed?`); closeMenu() }} className={row(i)}>
                    {v.poster
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={v.poster} alt="" className="h-8 w-12 object-cover rounded-sm shrink-0 border border-[var(--border)]" />
                      : <Clapperboard className={ICON} strokeWidth={1.75} />}
                    <span className="flex-1 min-w-0 text-left text-sm font-semibold text-[var(--txt)] truncate">{v.label}</span>
                    {v.score != null && <span className="text-xs text-[var(--muted)] tabular">{v.score >= 10 ? v.score.toFixed(0) : v.score.toFixed(1)}×</span>}
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
