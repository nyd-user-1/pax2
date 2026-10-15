// The campaign channels whose shorts Hermes tracks, shared by /campaigns and the short view.
export const CHANNELS = [
  { id: "UC-rKSUWdEqPmP-UM7yV6Ssw", slug: "yes-on-3", name: "Vote YES on 3", place: "Massachusetts · all-party primaries", code: "MA" },
  { id: "UCpSEnGNa8pO-llnwBDDa6Tg", slug: "courageous-colorado", name: "Courageous Colorado", place: "Colorado", code: "CO" },
  { id: "UCdr9X0FtE_GnXk_JwWYUx3g", slug: "open-primaries", name: "Open Primaries", place: "National", code: "US" },
  { id: "UC3HvCnPvYMIwh15fJxrEcKA", slug: "unite-america", name: "Unite America", place: "National", code: "US" },
  { id: "UCb8R3tlbcYaE5J5-HUBf7mw", slug: "fairvote", name: "FairVote", place: "National · ranked choice", code: "US" },
]

export const channelById = (id: string) => CHANNELS.find((c) => c.id === id)

/** ISO 8601 duration to seconds. */
export const secs = (iso: string) => {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  return m ? +(m[1] ?? 0) * 3600 + +(m[2] ?? 0) * 60 + +(m[3] ?? 0) : 0
}

export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0
}
