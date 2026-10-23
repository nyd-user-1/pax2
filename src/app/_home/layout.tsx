import type * as React from "react"

import { BlockOrder, OrderedBlock } from "@/components/dash/block-order"

// /home's blocks, each a parallel route slot: the /tags page, the /videos page, the /channels page,
// then the page's own (still empty) fourth block. They move with the block order's arrows.

// Typed by hand: unrouted (_home), it has no generated LayoutProps<"/home"> to carry its slots.
type Slots = { children: React.ReactNode; tags: React.ReactNode; videos: React.ReactNode; channels: React.ReactNode }

export default function HomeLayout({ children, tags, videos, channels }: Slots) {
  return (
    <BlockOrder page="home" initial={["tags", "videos", "channels", "fourth"]}>
      <OrderedBlock id="tags" label="Tags">
        {tags}
      </OrderedBlock>
      <OrderedBlock id="videos" label="Videos">
        {videos}
      </OrderedBlock>
      <OrderedBlock id="channels" label="Channels">
        {channels}
      </OrderedBlock>
      <OrderedBlock id="fourth" label="Block 4">
        {children}
      </OrderedBlock>
    </BlockOrder>
  )
}
