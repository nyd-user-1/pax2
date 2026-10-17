"use client"

import * as React from "react"

// The volunteer's draft, carried between the record steps in this browser tab only.
export type Draft = {
  mode?: "personal" | "library" | "own" | "upload"
  scriptId?: string
  title?: string
  text?: string
  name?: string
  role?: string
  town?: string
  wpm?: number
  /** Re-recording an original video: the one this take replaces. */
  again?: string
  /** When it should go out, ISO. */
  publishAt?: string
}

const KEY = "pax2-record-draft"

export function useDraft() {
  const [draft, setDraft] = React.useState<Draft>({})
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => {
    try {
      setDraft(JSON.parse(sessionStorage.getItem(KEY) ?? "{}"))
    } catch {}
    setReady(true)
  }, [])
  const update = React.useCallback((patch: Partial<Draft>) => {
    setDraft((d) => {
      const next = { ...d, ...patch }
      sessionStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])
  return { draft, update, ready }
}

export const words = (t: string) => t.split(/\s+/).filter(Boolean).length
export const secondsAt = (t: string, wpm = 130) => Math.round((words(t) / wpm) * 60)

// Post times are Eastern wall-clock, whatever the browser's own zone.
const eastern = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" })
const partsOf = (d: Date) => Object.fromEntries(eastern.formatToParts(d).map((p) => [p.type, p.value]))

/** "2026-10-19T09:00" in Eastern time for an instant. */
export function toEasternLocal(iso: string) {
  const p = partsOf(new Date(iso))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

/** The instant an Eastern wall-clock time names; EDT and EST both tried. */
export function fromEasternLocal(local: string) {
  for (const off of [4, 5]) {
    const d = new Date(`${local}:00Z`)
    d.setUTCHours(d.getUTCHours() + off)
    if (toEasternLocal(d.toISOString()) === local) return d.toISOString()
  }
  return new Date(`${local}:00-05:00`).toISOString()
}

/** The next weekday at 9am Eastern, after now. */
export function nextWeekdayNine(from = new Date()) {
  const p = partsOf(from)
  let day = new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`)
  for (let i = 0; i < 8; i++) {
    const iso = fromEasternLocal(`${day.toISOString().slice(0, 10)}T09:00`)
    const dow = new Date(`${day.toISOString().slice(0, 10)}T12:00:00Z`).getUTCDay()
    if (dow !== 0 && dow !== 6 && new Date(iso) > from) return iso
    day = new Date(day.getTime() + 864e5)
  }
  return fromEasternLocal(`${day.toISOString().slice(0, 10)}T09:00`)
}
