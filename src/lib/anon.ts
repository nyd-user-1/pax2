import "server-only"

import { cookies } from "next/headers"

import { currentUser } from "@/lib/auth"

// The signed-out allowance: /chat and the create flow stay open for a taste — a few questions,
// a couple of written scripts, a handful of voice reads — and then the account is the way on.
// A browser cookie carries the count; wiping it buys another taste, which is fine: the point
// is a nudge toward signing up, not a wall.

const LIMITS = { chat: 5, write: 2, voice: 6, generate: 2 } as const

export async function anonSpend(kind: keyof typeof LIMITS): Promise<void> {
  if (await currentUser()) return
  const jar = await cookies()
  const key = `pax2_anon_${kind}`
  const n = Number(jar.get(key)?.value ?? "0") || 0
  if (n >= LIMITS[kind]) throw new Error("You've reached the free limit — sign up to keep going, it's quick.")
  jar.set(key, String(n + 1), { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax" })
}
