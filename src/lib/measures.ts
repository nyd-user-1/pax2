import delivery from "../../data/generated/delivery.json"
import { COMPONENTS } from "@/lib/resonance"
import { METRICS } from "@/lib/types"
import { featuresFile, referenceModelFile } from "@/lib/data-files"

const features = featuresFile()
const referenceModel = referenceModelFile()

// Forecast Metrics on /dashboard: every distinct variable measured, across the paid results (the
// export's metrics), the pipeline's per-video features, the delivery and semantic coding, the
// research model's coded features and the score's components. Counted from the data, so a field
// a source adds is counted the day it lands. A per-second series (on-screen text second by
// second) counts once; bookkeeping (which model ran, where a value came from, raw output) is not
// a measurement.

const BOOKKEEPING = /(^take|^analyzedAt|\.source$|\.model$|\.ok$|\.raw$|^basis$)/

function variables(o: unknown, path = "", out = new Set<string>()): Set<string> {
  if (Array.isArray(o)) {
    if (o.length && typeof o[0] === "object" && o[0] !== null) o.forEach((x) => variables(x, `${path}[]`, out))
    else out.add(`${path}[]`)
  } else if (o && typeof o === "object") {
    for (const [k, v] of Object.entries(o)) variables(v, path ? `${path}.${/^\d+$/.test(k) ? "N" : k}` : k, out)
  } else out.add(path)
  return out
}

const fields = (perVideo: Record<string, unknown>) => {
  const all = new Set<string>()
  for (const v of Object.values(perVideo)) variables(v, "", all)
  return [...all].filter((k) => !BOOKKEEPING.test(k)).length
}

export function forecastMetrics() {
  const parts = {
    paid: METRICS.length,
    pipeline: fields(features as unknown as Record<string, unknown>),
    delivery: fields((delivery as unknown as { videos: Record<string, unknown> }).videos),
    coded: Object.keys((referenceModel as unknown as { featureLabels: Record<string, string> }).featureLabels).length,
    score: COMPONENTS.length,
  }
  return { total: Object.values(parts).reduce((a, b) => a + b, 0), parts }
}
