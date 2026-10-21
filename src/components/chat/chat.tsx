'use client'

// Ported from solar (src/app/(app)/new-chat/NewChatClient.tsx): the same column (773px), the same
// empty state centered on the screen with the input box in the middle and Explore beneath it, the
// same drop of the input to the bottom once the first message is sent, the same streaming, stop
// and Space-to-stop. PAX2' skin is layered through the variables solar's markup already reads
// (--txt, --muted, --muted2, --border, --surface, --inp-bg) and the plum accent where solar's was.
// Voice input keeps solar's mic, waveform, accept and 60-second limit; the words come from the
// browser's own speech recognition (free, no key) instead of solar's /api/transcribe.
// Address mode is solar's too (pin, Places suggestions, the address chip in the input); where solar
// fetched a rooftop's solar numbers, the address here resolves to its Massachusetts House district
// and how its last race went (/api/district), and that rides along with the question.

import { useState, useRef, useEffect, useCallback } from 'react'
import { ArrowUp, Check, ChevronLeft, ChevronRight, Loader2, MapPin, Mic, Paperclip, PlaySquare, Square, X } from 'lucide-react'

import { MarkdownContent } from '@/components/chat/markdown'
import { PlusMenu, type ScriptChip, type VideoChip } from '@/components/chat/plus-menu'
import { Wordmark } from '@/components/wordmark'
import { cn } from '@/ui/lib/utils'
import { isShelfDrag, readShelfDrag } from '@/lib/shelf-drag'
import { BLOCK_REF, ChatBlock } from '@/components/chat/chat-block'
import { ModelPicker, useChatModel } from '@/components/chat/model-picker'
import { ResponseFooter } from '@/components/chat/response-footer'

type Message = { id: string; role: 'user' | 'assistant'; content: string; model?: string }

/** A reply split at its [[block:…]] references: prose to render as markdown, and the blocks between. */
function pieces(content: string): ({ text: string } | { path: string; anchor: string })[] {
  const out: ({ text: string } | { path: string; anchor: string })[] = []
  let at = 0
  for (const m of content.matchAll(BLOCK_REF)) {
    if (m.index! > at) out.push({ text: content.slice(at, m.index) })
    out.push({ path: m[1], anchor: m[2] })
    at = m.index! + m[0].length
  }
  if (at < content.length) out.push({ text: content.slice(at) })
  return out
}
type Suggestion = { place_id: string; description: string }
type SelectedAddress = { description: string; lat: number; lng: number }
type PlaceRace = { election: string; candidates: { name: string; party: string; votes: number; won: boolean }[]; contested: boolean }
export type PlaceInsight = { district: string | null; state?: string; chamber?: string; members?: { name: string; party: string }[]; race?: PlaceRace | null; previous?: PlaceRace | null; note?: string; question3?: { yes: number; no: number; undecided: number; pollster: string } }

