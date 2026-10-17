"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Loader2, Sparkles } from "lucide-react"

import { writeScript } from "@/app/actions"
import { FlowPage, StepBar } from "@/components/record/chrome"
import { useDraft } from "@/components/record/draft"

const FIELDS = [
  { key: "name", label: "Your first name", placeholder: "Maria", short: true },
  { key: "role", label: "Who you are, in a few words", placeholder: "Nurse, mom of two, unenrolled voter", short: true },
  { key: "town", label: "Your town", placeholder: "Worcester", short: true },
  { key: "why", label: "Why does this matter to you?", placeholder: "I've never once had a real choice for state rep…", short: false },
  { key: "moment", label: "A time you felt you had no real choice at the ballot (optional)", placeholder: "Last fall my ballot had one name for every state race…", short: false },
] as const

type Answers = Record<(typeof FIELDS)[number]["key"], string>

export default function PersonalPage() {
  const router = useRouter()
  const { update } = useDraft()
  const [a, setA] = React.useState<Answers>({ name: "", role: "", town: "", why: "", moment: "" })
  const [pending, start] = React.useTransition()
  const [err, setErr] = React.useState<string | null>(null)
  return (
    <>
      <StepBar step={1} back={{ href: "/recording", label: "Start" }} />
      <FlowPage title="Tell us a little about you." lead="Three short answers. PAX2 writes a script that sounds like you, and you can change every word.">
        <form
          className="flex flex-col gap-5 surface p-7 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              setErr(null)
              try {
                const r = await writeScript(a)
                update({ mode: "personal", scriptId: r.basedOn, title: `In your words · ${r.basedOnTitle}`, text: r.text, name: a.name, role: a.role, town: a.town })
                router.push("/record/script")
              } catch (x) {
                setErr((x as Error).message)
              }
            })
          }}
        >
          {FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-2">
              <span className="font-medium text-pax2-blue">{f.label}</span>
              {f.short ? (
                <input value={a[f.key]} onChange={(e) => setA({ ...a, [f.key]: e.target.value })} placeholder={f.placeholder} className="rounded-xl border bg-pax2-mist px-4 py-3 outline-none focus:border-primary" />
              ) : (
                <textarea value={a[f.key]} onChange={(e) => setA({ ...a, [f.key]: e.target.value })} placeholder={f.placeholder} className="min-h-24 rounded-xl border bg-pax2-mist px-4 py-3 outline-none focus:border-primary" />
              )}
            </label>
          ))}
          <button type="submit" disabled={pending || !a.why.trim()} className="mt-2 flex w-fit items-center gap-2 rounded-full bg-pax2-blue px-7 py-4 font-medium text-white shadow-lg disabled:opacity-40">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Write my script <ArrowRight className="size-4" />
          </button>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <p className="text-xs text-slate-800">What you share here is used to write your script and to describe the messenger in results. Nothing is guessed from your face or voice.</p>
        </form>
      </FlowPage>
    </>
  )
}
