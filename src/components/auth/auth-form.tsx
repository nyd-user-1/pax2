"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, MailCheck } from "lucide-react"

import { DEMO_ACCOUNTS } from "@/lib/demo"
import { cn } from "@/ui/lib/utils"

type Mode = "signup" | "signin"

const post = async (action: string, body: object) => {
  const r = await fetch(`/api/auth/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; confirm?: boolean; resent?: boolean }
  return { status: r.status, ...j }
}

/** Where to land after signing in: the page the reader came from (?next=), else onboarding for a new
 *  account and chat, the signed-in home, for a returning one. A next of the landing itself counts as none. */
const nextPath = (mode: Mode) => {
  const n = new URLSearchParams(window.location.search).get("next")
  return n && n !== "/" && n.startsWith("/") && !n.startsWith("//") ? n : mode === "signup" ? "/signup/welcome" : "/chat"
}

const FIELD = "w-full rounded-xl border border-slate-400 bg-white px-4 py-3 text-[15px] text-slate-900 outline-none transition-[border-color,box-shadow] hover:border-pax2-blue focus:border-pax2-blue placeholder:text-slate-400 focus:ring-2 focus:ring-pax2-light-blue/40"
const BUTTON = "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-pax2-blue text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"

export type AuthStep = "form" | "code" | "reset"

/** `onStep`: told each time the form moves between its steps, so the page can retitle itself. */
export function AuthForm({ mode, onStep }: { mode: Mode; onStep?: (step: AuthStep) => void }) {
  const [step, setStep] = React.useState<AuthStep>("form")
  React.useEffect(() => onStep?.(step), [step, onStep])
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [code, setCode] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [resumed, setResumed] = React.useState(false)
  // The ?next= return address rides along when switching between sign in and sign up.
  const [qs, setQs] = React.useState("")
  React.useEffect(() => setQs(window.location.search), [])
  // Arriving from the demo-access corner (?demo=<role>) fills the form, ready to send.
  React.useEffect(() => {
    if (mode !== "signin") return
    const role = new URLSearchParams(window.location.search).get("demo")
    const a = role && DEMO_ACCOUNTS.find((x) => x.role.toLowerCase() === role.toLowerCase())
    if (a) {
      setEmail(a.email)
      setPassword(a.password)
    }
  }, [mode])

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
    // A full load, not an in-app push: a video lands as its own full page, never in the drawer over this form.
    window.location.assign(nextPath(mode))
    return true
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (step === "reset") {
        const r = await post("reset", { email, code, password })
        if (!r.ok) setError(r.error ?? "Something went wrong.")
        else await signin()
      } else if (step === "code") {
        const r = await post("confirm", { email, code })
        if (!r.ok) setError(r.error ?? "Something went wrong.")
        else if (password) {
          // A sign-up that resumed an earlier, unconfirmed one keeps the earlier password.
          if (!(await signin()) && resumed) {
            setError(null)
            setNotice("Email confirmed. Sign in with the password you chose the first time.")
            setStep("form")
          }
        } else {
          setNotice("Confirmed — sign in to continue.")
          setStep("form")
        }
      } else if (mode === "signup") {
        const r = await post("signup", { email, password })
        if (!r.ok) setError(r.error ?? "Something went wrong.")
        else {
          setResumed(!!r.resent)
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

  const forgot = async () => {
    if (!email) {
      setError("Enter your email first.")
      return
    }
    setBusy(true)
    setError(null)
    const r = await post("forgot", { email })
    setBusy(false)
    if (!r.ok) setError(r.error ?? "Something went wrong.")
    else {
      setCode("")
      setPassword("")
      setNotice(`We emailed a six-digit code to ${email}. Enter it with a new password.`)
      setStep("reset")
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {step === "reset" ? (
        <>
          <p className="flex items-start gap-2.5 rounded-xl bg-pax2-lavender/60 px-4 py-3 text-sm leading-relaxed text-pax2-blue">
            <MailCheck className="mt-0.5 size-4 shrink-0" />
            {notice}
          </p>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Code
            <input autoFocus inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className={cn(FIELD, "tabular tracking-[0.3em]")} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            New password
            <input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8+ characters, mixed" className={FIELD} />
            <span className="text-xs font-normal text-slate-400">8+ characters with an upper, a lower, a number and a symbol.</span>
          </label>
          {error && <p className="text-sm font-medium text-pax2-red-deep">{error}</p>}
          <button type="submit" disabled={busy || code.trim().length < 6 || !password} className={BUTTON}>
            {busy ? "One moment…" : "Set password and sign in"} <ArrowRight className="size-4" />
          </button>
          <button type="button" disabled={busy} onClick={forgot} className="text-sm text-slate-500 transition-colors hover:text-pax2-blue">
            Send a new code
          </button>
        </>
      ) : step === "code" ? (
        <>
          <p className="flex items-start gap-2.5 rounded-xl bg-pax2-lavender/60 px-4 py-3 text-sm leading-relaxed text-pax2-blue">
            <MailCheck className="mt-0.5 size-4 shrink-0" />
            {notice ?? `We emailed a six-digit code to ${email}.`}
          </p>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Confirmation code
            <input autoFocus inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className={cn(FIELD, "tabular tracking-[0.3em]")} />
          </label>
          {error && <p className="text-sm font-medium text-pax2-red-deep">{error}</p>}
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
            className="text-sm text-slate-500 transition-colors hover:text-pax2-blue"
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
          {mode === "signin" && (
            <button type="button" disabled={busy} onClick={forgot} className="-mt-2 self-end text-sm text-slate-500 transition-colors hover:text-pax2-blue">
              Forgot password?
            </button>
          )}
          {notice && <p className="text-sm text-pax2-blue">{notice}</p>}
          {error && <p className="text-sm font-medium text-pax2-red-deep">{error}</p>}
          <button type="submit" disabled={busy} className={BUTTON}>
            {busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"} <ArrowRight className="size-4" />
          </button>
          <p className="text-center text-sm text-slate-500">
            {mode === "signup" ? (
              <>Already have an account? <Link href={`/signin${qs}`} className="font-medium text-pax2-light-blue hover:underline">Sign in</Link></>
            ) : (
              <>New here? <Link href={`/signup${qs}`} className="font-medium text-pax2-light-blue hover:underline">Create an account</Link></>
            )}
          </p>
        </>
      )}
    </form>
  )
}
