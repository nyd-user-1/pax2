"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, ChevronRight, Loader2, LogOut } from "lucide-react"

import { saveProfile, type Profile } from "@/app/onboarding-actions"
import { CardBlock } from "@/components/blocks"
import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"

// /account, which the account chip's Profile, Account and Settings open: the profile a post to Slack or
// Discord goes out under (the onboarding rows, app/onboarding-actions.ts), the account itself, and the
// services it's connected to.

const FIELD = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[15px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-pax2-light-blue"
const EMPTY: Profile = { name: "", lastName: "", role: "", town: "", heard: "", makes: [], wants: [] }

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-pax2-blue">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={FIELD} />
    </label>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="min-w-0 truncate text-right text-sm font-medium text-slate-900">{children}</span>
    </div>
  )
}

function ProfileForm({ initial }: { initial: Profile | null }) {
  const [p, setP] = React.useState<Profile>(initial ?? EMPTY)
  const [state, setState] = React.useState<"idle" | "saving" | "saved">("idle")
  const set = (k: "name" | "lastName" | "role" | "town") => (v: string) => (setP({ ...p, [k]: v }), setState("idle"))
  const save = async () => {
    setState("saving")
    await saveProfile(p)
    setState("saved")
  }
  const full = [p.name, p.lastName].filter(Boolean).join(" ")
  return (
    <div className="flex flex-col gap-6 sm:flex-row">
      <div className="flex shrink-0 flex-col items-center gap-2 sm:w-32">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/avatars/default.jpg" alt="" width={96} height={96} className="size-24 rounded-full object-cover shadow-e1" />
        {full && <span className="text-center text-sm font-semibold text-slate-900">{full}</span>}
      </div>
      <div className="grid flex-1 gap-4 sm:grid-cols-2">
        <Field label="First name" value={p.name} onChange={set("name")} />
        <Field label="Last name" value={p.lastName} onChange={set("lastName")} />
        <Field label="Who you are, in a few words" value={p.role} onChange={set("role")} placeholder="Nurse, mom of two, unenrolled voter" />
        <Field label="Your town" value={p.town} onChange={set("town")} placeholder="Worcester" />
        <div className="sm:col-span-2">
          <button type="button" onClick={save} disabled={state === "saving"} className="press inline-flex items-center gap-2 rounded-full bg-pax2-blue px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {state === "saving" ? <Loader2 className="size-4 animate-spin" /> : state === "saved" ? <Check className="size-4" /> : null}
            {state === "saved" ? "Saved" : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}

function Connection({ logo, label, status, href }: { logo: string; label: string; status: string; href?: string }) {
  const body = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} alt="" className="size-5 shrink-0 object-contain" />
      <span className="flex-1 text-sm font-medium text-slate-900">{label}</span>
      <span className="text-sm text-slate-500">{status}</span>
      {href && <ChevronRight className="size-4 text-slate-400" />}
    </>
  )
  const row = "flex items-center gap-3 border-b border-slate-100 py-3 last:border-0"
  return href ? (
    <Link href={href} className={`${row} -mx-2 rounded-lg px-2 hover:bg-slate-50`}>
      {body}
    </Link>
  ) : (
    <div className={row}>{body}</div>
  )
}

export function AccountView({ email, admin, profile, slack, discord }: { email: string; admin: boolean; profile: Profile | null; slack: string | null; discord: string | null }) {
  const router = useRouter()
  const [leaving, setLeaving] = React.useState(false)
  const signOut = async () => {
    setLeaving(true)
    await fetch("/api/auth/signout", { method: "POST" })
    router.push("/signin")
    router.refresh()
  }
  return (
    <BlockOrder page="account" initial={["profile", "account", "settings"]}>
      <OrderedBlock id="profile" label="Profile">
        <CardBlock title="Profile" id="profile" height="auto">
          <ProfileForm initial={profile} />
        </CardBlock>
      </OrderedBlock>
      <OrderedBlock id="account" label="Account">
        <CardBlock title="Account" id="account" height="auto">
          <Row label="Email">{email}</Row>
          <Row label="Role">{admin ? "Admin" : "Member"}</Row>
          <div className="pt-4">
            <button type="button" onClick={signOut} disabled={leaving} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-pax2-red-deep transition-colors hover:border-pax2-red-deep disabled:opacity-60">
              {leaving ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
              Log out
            </button>
          </div>
        </CardBlock>
      </OrderedBlock>
      <OrderedBlock id="settings" label="Settings">
        <CardBlock title="Settings" id="settings" height="auto">
          <Connection logo="/logos/youtube.png" label="YouTube" status="My channels" href="/my-channels" />
          {admin && <Connection logo="/logos/slack.png" label="Slack" status={slack ?? "Not connected"} />}
          {admin && <Connection logo="/logos/discord-icon.svg" label="Discord" status={discord ?? "Not connected"} />}
        </CardBlock>
      </OrderedBlock>
    </BlockOrder>
  )
}
