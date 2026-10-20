"use client"

import * as React from "react"

// The Blocks shelf in the discussion panel. It holds a handful of shorts, and any block on any page can
// be added to it from the block's menu. What pressing a shelf item does is still to be decided.
// Added blocks live in this browser (localStorage), and every open view hears the list change.

export type ShelfVideo = { id: string; title: string; channel: string; ratio: number; duration: string }

// Hand-picked from home-feed.json: reform shorts with files on hand, strongest against their own
// channel's median first.
export const SHELF: ShelfVideo[] = [
  { id: "u98EznmnpGg", title: "More debate, not less", channel: "Open Primaries", ratio: 13.98, duration: "0:12" },
  { id: "H0m1eql9Uqk", title: "Just Join A Party To Vote", channel: "Open Primaries", ratio: 8.26, duration: "0:57" },
  { id: "M97WyXecL_A", title: "young voters shut out of system in NYC", channel: "Open Primaries", ratio: 5.96, duration: "0:59" },
  { id: "mV0zO4WIWWc", title: "What are Open Primaries?", channel: "Courageous Colorado", ratio: 4.89, duration: "0:45" },
  { id: "4HJT8ZzXvRE", title: "How We Can Fix Our Broken Elections", channel: "FairVote", ratio: 4.48, duration: "1:28" },
  { id: "THihu1i6k8Q", title: "Are Elections Rigged?", channel: "Courageous Colorado", ratio: 4.44, duration: "0:46" },
]

/** A block put on the shelf: where it lives (its page and anchor) and what it's called. */
export type ShelfBlock = { key: string; title: string; path: string; anchor: string; added: string }

const KEY = "pax2-shelf-blocks"
const EVENT = "pax2-shelf"

const read = (): ShelfBlock[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as ShelfBlock[]
  } catch {
    return []
  }
}
const write = (blocks: ShelfBlock[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(blocks))
  } catch {}
  window.dispatchEvent(new Event(EVENT))
}

// The shelf's order, dragged by hand: item keys, "b:" + a block's key or "v:" + a short's id.
const ORDER = "pax2-shelf-order"
const readOrder = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(ORDER) ?? "[]") as string[]
  } catch {
    return []
  }
}

export type ShelfItem = { key: string; block: ShelfBlock; video?: never } | { key: string; video: ShelfVideo; block?: never }

/** Everything on the shelf in its dragged order. Items the order hasn't met yet go where they belong
 *  by default: a newly added block first, a short last. */
function arrange(blocks: ShelfBlock[], order: string[]): ShelfItem[] {
  const all: ShelfItem[] = [...blocks.map((b) => ({ key: `b:${b.key}`, block: b })), ...SHELF.map((v) => ({ key: `v:${v.id}`, video: v }))]
  const byKey = new Map(all.map((i) => [i.key, i]))
  const placed = order.filter((k) => byKey.has(k))
  const fresh = all.filter((i) => !placed.includes(i.key))
  return [...fresh.filter((i) => i.block).map((i) => i.key), ...placed, ...fresh.filter((i) => i.video).map((i) => i.key)].map((k) => byKey.get(k)!)
}

/** The shelf: its items in order, and the ways to add, remove and move them. */
export function useShelf() {
  const [blocks, setBlocks] = React.useState<ShelfBlock[]>([])
  const [order, setOrder] = React.useState<string[]>([])
  React.useEffect(() => {
    const on = () => {
      setBlocks(read())
      setOrder(readOrder())
    }
    on()
    window.addEventListener(EVENT, on)
    window.addEventListener("storage", on)
    return () => {
      window.removeEventListener(EVENT, on)
      window.removeEventListener("storage", on)
    }
  }, [])
  const add = React.useCallback((b: Omit<ShelfBlock, "added">) => {
    const now = read().filter((x) => x.key !== b.key)
    write([{ ...b, added: new Date().toISOString() }, ...now])
  }, [])
  const remove = React.useCallback((key: string) => write(read().filter((x) => x.key !== key)), [])
  const items = React.useMemo(() => arrange(blocks, order), [blocks, order])
  /** Moves an item to where another sits (null: to the end). */
  const move = React.useCallback(
    (from: string, to: string | null) => {
      if (from === to) return
      const keys = items.map((i) => i.key).filter((k) => k !== from)
      const at = to == null ? keys.length : keys.indexOf(to)
      keys.splice(at < 0 ? keys.length : at, 0, from)
      try {
        localStorage.setItem(ORDER, JSON.stringify(keys))
      } catch {}
      window.dispatchEvent(new Event(EVENT))
    },
    [items],
  )
  return { blocks, items, add, remove, move, has: (key: string) => blocks.some((b) => b.key === key) }
}
