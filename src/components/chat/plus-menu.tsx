'use client'

// Ported from solar (src/components/SolarPlusMenu.tsx): the + button, its category list, and the
// drill-down drawer with its search field. Solar's States and Counties become Scripts and Videos;
// its Models step is left out (the product never names the model).

import { useState, useRef, useEffect } from 'react'
import { Plus, ChevronRight, ArrowLeft, X, Lightbulb, NotebookPen, PlaySquare } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Sample prompts                                                     */
/* ------------------------------------------------------------------ */

const SAMPLE_PROMPTS = [
  { description: 'Which takes are scoring above the reference average, and why?', prompt: 'Which takes are scoring above the reference average, and why?' },
  { description: 'Which script is landing best so far?', prompt: 'Which script is landing best so far?' },
  { description: 'What separates the highest-scoring take from the lowest?', prompt: 'What separates the highest-scoring take from the lowest?' },
  { description: 'Which takes need more evidence before the score can be trusted?', prompt: 'Which takes need more evidence before the score can be trusted?' },
  { description: 'Does Interest or Engage explain more of the spread between takes?', prompt: 'Does Interest or Engage explain more of the spread between takes?' },
  { description: 'What should the next round of tests change?', prompt: 'What should the next round of tests change?' },
]

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type DrillStep = 'categories' | 'prompts' | 'pick-script' | 'pick-video'

export type ScriptChip = { id: string; title: string; short: string }
export type VideoChip = { id: string; label: string; poster?: string; score: number | null }

interface Props {
  scripts: ScriptChip[]
  videos: VideoChip[]
  onSelect: (text: string) => void
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PlusMenu({ scripts, videos, onSelect }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [step, setStep] = useState<DrillStep>('categories')
  const [search, setSearch] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

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

  const q = search.toLowerCase()
  const filteredPrompts = SAMPLE_PROMPTS.filter(p => !search || p.description.toLowerCase().includes(q))
  const filteredScripts = scripts.filter(s => !search || s.title.toLowerCase().includes(q))
  const filteredVideos = videos.filter(v => !search || v.label.toLowerCase().includes(q))

  const getStepLabel = () => {
    if (step === 'prompts') return 'Sample Questions'
    if (step === 'pick-script') return 'Scripts'
    if (step === 'pick-video') return 'Videos'
    return ''
  }

  const isDrawer = step !== 'categories'

  const CATEGORIES: { key: Exclude<DrillStep, 'categories'>; label: string; icon: React.ReactNode }[] = [
    { key: 'prompts', label: 'Sample Questions', icon: <Lightbulb className="h-5 w-5" /> },
    ...(scripts.length ? [{ key: 'pick-script' as const, label: 'Scripts', icon: <NotebookPen className="h-5 w-5" /> }] : []),
    ...(videos.length ? [{ key: 'pick-video' as const, label: 'Videos', icon: <PlaySquare className="h-5 w-5" /> }] : []),
  ]

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
        <div className="absolute left-0 top-full mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl overflow-hidden z-20">
          <div className="py-1">
            {CATEGORIES.map((cat, i) => (
              <button
                key={cat.key}
                onClick={() => handleCategoryClick(cat.key)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-[var(--inp-bg)] transition-colors ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}
              >
                <span className="text-[var(--muted)]">{cat.icon}</span>
                <span className="text-[var(--txt)]">{cat.label}</span>
                <ChevronRight className="h-4 w-4 ml-auto text-[var(--muted)]" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Drill-down drawer */}
      {menuOpen && isDrawer && (
        <div className="absolute left-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl overflow-hidden z-20">
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

            {/* Sample Questions — description only */}
            {step === 'prompts' && (
              <>
                {filteredPrompts.map((p, i) => (
                  <button
                    key={p.description}
                    onClick={() => { onSelect(p.prompt); closeMenu() }}
                    className={`flex w-full items-start px-4 py-3 hover:bg-[var(--inp-bg)] transition-colors ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}
                  >
                    <span className="text-sm text-[var(--txt)] text-left">{p.description}</span>
                  </button>
                ))}
                {filteredPrompts.length === 0 && <p className="px-4 py-3 text-xs text-[var(--muted)]">No matches</p>}
              </>
            )}

            {/* Scripts */}
            {step === 'pick-script' && (
              <>
                {filteredScripts.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => { onSelect(`How is “${s.title}” performing across its takes?`); closeMenu() }}
                    className={`flex w-full items-center gap-3 px-4 py-3 hover:bg-[var(--inp-bg)] transition-colors ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}
                  >
                    <NotebookPen className="h-5 w-5 text-hermes-plum shrink-0" />
                    <span className="text-sm font-semibold text-[var(--txt)] text-left">{s.title}</span>
                  </button>
                ))}
                {filteredScripts.length === 0 && <p className="px-4 py-3 text-xs text-[var(--muted)]">No matches</p>}
              </>
            )}

            {/* Videos */}
            {step === 'pick-video' && (
              filteredVideos.length === 0
                ? <p className="px-4 py-3 text-xs text-[var(--muted)]">No matches</p>
                : filteredVideos.map((v, i) => (
                  <button
                    key={v.id}
                    onClick={() => { onSelect(`What explains the score on ${v.label}?`); closeMenu() }}
                    className={`flex w-full items-center gap-3 px-4 py-3 hover:bg-[var(--inp-bg)] transition-colors ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}
                  >
                    {v.poster
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={v.poster} alt="" className="h-8 w-5 object-cover rounded-sm shrink-0 border border-[var(--border)]" />
                      : <PlaySquare className="h-5 w-5 text-hermes-plum shrink-0" />}
                    <span className="flex-1 text-left text-sm font-semibold text-[var(--txt)]">{v.label}</span>
                    {v.score != null && <span className="text-xs text-[var(--muted)] tabular">{v.score.toFixed(0)}</span>}
                  </button>
                ))
            )}

          </div>
        </div>
      )}
    </div>
  )
}
