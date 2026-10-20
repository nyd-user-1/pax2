import { MainBlock } from "@/components/blocks"
import VideosPage from "../../videos/page"
import { HOME_BLOCK } from "../height"

// /home's second block: the /videos page, whole, in a parallel route slot.

export default function VideosSlot() {
  return (
    <MainBlock title="Videos" name="videos" id="videos" height={HOME_BLOCK}>
      <VideosPage />
    </MainBlock>
  )
}
