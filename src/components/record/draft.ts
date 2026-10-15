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
}

const KEY = "hermes-record-draft"

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
