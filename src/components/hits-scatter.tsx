// Every catalog short as a dot: publish date across, views over its channel's median up (log scale),
// green for a Hit, red for a Miss. Each dot opens its video. Shown on /evidence's Outliers tab and on
// every video. The points are read here, on the server; the drawing, the tooltip and the search live in
// the client half (hits-scatter-canvas.tsx).

import { ScatterCanvas, type ScatterPoint } from "@/components/hits-scatter-canvas"
import { labVideos } from "@/lib/lab"

export { TIER } from "@/components/hits-tier"

export function scatterPoints(): ScatterPoint[] {
  return labVideos().map((v) => ({ id: v.id, title: v.title, channel: v.channel, published: v.published, views: v.views, ratio: v.ratio, tier: v.tier }))
}

/** `mark`: the video in view, added when the lab's set does not already hold it. */
export function HitsScatter({ mark }: { mark?: ScatterPoint } = {}) {
  const points = scatterPoints()
  if (mark && !points.some((p) => p.id === mark.id)) points.push(mark)
  return <ScatterCanvas points={points} mark={mark?.id} />
}
