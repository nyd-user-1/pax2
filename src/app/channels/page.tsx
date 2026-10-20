import { CardBlock } from "@/components/blocks"
import { ChannelCards, trackedChannels } from "@/components/channels-grid"

// The tracked catalog's channels, open to everyone. A user's own connected channels live at /my-channels.

export const dynamic = "force-dynamic"
export const metadata = { title: "Channels" }

export default async function ChannelsPage() {
  const channels = await trackedChannels()
  return (
    <CardBlock title={`Channels (${channels.length})`} height="auto">
      <ChannelCards channels={channels} />
    </CardBlock>
  )
}
