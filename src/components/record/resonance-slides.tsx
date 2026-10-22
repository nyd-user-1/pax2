"use client"

import { ChartCarousel } from "@/components/record/chart-carousel"
import { ResonanceBlocks } from "@/components/record/resonance-charts"
import { LengthBlock } from "@/components/record/resonance-length"
import { TopicBlock } from "@/components/record/resonance-topic"
import { UniversalBlock } from "@/components/record/resonance-universal"

// The four chart slides and their data, one async chunk (resonance-lazy.tsx loads it).

export default function ResonanceSlides() {
  return (
    <ChartCarousel>
      <ResonanceBlocks />
      <LengthBlock />
      <TopicBlock />
      <UniversalBlock />
    </ChartCarousel>
  )
}
