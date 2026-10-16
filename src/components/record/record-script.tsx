"use client"

import { useRouter } from "next/navigation"
import { Video } from "lucide-react"

import { useDraft } from "@/components/record/draft"

/** Start the recording flow with this script already in the editor. */
export function RecordScript({ id, title, text, label = "Record this script" }: { id: string; title: string; text: string; label?: string }) {
  const router = useRouter()
  const { update } = useDraft()
  return (
    <button
      type="button"
      onClick={() => {
        update({ mode: "library", scriptId: id, title, text })
        router.push("/record/script")
      }}
      className="flex w-fit items-center gap-2 rounded-full bg-pax2-blue px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-transform hover:-translate-y-0.5"
    >
      <Video className="size-4" /> {label}
    </button>
  )
}
