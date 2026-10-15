// Sample activity to show a page's full shape before the ledger has any. Every page that uses it
// says so with a "Sample data" chip; real records replace it as they arrive.

const day = (offset: number) => {
  const d = new Date("2026-10-17T12:00:00Z")
  d.setUTCDate(d.getUTCDate() - offset)
  return d.toISOString()
}

export const SAMPLE_ACTIVITY = Array.from({ length: 14 }, (_, i) => {
  const o = 13 - i
  const wave = Math.sin(i / 2) * 2
  return { date: day(o).slice(0, 10), item1: Math.max(0, Math.round(3 + wave + (i % 3))), item2: Math.max(0, Math.round(5 + i * 0.6 - wave + (i % 4))) }
})

export const SAMPLE_SENT = [
  { at: day(0), name: "Maria", role: "Nurse", town: "Worcester", seconds: 41, title: "They don’t have to listen · In your words", status: "awaiting review" },
  { at: day(1), name: "James", role: "Veteran", town: "Pittsfield", seconds: 38, title: "No competition · In your words", status: "awaiting review" },
  { at: day(1), name: "Ana", role: "Teacher", town: "Lowell", seconds: 33, title: "The 51% fact", status: "scored" },
  { at: day(3), name: "Dev", role: "Small-business owner", town: "Quincy", seconds: 29, title: "They don’t have to listen", status: "scored" },
  { at: day(5), name: "Rosa", role: "Retired firefighter", town: "Fall River", seconds: 44, title: "No competition", status: "running" },
]

export const SAMPLE_COUNTS = { readings: 14, decisions: 9, votes: 126, proposed: 21, approved: 9, made: 4, callsRight: 5, callsTotal: 7 }

export const SAMPLE_FEED = [
  { at: day(0), text: "Maria sent a 41s video" },
  { at: day(0), text: "PAX2 read They don’t have to listen" },
  { at: day(1), text: "Approved: Cut to 20 seconds, keep the opening, the payoff line and the ask" },
  { at: day(1), text: "James sent a 38s video" },
  { at: day(2), text: "Made: No-captions version of The 51% fact" },
  { at: day(3), text: "Loaded Round 2 (11 ads)" },
  { at: day(4), text: "Partner called “higher” on They don’t have to listen · Ruth" },
  { at: day(6), text: "Loaded Round 1 (10 ads)" },
]

export const SAMPLE_DECISIONS = [
  { take: "listen-stephen", status: "made", change: "Cut to 20 seconds: keep the opening, the payoff line and the ask", measure: "Interest on the short cut vs. the full take, same budget", at: day(9), score: 50 },
  { take: "coin-ruth", status: "approved", change: "Open on the number: “51% of races had one name on the ballot”", measure: "Engage rate on the new opening vs. the coin flip, same audience", at: day(4), score: 56 },
  { take: "calm-danielle", status: "revised", change: "Same script read by a volunteer from an uncontested district", measure: "Act rate and comments mentioning the district", at: day(3), score: 44 },
  { take: "coin-danielle", status: "saved", change: "Burned-in captions in the first two seconds", measure: "3-second plays per impression, captions on vs. off", at: day(2), score: 39 },
]

export const SAMPLE_CALLS = [
  { take: "listen-ruth", by: "Partner", predicted: "higher", baseline: 66, actual: "higher", right: true, at: day(10) },
  { take: "coin-stephen", by: "Partner", predicted: "same", baseline: 47, actual: "same", right: true, at: day(10) },
  { take: "calm-ruth", by: "Partner", predicted: "higher", baseline: 49, actual: "same", right: false, at: day(9) },
  { take: "listen-danielle", by: "Partner", predicted: "lower", baseline: 37, actual: "same", right: false, at: day(9) },
]
