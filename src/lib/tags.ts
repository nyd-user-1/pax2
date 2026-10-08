import deliveryJson from "../../data/generated/delivery.json"

// A video's tags: the delivery read off the full analysis — energy, vocal tone, mode and frame — as
// plain words. Shown on the video and filterable on /tags.

type Delivery = { energy?: string; vocalTone?: string[]; mode?: string; frame?: string }
const DELIVERY = (deliveryJson as unknown as { videos: Record<string, Delivery> }).videos

export function tagsFor(id: string): string[] {
  const d = DELIVERY[id]
  if (!d) return []
  return [...new Set([d.energy && `${d.energy} energy`, ...(d.vocalTone ?? []), d.mode?.replace(/-/g, " "), d.frame?.replace(/-/g, " ")].filter((t): t is string => !!t))]
}

/** Every tagged video, by id. */
export function taggedVideos(): { id: string; tags: string[] }[] {
  return Object.keys(DELIVERY).map((id) => ({ id, tags: tagsFor(id) })).filter((v) => v.tags.length)
}

/** A tag's anchor on /tags. */
export const tagId = (tag: string) => `tag-${tag.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
export const tagHref = (tag: string) => `/tags#${tagId(tag)}`
