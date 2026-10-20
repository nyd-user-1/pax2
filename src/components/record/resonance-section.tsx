import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"
import { ResonanceBlocks } from "@/components/record/resonance-charts"
import { LengthBlock } from "@/components/record/resonance-length"
import { TopicBlock } from "@/components/record/resonance-topic"
import { UniversalBlock } from "@/components/record/resonance-universal"
import { ScrollCue } from "@/components/record/scroll-cue"

// Section three: Resonant Amplification. Sized so the blocks' charts run about 1130 wide: the textbook
// resonant frequency, then its measured twins, the resonant length and the resonant topic. pt-7 plus each block's mt-5 keeps the
// first block where pt-12 had it.

export function ResonanceSection() {
  return (
    <section id="resonance" className="relative scroll-mt-16">
      <div className="mx-auto w-full max-w-[1210px] px-6 pb-60 pt-7">
        <BlockOrder page="landing-resonance" initial={["frequency", "length", "topic", "universal"]}>
          <OrderedBlock id="frequency" label="Resonant Frequency">
            <ResonanceBlocks />
          </OrderedBlock>
          <OrderedBlock id="length" label="Resonant Length">
            <LengthBlock />
          </OrderedBlock>
          <OrderedBlock id="topic" label="Resonant Topic">
            <TopicBlock />
          </OrderedBlock>
          <OrderedBlock id="universal" label="Universal Resonance">
            <UniversalBlock />
          </OrderedBlock>
        </BlockOrder>
      </div>
      <ScrollCue next="record" className="bottom-[171px]" />
    </section>
  )
}
