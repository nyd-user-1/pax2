"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { freshReview } from "@/app/actions"
import { Button } from "@/ui/components/nova/button"

export function FreshReview() {
  const router = useRouter()
  const [pending, start] = React.useTransition()
  return (
    <Button variant="outline" className="w-fit" disabled={pending} onClick={() => start(async () => { await freshReview(); router.push("/") })}>
      Start a fresh review
    </Button>
  )
}
