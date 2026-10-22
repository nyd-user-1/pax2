"use client"

import { ChartCarousel, type SlideHeader } from "@/components/record/chart-carousel"
import { ResonanceBlocks } from "@/components/record/resonance-charts"
import { LengthBlock } from "@/components/record/resonance-length"
import { TopicBlock } from "@/components/record/resonance-topic"
import { UniversalBlock } from "@/components/record/resonance-universal"

// The four chart slides and their data, one async chunk (resonance-lazy.tsx loads it). Each slide's
// heading and two-line definition ride with it in the carousel.

const HEADERS: SlideHeader[] = [
  {
    title: "Resonant Frequency",
    lines: ["Every audience has frequencies it responds to; a video either meets one or misses."],
  },
  {
    title: "Resonant Length",
    lines: ["How performance varies with a short's length, each video against its own channel's baseline.", "The lengths where videos cross their channel median most often are the resonant lengths."],
  },
  {
    title: "Resonant Topic",
    lines: ["Each topic's lift: its videos' outcomes pooled against their own channels' baselines.", "Measured channel by channel, so one hot channel cannot read as a topic finding."],
  },
  {
    title: "Universal Resonance",
    lines: ["Views divided by channel median puts every short on one dimensionless scale.", "On that scale all 64 channels read on the same axis, with 3x as the shared bar."],
  },
]

export default function ResonanceSlides() {
  return (
    <ChartCarousel title="What is Resonance?" headers={HEADERS}>
      <ResonanceBlocks />
      <LengthBlock />
      <TopicBlock />
      <UniversalBlock />
    </ChartCarousel>
  )
}
