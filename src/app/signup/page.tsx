import Link from "next/link"

import { AuthForm } from "@/components/auth/auth-form"
import { Wordmark } from "@/components/wordmark"

export const metadata = { title: "Sign up" }

export default function SignUpPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-pax2-lavender to-pax2-mist">
      <header className="flex items-center px-6 py-5 md:px-10">
        <Link href="/" aria-label="Home"><Wordmark size={26} /></Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-24">
        <div className="rounded-3xl bg-white p-8 shadow-e3">
          <h1 className="font-display pb-6 text-2xl text-slate-900">Create your account</h1>
          <AuthForm mode="signup" />
        </div>
      </main>
    </div>
  )
}
