export type Tone = "above" | "below" | "even" | "none"

/** Where a score sits against the reference average, judged by its whole range. */
export function toneOf(low: number | null | undefined, high: number | null | undefined): Tone {
  if (low == null || high == null) return "none"
  if (low > 50) return "above"
  if (high < 50) return "below"
  return "even"
}

export const TONE_LABEL: Record<Tone, string> = { above: "Above average", below: "Below average", even: "Can't tell yet", none: "Not scored" }

export const toneClasses: Record<Tone, string> = {
  above: "bg-above text-white",
  below: "bg-below text-white",
  even: "bg-white text-hermes-ink",
  none: "bg-slate-200 text-slate-600",
}