// The browser's speech recognition (Chrome, Edge, Safari): not in TypeScript's DOM types.
type Recognition = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void; abort: () => void; onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null }
const speechRecognition = () => (typeof window === 'undefined' ? undefined : ((window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition))

const SKIN = {
  '--txt': '#0f172a',
  '--muted': '#64748b',
  '--muted2': '#94a3b8',
  '--border': '#e2e8f0',
  '--surface': '#ffffff',
  '--inp-bg': '#ffffff',
} as React.CSSProperties

const ask = (v: VideoChip) => `What explains the score on ${v.label}?`

/** `context` supplies extra system context per message (the graph canvas's dock passes what is on
 *  the canvas); `attachment` renders above the input box (the dock's attached-entity banner).
 *  /app/home dresses the same chat as its front page: `heading` stands in for the wordmark,
 *  `below` hangs under the input in the empty state, `explore: false` yields that spot, and
 *  `shelf` renders past the fold — the empty state fills the viewport and the shelf scrolls up. */
export function Chat({ scripts = [], videos = [], compact = false, context, attachment, heading, below, explore = true, shelf }: { scripts?: ScriptChip[]; videos?: VideoChip[]; compact?: boolean; context?: () => string; attachment?: React.ReactNode; heading?: React.ReactNode; below?: React.ReactNode; explore?: boolean; shelf?: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<VideoChip | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [model, setModel] = useChatModel()

  // A Blocks-shelf tile dropped on the chat attaches as context, after livingston's drag-to-chat: a short
  // carries its own facts; a block is read from its page at drop time (/api/block-context), so the chat
  // gets what the block shows now. The ribbon over the input names it; the X lets it go.
  const [attached, setAttached] = useState<{ kind: 'block' | 'video'; title: string; place: string; context: string | null; error?: string } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const attach = async (e: React.DragEvent) => {
    const d = readShelfDrag(e.dataTransfer)
    setDragOver(false)
    if (!d) return
    e.preventDefault()
    if (!input.trim()) setInput(d.kind === 'block' ? `What does the ${d.title} block tell us?` : `What explains how "${d.title}" performed?`)
    setTimeout(() => textareaRef.current?.focus(), 0)
    // A short is read from its video page, every block on it; a block from its own page, that block alone.
    const path = d.kind === 'video' ? `/v/yt-${d.id}` : d.path
    const head = d.kind === 'video'
      ? `ACTIVE CONTEXT — the user attached the short "${d.title}" by ${d.channel} (${d.duration}, ${d.ratio}× its channel's median views). Its video page, ${path}, shows right now, block by block (each block's [[block:…]] reference beside its title):`
      : `ACTIVE CONTEXT — the user attached the "${d.title}" block from the page ${d.path}. What it shows right now:`
    setAttached({ kind: d.kind, title: d.title, place: d.kind === 'video' ? d.channel : d.path, context: null })
    try {
      const r = await fetch('/api/block-context', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d.kind === 'video' ? { path } : { path, anchor: d.anchor }) })
      const j = (await r.json()) as { text?: string; error?: string }
      setAttached((a) => (a && a.title === d.title ? { ...a, context: j.text ? `${head}\n${j.text}` : null, error: j.error } : a))
    } catch (x) {
      setAttached((a) => (a && a.title === d.title ? { ...a, error: (x as Error).message } : a))
    }
  }

  // Address
  const [addressMode, setAddressMode] = useState(false)
  const [addressInput, setAddressInput] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selectedAddress, setSelectedAddress] = useState<SelectedAddress | null>(null)
  const [placeInsight, setPlaceInsight] = useState<PlaceInsight | null>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const exploreScrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // ── Voice recording ──
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const [toast, setToast] = useState<string | null>(null)
  const recognitionRef = useRef<Recognition | null>(null)
  const heardRef = useRef('')
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stopAndTranscribeRef = useRef<() => void>(() => {})

  // ── Waveform visualization ──
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const waveDataRef = useRef<number[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Geolocation for address bias
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => setUserLocation({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {}
      )
    }
  }, [])

  // Focus textarea when entering address mode
  useEffect(() => {
    if (addressMode) setTimeout(() => textareaRef.current?.focus(), 50)
  }, [addressMode])

  // Auto-dismiss voice toasts
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [toast])

  // Stop mic/recognition on unmount (discard partial recordings)
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current)
      recognitionRef.current?.abort()
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      audioCtxRef.current?.close().catch(() => {})
    }
  }, [])

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`
  }

  const handleInputChange = (value: string) => {
    setInput(value)
    autoResize()
  }

  /** Send `text`; `base` is the conversation before it (Retry passes the turns before the retried one). */
  const submit = async (text: string, base: Message[] = messages) => {
    const trimmed = text.trim()
    if (!trimmed || loading || streaming) return
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed }
    const allMessages = [...base, userMsg]
    setMessages(allMessages)
    setInput('')
    setSelectedVideo(null)
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.focus() }
    setLoading(true)
    try {
      const controller = new AbortController()
      abortControllerRef.current = controller
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages.map(m => ({ role: m.role, content: m.content })), ...(selectedAddress ? { address: selectedAddress.description, place: placeInsight } : {}), ...((context || attached?.context) ? { systemContext: [context?.(), attached?.context].filter(Boolean).join('\n\n') } : {}), model }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) {
        const gate = res.status === 402 ? ((await res.json().catch(() => null)) as { error?: string } | null) : null
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: gate?.error ?? 'Something went wrong. Please try again.' }])
        setLoading(false); return
      }
      const assistantId = crypto.randomUUID()
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', model }])
      setLoading(false); setStreaming(true)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk } : m))
      }
    } catch {
      if (!abortControllerRef.current?.signal.aborted) setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: 'Connection error. Please check your network and try again.' }])
    } finally { setLoading(false); setStreaming(false) }
  }

  const fetchSuggestions = useCallback((value: string, loc?: { lat: number; lng: number } | null) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length < 3) { setSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      try {
        let url = `/api/places?input=${encodeURIComponent(value)}`
        if (loc) url += `&lat=${loc.lat}&lng=${loc.lng}`
        const res = await fetch(url)
        const data = await res.json()
        setSuggestions(Array.isArray(data) ? data : [])
      } catch { setSuggestions([]) }
    }, 300)
  }, [])

  const submitWithAddress = async (text: string, addr: SelectedAddress, insight: PlaceInsight | null) => {
    if (!text.trim() || loading || streaming) return
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    try {
      const body: Record<string, unknown> = { messages: [{ role: 'user', content: text }], address: addr.description }
      if (insight) body.place = insight
      if (context) body.systemContext = context()
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok || !res.body) { setLoading(false); return }
      const assistantId = crypto.randomUUID()
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])
      setLoading(false); setStreaming(true)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk } : m))
      }
    } catch { /* silent */ } finally { setLoading(false); setStreaming(false) }
  }

  const selectAddress = async (sg: Suggestion) => {
    setAddressMode(false)
    setAddressInput('')
    setSuggestions([])
    setPlaceInsight(null)
    try {
      const geoRes = await fetch(`/api/places/geocode?place_id=${sg.place_id}`)
      const geo = await geoRes.json()
      if (!geo.lat || !geo.lng) throw new Error('Geocode failed')
      const addr: SelectedAddress = { description: sg.description, lat: geo.lat, lng: geo.lng }
      setSelectedAddress(addr)
      // Look up the district before submitting so the answer gets the address's real race
      const dRes = await fetch(`/api/district?lat=${geo.lat}&lng=${geo.lng}`)
      const d = await dRes.json()
      const insight: PlaceInsight | null = dRes.ok && !d.error ? (d as PlaceInsight) : null
      setPlaceInsight(insight)
      submitWithAddress(`Who represents this address, and did they face an opponent last election? ${sg.description}`, addr, insight)
    } catch {
      setToast('Could not look up that address')
    }
  }

  const clearAddress = () => { setSelectedAddress(null); setPlaceInsight(null) }

  const exitAddressMode = () => { setAddressMode(false); setAddressInput(''); setSuggestions([]) }

  const stopStream = () => {
    abortControllerRef.current?.abort()
    setStreaming(false)
    setLoading(false)
  }

  // Spacebar stops streaming when not focused in an input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!streaming) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'Space') { e.preventDefault(); stopStream() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streaming])

  // Enter accepts dictation (same as tapping ✓) when recording is active
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (recordingState !== 'recording') return
      if (e.key === 'Enter') { e.preventDefault(); stopAndTranscribeRef.current() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [recordingState])

  const stopWaveform = () => {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null }
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null; analyserRef.current = null
    waveDataRef.current = []
  }

  const startWaveformFromStream = (stream: MediaStream) => {
    try {
      const ctx = new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      audioCtxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      ctx.createMediaStreamSource(stream).connect(analyser)
      const draw = () => {
        animFrameRef.current = requestAnimationFrame(draw)
        const canvas = canvasRef.current
        if (!canvas) return
        const c = canvas.getContext('2d')
        if (!c) return
        const a = analyserRef.current
        if (!a) return
        const buf = new Uint8Array(a.frequencyBinCount)
        a.getByteTimeDomainData(buf)
        let sum = 0
        for (const v of buf) sum += (v - 128) ** 2
        const rms = Math.min(1, Math.sqrt(sum / buf.length) / 48)
        waveDataRef.current = [...waveDataRef.current.slice(-150), rms]
        const W = canvas.clientWidth, H = canvas.clientHeight
        if (canvas.width !== W * 2 || canvas.height !== H * 2) { canvas.width = W * 2; canvas.height = H * 2; c.scale(2, 2) }
        c.clearRect(0, 0, W, H)
        const barW = 2, gap = 2, total = barW + gap
        const bars = waveDataRef.current.slice(-Math.floor(W / total))
        bars.forEach((v, i) => {
          const h = Math.max(2, v * H * 0.85)
          c.fillStyle = 'rgba(120,120,120,0.85)'
          c.fillRect(i * total, H / 2 - h / 2, barW, h)
        })
      }
      draw()
    } catch { /* ignore */ }
  }

  const releaseMic = () => {
    if (recordingTimerRef.current) { clearTimeout(recordingTimerRef.current); recordingTimerRef.current = null }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    stopWaveform()
  }

  const cancelRecording = () => {
    const r = recognitionRef.current
    recognitionRef.current = null
    if (r) { r.onend = null; r.abort() }
    heardRef.current = ''
    releaseMic()
    setRecordingState('idle')
  }

  const stopAndTranscribe = () => {
    const r = recognitionRef.current
    if (!r) return
    releaseMic()
    setRecordingState('transcribing')
    // The last words arrive in a final result just before the recognizer ends.
    r.onend = () => {
      recognitionRef.current = null
      const text = heardRef.current.trim()
      heardRef.current = ''
      setRecordingState('idle')
      if (!text) { setToast("Couldn't hear anything — try again?"); return }
      if (addressMode) {
        // Route into the address search field so Places autocomplete can pick it up
        setAddressInput(text)
        fetchSuggestions(text, userLocation)
      } else {
        submit(text)
      }
    }
    r.stop()
  }

  // Keep a stable ref so the 60s auto-stop timer always calls the latest version
  stopAndTranscribeRef.current = stopAndTranscribe

  const toggleMic = async () => {
    if (recordingState === 'recording') { cancelRecording(); return }
    if (recordingState === 'transcribing') return

    const SR = speechRecognition()
    if (!SR) {
      setToast('Voice input is not supported in this browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      startWaveformFromStream(stream)

      const r = new SR()
      r.lang = 'en-US'
      r.continuous = true
      r.interimResults = false
      heardRef.current = ''
      r.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) heardRef.current += `${e.results[i][0].transcript} `
      }
      r.onerror = (e) => {
        if (e.error === 'not-allowed') setToast('Mic permission denied. Enable it in your browser settings to use voice input.')
        else if (e.error === 'audio-capture') setToast('No microphone detected.')
        else if (e.error !== 'aborted' && e.error !== 'no-speech') setToast('Could not access microphone.')
      }
      // Chrome ends recognition after a pause even in continuous mode; keep listening until ✓ or cancel.
      r.onend = () => {
        if (recognitionRef.current !== r) return
        try { r.start() } catch { cancelRecording() }
      }
      recognitionRef.current = r
      r.start()
      setRecordingState('recording')

      // Auto-stop at 60 seconds
      recordingTimerRef.current = setTimeout(() => {
        setToast('Recording limit reached (60s) — transcribing now…')
        stopAndTranscribeRef.current()
      }, 60_000)
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name
      if (name === 'NotAllowedError') {
        setToast('Mic permission denied. Enable it in your browser settings to use voice input.')
      } else if (name === 'NotFoundError') {
        setToast('No microphone detected.')
      } else {
        setToast('Could not access microphone.')
      }
    }
  }

  const isEmpty = messages.length === 0

  /* ---- Chat input ---- */
  const inputBox = (
    <div className="relative">
      {/* Address suggestions (address mode) */}
      {addressMode && suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl overflow-hidden z-20 max-h-[320px] overflow-y-auto no-scrollbar">
          {suggestions.map(sg => (
            <button key={sg.place_id} onClick={() => { selectAddress(sg); exitAddressMode() }}
              className="flex w-full items-start gap-3 px-4 py-3 text-sm text-[var(--txt)] hover:bg-[var(--inp-bg)] transition-colors text-left border-b border-[var(--border)] last:border-0">
              <MapPin className="h-4 w-4 text-pax2-light-blue shrink-0 mt-0.5" />
              <span>{sg.description}</span>
            </button>
          ))}
        </div>
      )}
      {attachment}
      {attached && (
        <div className="-mb-2 flex min-w-0 items-center gap-1.5 rounded-t-2xl border border-b-0 border-[var(--border)] bg-slate-100 px-4 pb-4 pt-2 text-[11px] text-slate-600">
          {attached.context == null && !attached.error ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : <Paperclip className="h-3 w-3 shrink-0" />}
          <span className="shrink-0 uppercase tracking-wide">{attached.kind === 'block' ? 'block' : 'short'}</span>
          <span className="truncate font-medium text-slate-900">{attached.title}</span>
          <span className="shrink-0 text-slate-400">{attached.error ? `· couldn't read it: ${attached.error}` : attached.context == null ? '· reading…' : `· ${attached.place}`}</span>
          <button type="button" onClick={() => setAttached(null)} className="ml-auto shrink-0 rounded hover:text-slate-900" aria-label="Let the attachment go">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <div className={`relative flex flex-col rounded-2xl border ${addressMode ? 'border-pax2-light-blue' : recordingState !== 'idle' ? 'border-blue-500' : 'border-[var(--border)]'} bg-[var(--inp-bg)] px-4 pt-3 pb-3 transition-all gap-1 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${isFocused ? 'shadow-[0_8px_24px_rgba(0,0,0,0.08)]' : ''}`}>

        {selectedAddress && (
          <div className="flex items-center gap-2 pb-2.5 mb-1 border-b border-[var(--border)]">
            <MapPin className="h-3.5 w-3.5 text-pax2-light-blue shrink-0" />
            <span className="text-xs text-pax2-light-blue truncate flex-1 font-medium">{selectedAddress.description}</span>
            <button onClick={clearAddress} className="text-[var(--muted)] hover:text-pax2-light-blue transition-colors shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {selectedVideo ? (
          <div
            className="w-full py-1 text-[17px] leading-relaxed cursor-text"
            onClick={() => {
              setInput(ask(selectedVideo))
              setSelectedVideo(null)
              setTimeout(() => textareaRef.current?.focus(), 0)
            }}
          >
            <span className="text-[var(--txt)]">What explains the score on </span>
            <span className="text-pax2-light-blue font-semibold">{selectedVideo.label}</span>
            <span className="text-[var(--txt)]">?</span>
          </div>
        ) : recordingState === 'recording' ? (
          <div className="flex items-center min-h-[40px] py-1">
            <canvas ref={canvasRef} className="flex-1" style={{ height: '32px' }} />
          </div>
        ) : (
          <div className="flex items-start">
            <textarea ref={textareaRef} rows={1}
              value={addressMode ? addressInput : input}
              onChange={e => {
                if (addressMode) {
                  setAddressInput(e.target.value)
                  fetchSuggestions(e.target.value, userLocation)
                } else {
                  handleInputChange(e.target.value)
                }
              }}
              onKeyDown={e => {
                if (addressMode) {
                  if (e.key === 'Escape') { e.preventDefault(); exitAddressMode() }
                  if (e.key === 'Enter' && suggestions.length > 0) { e.preventDefault(); selectAddress(suggestions[0]); exitAddressMode() }
                } else {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input) }
                }
              }}
              placeholder={addressMode ? 'Enter an address…' : selectedAddress ? 'Ask about this address…' : 'Ask about the scores, scripts and results…'}
              className="flex-1 resize-none bg-transparent py-1 text-[17px] text-[var(--txt)] placeholder:text-[var(--muted2)] outline-none leading-relaxed"
              style={{ minHeight: '40px' }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)} />
          </div>
        )}

        <div className="flex items-center pt-1">
          <PlusMenu scripts={scripts} videos={videos} onSelect={(text) => { setInput(text); textareaRef.current?.focus() }} />

          <button
            onClick={() => addressMode ? exitAddressMode() : setAddressMode(true)}
            className={`ml-2 shrink-0 flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              addressMode || selectedAddress ? 'text-pax2-light-blue bg-pax2-light-blue/10' : 'text-[var(--muted)] hover:bg-[rgba(0,0,0,0.07)] hover:text-[var(--txt)]'
            }`}
            title={addressMode ? 'Exit address mode' : 'Look up an address'}>
            <MapPin className="h-4 w-4" />
          </button>
          <button
            onClick={toggleMic}
            disabled={recordingState === 'transcribing'}
            className={`ml-2 shrink-0 flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
              recordingState === 'recording' ? 'text-red-500 bg-red-50 animate-pulse'
              : recordingState === 'transcribing' ? 'text-blue-500 bg-blue-50'
              : 'text-[var(--muted)] hover:bg-[rgba(0,0,0,0.07)] hover:text-[var(--txt)]'
            }`}
            title={recordingState === 'recording' ? 'Cancel recording' : recordingState === 'transcribing' ? 'Transcribing…' : 'Voice input'}
          >
            {recordingState === 'transcribing' ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>
          {recordingState === 'recording' && (
            <button
              onClick={stopAndTranscribe}
              className="ml-2 shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-blue-500 bg-blue-50 hover:bg-blue-100 transition-colors"
              title="Done — transcribe"
            >
              <Check className="h-4 w-4" />
            </button>
          )}
          <div className="flex-1" />
          <ModelPicker value={model} onChange={setModel} />
          {streaming ? (
            <button type="button"
              onClick={stopStream}
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors"
              title="Stop (Space)">
              <Square className="h-4 w-4 fill-white" />
            </button>
          ) : (
            <button type="button"
              onClick={() => submit(selectedVideo ? ask(selectedVideo) : input)}
              disabled={(!input.trim() && !selectedVideo) || loading}
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-xl bg-pax2-blue text-white disabled:opacity-25 hover:opacity-80 transition-opacity">
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {toast && (
        <p className="text-center text-[11px] text-[var(--muted)] mt-2 animate-in fade-in">{toast}</p>
      )}
    </div>
  )

  return (
    <div
      className="relative flex h-full flex-1 flex-col overflow-hidden"
      style={SKIN}
      onDragOver={(e) => {
        if (!isShelfDrag(e.dataTransfer)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        setDragOver(true)
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setDragOver(false)}
      onDrop={attach}
    >
      {/* The whole chat is the drop surface while a shelf tile is held over it, as in Claude's chat. */}
      {dragOver && (
        <div aria-hidden className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-pax2-light-blue bg-pax2-lavender/50 backdrop-blur-[1px]">
          <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-pax2-blue shadow-e2">
            <Paperclip className="h-4 w-4" /> Drop to add to the chat
          </span>
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {isEmpty && !compact ? (
          // With `below` (the home), the layout is the reference's: the chat column rides at a fixed
          // offset from the top — set so the input's bottom edge lands where the reference's does,
          // our box being ~56px taller — the tiles and promos press to the bottom of the first
          // viewport, and the gap between them takes whatever height is left; the shelf waits past
          // the fold. Without `below`, the column centers as always.
          <>
          <div className={cn("flex flex-col items-center px-4", below ? "min-h-full pb-10 pt-16" : "min-h-full justify-center py-8")}>
            <div className="flex w-full max-w-[773px] flex-col gap-6">
              {!compact &&
                (heading ?? (
                  <div className="flex flex-col items-center">
                    <Wordmark size={34} />
                  </div>
                ))}
              {inputBox}
              {explore && videos.length > 0 && (
                <div className="max-w-[636px] mx-auto w-full">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-base font-semibold text-[var(--txt)]">Explore</p>
                    <div className="flex gap-2">
                      <button type="button"
                        onClick={() => exploreScrollRef.current?.scrollBy({ left: -260, behavior: 'smooth' })}
                        className="h-8 w-8 rounded-full border border-[var(--border)] flex items-center justify-center hover:bg-[var(--inp-bg)] transition-colors">
                        <ChevronLeft className="h-4 w-4 text-[var(--txt)]" />
                      </button>
                      <button type="button"
                        onClick={() => exploreScrollRef.current?.scrollBy({ left: 260, behavior: 'smooth' })}
                        className="h-8 w-8 rounded-full border border-[var(--border)] flex items-center justify-center hover:bg-[var(--inp-bg)] transition-colors">
                        <ChevronRight className="h-4 w-4 text-[var(--txt)]" />
                      </button>
                    </div>
                  </div>
                  <div ref={exploreScrollRef} className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory">
                    {videos.slice(0, 15).map(v => (
                      <button key={v.id} type="button"
                        onClick={() => { setSelectedVideo(v); setInput('') }}
                        className="group relative shrink-0 w-[150px] h-[100px] rounded-2xl overflow-hidden snap-start shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
                        <div
                          className="absolute inset-0 bg-[var(--inp-bg)]"
                          style={v.poster ? { backgroundImage: `url(${v.poster})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                        >
                          {!v.poster && <div className="absolute inset-0 flex items-center justify-center"><PlaySquare className="h-8 w-8 text-pax2-light-blue opacity-40" /></div>}
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute bottom-2 left-3">
                          <p className="text-xs font-semibold text-white leading-snug">{v.label}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {below && (
              <>
                <div className="min-h-12 flex-1" />
                {below}
              </>
            )}
          </div>
            {shelf}
          </>
        ) : (
          <div className="flex flex-col gap-4 px-4 py-6 max-w-[773px] mx-auto w-full">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'user' ? (
                  <div className="max-w-[80%] rounded-2xl rounded-br-sm px-4 py-3 text-[17px] leading-relaxed bg-[var(--inp-bg)] text-[var(--txt)]">
                    {msg.content}
                  </div>
                ) : (
                  <div className="group/reply flex-1 min-w-0 text-[17px] pt-0.5">
                    {msg.content ? (
                      <>
                        {pieces(msg.content).map((p, i) =>
                          'text' in p ? (
                            <MarkdownContent key={i} content={p.text} isStreaming={streaming && msg.id === messages[messages.length - 1]?.id} />
                          ) : (
                            <ChatBlock key={`${p.path}#${p.anchor}-${i}`} path={p.path} anchor={p.anchor} />
                          ),
                        )}
                        {streaming && msg.id === messages[messages.length - 1]?.id && (
                          <span className="inline-block w-1.5 h-4 bg-[var(--txt)] animate-pulse ml-0.5 align-middle">|</span>
                        )}
                        {!(streaming && msg.id === messages[messages.length - 1]?.id) && (
                          <ResponseFooter
                            text={msg.content}
                            model={msg.model}
                            latest={msg.id === messages[messages.length - 1]?.id}
                            onRetry={() => {
                              const at = messages.findIndex((x) => x.id === msg.id)
                              const ask = messages[at - 1]
                              if (ask?.role === 'user') submit(ask.content, messages.slice(0, at - 1))
                            }}
                          />
                        )}
                      </>
                    ) : (
                      <span className="inline-block w-1.5 h-4 bg-[var(--txt)] animate-pulse align-middle">|</span>
                    )}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="pt-1.5">
                <span className="inline-block w-1.5 h-4 bg-[var(--txt)] animate-pulse align-middle">|</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* In the side panel the input stays pinned to the bottom from the start. */}
      {(!isEmpty || compact) && (
        <div className="shrink-0 px-4 pb-4 pt-2">
          <div className="mx-auto max-w-[773px]">{inputBox}</div>
        </div>
      )}
    </div>
  )
}
