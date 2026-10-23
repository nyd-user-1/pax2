import fs from "node:fs"
import path from "node:path"

import { notFound, redirect } from "next/navigation"

import topicLift from "../../../data/generated/model/topic-lift.json"
import { RLIndex, RLProvider, RLSteps, type RLData, type RLEvent } from "@/components/rl/changelog"
import { currentUser } from "@/lib/auth"

// The learning loop's changelog (docs/briefs/POLICY-LEDGER.md): every learning event of the publish
// policy as a step, newest first. The replay of the settled catalog is the first history, the last
// rows logged by scripts/policy/fit.py with their weights and advice before and after each update;
// events after the epoch marker (a client's own publishes) join here when they exist.

export const dynamic = "force-dynamic"
export const metadata = { title: "Reinforcement learning" }

type EventsFile = { builtAt: string; replayRows: number; features: string[]; events: RLEvent[] }
type ModelFile = { epochMarker: { replayRows: number; lastReplayedPublished: string } }

// Each call names its file by a literal path: a variable path makes the build trace the whole project.
const read = <T,>(text: () => string): T | null => {
  try {
    return JSON.parse(text()) as T
  } catch {
    return null
  }
}

export default async function ReinforcementLearningPage() {
  const user = await currentUser()
  if (!user) redirect("/signin?next=/reinforcement-learning")
  if (!user.admin) notFound()
  const file = read<EventsFile>(() => fs.readFileSync(path.join(process.cwd(), "data/generated/model/martian-publish-policy-events.json"), "utf8"))
  const model = read<ModelFile>(() => fs.readFileSync(path.join(process.cwd(), "data/generated/model/martian-publish-policy.json"), "utf8"))
  const topicNames = Object.fromEntries((topicLift.topics as { id: number; name: string }[]).map((t) => [t.id, t.name]))
  const data: RLData = {
    replayRows: model?.epochMarker.replayRows ?? file?.replayRows ?? 0,
    lastReplayed: model?.epochMarker.lastReplayedPublished ?? file?.events[0]?.published ?? new Date().toISOString(),
    features: file?.features ?? [],
    topicNames,
    events: file?.events ?? [],
  }
  return (
    <RLProvider data={data}>
      <div className="flex items-start gap-10">
        <div className="mx-auto flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 px-1 py-6 lg:py-8">
          <RLSteps />
        </div>
        <aside className="sticky top-24 hidden max-h-[calc(100dvh-8rem)] w-52 shrink-0 overflow-y-auto py-8 xl:block">
          <RLIndex />
        </aside>
      </div>
    </RLProvider>
  )
}
