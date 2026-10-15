import GlitchText from "@/components/glitch-text"

/** The pax wordmark: glitch text with the parallax red and blue as the slice shadows. */
export function Wordmark({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <GlitchText
      mode="slices"
      trigger="always"
      speed={1}
      intensity={0.5}
      burstDuration={0.6}
      offset={10}
      skew={0}
      flicker={false}
      fontWeight={900}
      enableShadows
      shadowColors={["#dc2626", "#2563eb"]}
      fontSize={size}
      color="#0f172a"
      className={className}
    >
      pax
    </GlitchText>
  )
}
