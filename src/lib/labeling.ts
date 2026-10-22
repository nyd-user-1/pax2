import codes from "../../data/generated/model/organic-codes.json"
import { featuresFile, homeFeedFile, referenceModelFile } from "@/lib/data-files"

const features = featuresFile()
const feed = homeFeedFile()
const model = referenceModelFile()

// The forty campaign shorts PAX2 Trait Labeler has coded on Swayable's traits from their
// transcripts (data/generated/model/organic-codes.json), and the traits as /labeling puts them to
// people. Humans label the same videos so the labeler's codes can be measured against them
// (scripts/consensus-agreement.mjs). A trait's tid is its index in reference-model.json's
// featureLabels; votes live in the ledger under the labeling workspace, conversation traits-<id>.

export const LABELING_WS = "labeling"
export const conversationOf = (videoId: string) => `traits-${videoId}`

export const TRAITS = Object.entries((model as { featureLabels: Record<string, string> }).featureLabels).map(([key, label], tid) => ({ tid, key, label }))

type Coded = { codes?: Record<string, number>; error?: string }
const F = features as unknown as Record<string, { transcript?: { text?: string } }>
const FEED = feed as { id: string; title: string; channel: string }[]

export const LABEL_VIDEOS = Object.entries((codes as { scripts: Record<string, Coded> }).scripts).map(([id, c]) => {
  const yt = id.replace(/^yt-/, "")
  const v = FEED.find((x) => x.id === yt)
  return { id, yt, title: v?.title ?? yt, channel: v?.channel ?? null, transcript: F[id]?.transcript?.text ?? null, coded: !!c.codes }
})
