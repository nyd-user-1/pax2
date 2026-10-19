"use client"

import * as React from "react"

import { AuthForm, type AuthStep } from "@/components/auth/auth-form"
import TextType from "@/components/text-type"

/** The sign-up heading and form: the heading types Welcome to PAX, and Check your email once the
 *  code is sent. Keyed on its text, so each new heading types from the start. */
export function SignUpPanel() {
  const [step, setStep] = React.useState<AuthStep>("form")
  const heading = step === "code" ? "Check your email" : "Welcome to PAX"
  return (
    <>
      <div className="mb-8 text-center">
        <TextType key={heading} as="h1" text={heading} loop={false} typingSpeed={70} className="font-display m-0 text-4xl font-normal text-pax2-blue" />
      </div>
      <AuthForm mode="signup" onStep={setStep} />
    </>
  )
}
