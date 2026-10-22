import { ChartCarousel } from "@/components/record/chart-carousel"
import { ResonanceBlocks } from "@/components/record/resonance-charts"
import { LengthBlock } from "@/components/record/resonance-length"
import { TopicBlock } from "@/components/record/resonance-topic"
import { UniversalBlock } from "@/components/record/resonance-universal"
import { ScrollCue } from "@/components/record/scroll-cue"

// Section three: Resonant Amplification, the four measured blocks as horizontal slides
// (chart-carousel.tsx), sized so each chart runs about 1130 wide.

export function ResonanceSection() {
  return (
    <section id="resonance" className="relative scroll-mt-16">
      <div className="mx-auto w-full max-w-[1210px] px-6 pb-60 pt-7">
        <div className="mb-8 flex flex-col gap-3">
          <h2 className="font-display text-3xl font-bold text-pax2-blue">Resonant Amplification</h2>
          <p className="max-w-3xl text-lg leading-relaxed text-slate-900">
            A video performs when its content matches what its audience already responds to. Four charts measure that match across 18,455 settled shorts: the resonance curve, the lengths and the
            topics where videos outrun their own channel&rsquo;s baseline, and the one curve every channel shares.
          </p>
        </div>
        <ChartCarousel>
          <ResonanceBlocks />
          <LengthBlock />
          <TopicBlock />
          <UniversalBlock />
        </ChartCarousel>
      </div>
      <ScrollCue next="record" className="bottom-[171px]" />
    </section>
  )
}
