import { ResonanceLazy } from "@/components/record/resonance-lazy"
import { ScrollCue } from "@/components/record/scroll-cue"

// Section three: Resonant Amplification as horizontal slides, centered in the viewport. The
// heading and its two-line definition live in the carousel and change with the slide
// (chart-carousel.tsx); the slides and their data load as their own chunk at first idle
// (resonance-lazy.tsx), out of the landing's initial bundle.

export function ResonanceSection() {
  return (
    <section id="resonance" className="relative flex min-h-dvh scroll-mt-16 flex-col justify-center">
      <div className="mx-auto w-full max-w-[1210px] px-6 pb-24">
        <ResonanceLazy />
      </div>
      <ScrollCue next="record" className="bottom-[171px]" />
    </section>
  )
}
