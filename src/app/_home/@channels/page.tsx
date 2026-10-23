import { CardBlock } from "@/components/blocks"
import { ChannelCards, trackedChannels } from "@/components/channels-grid"
import { HOME_BLOCK } from "../height"

// /home's third block: the /channels page in a parallel route slot. The page is itself a block, so the
// slot gives the same cards this block's height.

export const dynamic = "force-dynamic"

export default async function ChannelsSlot() {
  const channels = await trackedChannels()
  return (
    <CardBlock title={`Channels (${channels.length})`} name="channels" id="channels" height={HOME_BLOCK}>
      <ChannelCards channels={channels} />
    </CardBlock>
  )
}
