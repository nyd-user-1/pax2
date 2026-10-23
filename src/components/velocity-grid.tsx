"use client"

import { useEffect, useRef, useState } from "react"

import { moreVelocityCards, type VelocityFilter, type VelocitySort } from "@/app/velocity-actions"
import type { VelocityCard } from "@/lib/lab"
import { CurveCard } from "@/components/velocity-curve"

// The tracker's card grid: the first batch arrives server-rendered, the rest load as the
// sentinel under the grid scrolls into reach.

export function VelocityGrid({ initial, total, focus, sort, filter, ids }: { initial: VelocityCard[]; total: number; focus?: string; sort: VelocitySort; filter: VelocityFilter; ids?: string[] }) {
  const [cards, setCards] = useState(initial)
  const [done, setDone] = useState(initial.filter((c) => c.hours != null).length >= total)
  const fetched = useRef(initial.filter((c) => c.hours != null).length)
  const loading = useRef(false)
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || done) return
    const io = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting || loading.current) return
      loading.current = true
      const { cards: next, total: t } = await moreVelocityCards(fetched.current, focus, sort, filter, ids)
      fetched.current += next.length
      setCards((prev) => {
        const seen = new Set(prev.map((c) => c.id))
        return [...prev, ...next.filter((c) => !seen.has(c.id))]
      })
      if (next.length === 0 || fetched.current >= t) setDone(true)
      loading.current = false
    }, { rootMargin: "600px" })
    io.observe(el)
    return () => io.disconnect()
  }, [done, focus, sort, filter, ids])
  return (
    <>
      {/* pt-3: a card's hover plate reaches 12px past it, and the block's scroll box would clip the top row's. */}
      <section className="grid gap-8 pt-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <div key={c.id} data-find>
            <CurveCard c={c} href={`/v/yt-${c.id}`} focused={c.id === focus} />
          </div>
        ))}
      </section>
      {!done && <div ref={sentinel} aria-hidden className="h-10" />}
    </>
  )
}
