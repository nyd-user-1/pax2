import type { Item, Message, Source } from "@/components/connect-view"
import type { Result } from "@/lib/connect-types"

// What the Slack and Discord views hold until each is connected: the same list and stream, filled with
// sample content, posting off. Discord's channels and the policy forum's posts are the NYSgpt server's
// own, as govblock's bot read them on 2026-10-23; every message, and every Slack channel, is a sample.

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
const ok = <T,>(data: T): Promise<Result<T>> => Promise.resolve({ ok: true, data })
const ME = "Brendan Stanton"
const msg = (id: string, author: string, minutes: number, text: string): Message => ({ id, author, authorId: null, avatar: author === ME ? "/avatars/default.jpg" : null, at: ago(minutes), text, files: [] })

const SLACK_CHANNELS: Item[] = [
  { id: "general", name: "general", icon: "hash" },
  { id: "pax", name: "pax", icon: "hash" },
  { id: "scripts", name: "scripts", icon: "hash" },
  { id: "random", name: "random", icon: "hash" },
  { id: "team", name: "team", icon: "lock" },
]

const SLACK_MESSAGES = () => [
  msg("s1", "Jordan", 180, "Fix American Politics is at 2.8× Unite America's channel median. Closed Primaries Cause Gridlock is at 1.6×."),
  msg("s2", "Alex", 160, "Taxation Without Representation? is at 2.1× for Voter Freedom. All three have run through every stage."),
  msg("s3", ME, 60, "The chat's Videos menu now holds the four end-to-end videos and seven more from Voter Freedom."),
  msg("s4", "Jordan", 25, "I'm recording No Need to Listen this afternoon in record mode."),
  msg("s5", ME, 5, "Post the take here when it's scored."),
]

const DISCORD_CHANNELS: Item[] = [
  { id: "nysgpt-general", name: "nysgpt-general", icon: "hash" },
  { id: "leuk-community", name: "leuk-community", icon: "forum" },
  { id: "44b-ai-library", name: "44b-ai-library", icon: "hash" },
  { id: "nysgpt-ai-commons", name: "nysgpt-ai-commons", icon: "forum" },
  { id: "policy", name: "policy", icon: "forum" },
  { id: "gov-blocks-feedback", name: "gov-blocks-feedback", icon: "forum" },
]

const post = (id: string, name: string, count: number): Item => ({ id, name, icon: "hash", sub: `${count} ${count === 1 ? "reply" : "replies"}` })

const DISCORD_POSTS: Record<string, Item[]> = {
  "leuk-community": [post("lc1", "Introductions", 4), post("lc2", "Coverage questions", 2)],
  "nysgpt-ai-commons": [post("ac1", "Model releases this week", 2), post("ac2", "Reading list", 5)],
  policy: [post("p1", "NYS RAISE Act", 3), post("p2", "New York Housing Bills", 1)],
  "gov-blocks-feedback": [post("gf1", "Home page needs work.", 1), post("gf2", "Bill pages", 3)],
}

const DISCORD_MESSAGES = () => [
  msg("d1", "Maria", 300, "Is there an open-primaries short written for New York voters?"),
  msg("d2", ME, 240, "Closed Primaries Cause Gridlock is the closest. It ran 1.6× Unite America's channel median."),
  msg("d3", "Sam", 120, "Voter Freedom's Taxation Without Representation? ran 2.1× theirs."),
  msg("d4", "Maria", 40, "I'll draft a New York version from the scripts page and post it here."),
]

export function mockSource(service: "slack" | "discord"): Source {
  return service === "slack"
    ? { items: () => ok(SLACK_CHANNELS), read: () => ok(SLACK_MESSAGES()), send: null, members: null }
    : { items: (forum) => ok(forum ? (DISCORD_POSTS[forum] ?? []) : DISCORD_CHANNELS), read: () => ok(DISCORD_MESSAGES()), send: null, members: null }
}
