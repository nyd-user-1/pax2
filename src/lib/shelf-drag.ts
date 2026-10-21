// What a Blocks-shelf tile carries when it's dragged out of the panel, after livingston's drag-entity:
// a typed payload the chat reads on drop. A block travels as a reference (its page and anchor), read
// into context at drop time by /api/block-context; a short travels with what the shelf knows of it.

export const SHELF_MIME = "application/x-pax-shelf"

export type ShelfDrag =
  | { kind: "block"; title: string; path: string; anchor: string }
  | { kind: "video"; id: string; title: string; channel: string; ratio: number; duration: string }

export function setShelfDrag(dt: DataTransfer, d: ShelfDrag) {
  dt.setData(SHELF_MIME, JSON.stringify(d))
  dt.setData("text/plain", d.title)
  dt.effectAllowed = "copyMove"
}

export function readShelfDrag(dt: DataTransfer | null): ShelfDrag | null {
  try {
    const raw = dt?.getData(SHELF_MIME)
    if (!raw) return null
    const d = JSON.parse(raw) as ShelfDrag
    return d && (d.kind === "block" || d.kind === "video") ? d : null
  } catch {
    return null
  }
}

export const isShelfDrag = (dt: DataTransfer | null) => !!dt?.types.includes(SHELF_MIME)
