"use client"

import { useRouter } from "next/navigation"

import { FlowPage, StepBar } from "@/components/record/chrome"
import { PersonalForm } from "@/components/record/personal-form"

export default function PersonalPage() {
  const router = useRouter()
  return (
    <>
      <StepBar back={{ href: "/recording", label: "Start" }} />
      <FlowPage title="Tell us a little about you." lead="Three short answers. PAX2 writes a script that sounds like you, and you can change every word.">
        <PersonalForm onWritten={() => router.push("/record/script")} />
      </FlowPage>
    </>
  )
}
