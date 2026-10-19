import Link from "next/link"
import { redirect } from "next/navigation"

import { myChannels } from "@/app/onboarding-actions"
import { ListBlock } from "@/components/blocks"
import { ChannelChip } from "@/components/onboarding/ingest"
import { currentUser } from "@/lib/auth"

// The user's connected YouTube channels; each opens its analysis at /channels/[id].

export const dynamic = "force-dynamic"
export const metadata = { title: "Channels" }

const connect = `/api/youtube/oauth?mode=connect&return=${encodeURIComponent("/channels")}`

export default async function ChannelsPage({ searchParams }: { searchParams: Promise<{ channel?: string; youtube_error?: string }> }) {
  if (!(await currentUser())) redirect(`/signin?next=${encodeURIComponent("/channels")}`)
  const [channels, q] = await Promise.all([myChannels(), searchParams])
  return (
    <ListBlock
      title="Channels"
      height="auto"
      tools={<a href={connect} className="ml-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-pax2-blue transition-colors hover:bg-slate-50">{channels.length ? "Connect another channel" : "Connect a YouTube channel"}</a>}
      footer={q.youtube_error ? <span className="text-pax2-red-deep">{q.youtube_error === "access_denied" ? "Google's consent was cancelled; nothing was connected." : q.youtube_error}</span> : undefined}
    >
      {channels.length ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {channels.map((c) => (
            <Link key={c.channelId} href={`/channels/${c.channelId}`} className="rounded-2xl transition-shadow hover:shadow-sm">
              <ChannelChip channelId={c.channelId} title={c.title} thumbnail={c.thumbnail} initial={c.progress} />
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No channel connected yet.</p>
      )}
    </ListBlock>
  )
}
