import { MainBlock } from "@/components/blocks"
import TagsPage from "../../tags/page"
import { HOME_BLOCK } from "../height"

// /home's first block: the /tags page, whole, in a parallel route slot.

export default function TagsSlot() {
  return (
    <MainBlock title="Tags" name="tags" id="tags" height={HOME_BLOCK}>
      <TagsPage />
    </MainBlock>
  )
}
