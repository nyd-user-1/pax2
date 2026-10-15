import Link from "next/link"

import { AuthForm } from "@/components/auth/auth-form"
import { Wordmark } from "@/components/wordmark"

export const metadata = { title: "Sign up" }

export default function SignUpPage() {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-pax2-mist px-6">
      <header className="fixed inset-x-0 top-0 z-10 flex items-center px-6 py-5">
        <Link href="/" aria-label="Home"><Wordmark size={28} /></Link>
      </header>
      <div className="w-full max-w-sm">
        <h1 className="font-display m-0 mb-8 text-center text-4xl font-normal text-pax2-ink">Create an account</h1>
        <AuthForm mode="signup" />
      </div>
    </main>
  )
}
