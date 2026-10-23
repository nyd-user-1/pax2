"use client"

import * as React from "react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/components/nova/tooltip"

/** Words that explain a number, shown on hover or focus instead of sitting beside it. */
export function Hint({ text, children }: { text: React.ReactNode; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} className="cursor-help outline-none" />}>{children}</TooltipTrigger>
      <TooltipContent className="max-w-sm text-left leading-snug">{text}</TooltipContent>
    </Tooltip>
  )
}
