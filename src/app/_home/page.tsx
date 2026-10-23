import { MainBlock } from "@/components/blocks"
import { HOME_BLOCK } from "./height"

// The fourth block, still empty, waiting for its content. The first three are the layout's slots.

export const metadata = { title: "Home" }

export default function HomePage() {
  return (
    <MainBlock title="" name="block-4" id="block-4" height={HOME_BLOCK}>
      <div />
    </MainBlock>
  )
}
