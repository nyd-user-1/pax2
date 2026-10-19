"use client"

import { useSearchParams } from "next/navigation"

import { StepBar } from "@/components/record/chrome"
import { useDraft } from "@/components/record/draft"

/** The script page's way back, by where the script came from: a blank page or one written from
 *  your answers returns to the start; the library's scripts return to the library. */
export function ScriptBack() {
  const own = useSearchParams().has("own")
  const { draft, ready } = useDraft()
  const fromStart = own || (ready && (draft.mode === "own" || draft.mode === "personal"))
  return <StepBar back={fromStart ? { href: "/recording", label: "Start" } : { href: "/record/library", label: "Scripts" }} />
}
