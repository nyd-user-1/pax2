"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, MailCheck } from "lucide-react"

import { cn } from "@/ui/lib/utils"

type Mode = "signup" | "signin"

const post = async (action: string, body: object) => {
  const r = await fetch(`/api/auth/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; confirm?: boolean }
  return { status: r.status, ...j }
}

const FIELD = "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-900 outline-none transition-shadow placeholder:text-slate-400 focus:ring-2 focus:ring-pax-plum/40"
const BUTTON = "press flex w-full items-center justify-center gap-2 rounded-full bg-pax-ink px-6 py-3.5 text-[15px] font-semibold text-white shadow-e2 transition-shadow hover:shadow-e3 disabled:opacity-60"

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const [step, setStep] = React.useState<"form" | "code">("form")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [code, setCode] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  const signin = async () => {
    const r = await post("signin", { email, password })
    if (r.status === 409) {
      await post("resend", { email })
      setNotice("Confirm your email first — we just sent you a fresh code.")
      setStep("code")
      return false
    }
    if (!r.ok) {
      setError(r.error ?? "Something went wrong.")
      return false
    }
    router.push("/record/start")
    return true
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (step === "code") {
        const r = await post("confirm", { email, code })
        if (!r.ok) setError(r.error ?? "Something went wrong.")
        else if (password) await signin()
        else {
          setNotice("Confirmed — sign in to continue.")
          setStep("form")
        }
      } else if (mode === "signup") {
        const r = await post("signup", { email, password })
        if (!r.ok) setError(r.error ?? "Something went wrong.")
        else {
          setNotice(`We emailed a six-digit code to ${email}.`)
          setStep("code")
        }
      } else {
        await signin()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {step === "code" ? (
        <>
          <p className="flex items-start gap-2.5 rounded-xl bg-pax-lavender/60 px-4 py-3 text-sm leading-relaxed text-pax-ink">
            <MailCheck className="mt-0.5 size-4 shrink-0" />
            {notice ?? `We emailed a six-digit code to ${email}.`}
          </p>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Confirmation code
            <input autoFocus inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className={cn(FIELD, "tabular tracking-[0.3em]")} />
          </label>
          {error && <p className="text-sm font-medium text-pax-red-deep">{error}</p>}
          <button type="submit" disabled={busy || code.trim().length < 6} className={BUTTON}>
            {busy ? "Confirming…" : "Confirm"} <ArrowRight className="size-4" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              await post("resend", { email })
              setNotice(`A fresh code is on its way to ${email}.`)
            }}
            className="text-sm text-slate-500 transition-colors hover:text-pax-ink"
          >
            Send a new code
          </button>
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Email
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.org" className={FIELD} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Password
            <input type="password" required autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? "8+ characters, mixed" : "Your password"} className={FIELD} />
            {mode === "signup" && <span className="text-xs font-normal text-slate-400">8+ characters with an upper, a lower, a number and a symbol.</span>}
          </label>
          {notice && <p className="text-sm text-pax-ink">{notice}</p>}
          {error && <p className="text-sm font-medium text-pax-red-deep">{error}</p>}
          <button type="submit" disabled={busy} className={BUTTON}>
            {busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"} <ArrowRight className="size-4" />
          </button>
          <p className="text-center text-sm text-slate-500">
            {mode === "signup" ? (
              <>Already have an account? <Link href="/signin" className="font-medium text-pax-plum hover:underline">Sign in</Link></>
            ) : (
              <>New here? <Link href="/signup" className="font-medium text-pax-plum hover:underline">Create an account</Link></>
            )}
          </p>
        </>
      )}
    </form>
  )
}
