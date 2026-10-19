import type { RecipeTemplate, RecipeTemplateNode } from "@/lib/recipes/memorable"

// The closed loop as a recipe: the five stages ringed on the canvas, Record feeding in, the
// Learn-to-Score edge closing the cycle. Play on the toolbar walks the stages one by one, the way
// a prompt step runs on the Networks canvas. The counts in the notes are kept by hand at each
// refit, like every number on the Memorable recipe.

const step = (id: string, pos: { x: number; y: number }, fields: Record<string, string>): RecipeTemplateNode => ({ type: "step", id, pos, fields: { status: "running", ...fields } })

export const LOOPS: RecipeTemplate = {
  id: "loops",
  name: "Loops",
  nodes: [
    step("l-record", { x: -940, y: -450 }, { name: "Record", does: "Every video enters here: camera takes, Studio takes, a connected channel's uploads.", tool: "/recording, the Studio, channel connect", note: "19,036 shorts across 64 channels in the catalog." }),
    step("l-score", { x: -120, y: -450 }, { name: "Score", does: "The chance of a Hit before anything is posted, with every input's pull on the number.", tool: "PAX2 Classifier through src/lib/forecast.ts", note: "18,544 scored; AUC 0.611 with thumbnails; refit 2026-10-19." }),
    step("l-recommend", { x: 241, y: -187 }, { name: "Recommend", does: "The measured changes that move the odds, within channel, each with its range.", tool: "data/velocity/metadata-lift.json through forecast.ts", note: "8,808 shorts of evidence; refreshed 2026-10-19." }),
    step("l-publish", { x: 103, y: 237 }, { name: "Publish", does: "Approval, the upload, the watch-list write.", tool: "/publishing", note: "Unlisted until the client kickoff." }),
    step("l-track", { x: -343, y: 237 }, { name: "Track", does: "The poller reads every watched short around the clock; the live Hit call at 1, 3 and 6 hours.", tool: "the velocity poller, /live-tracking", note: "858 under watch; 165,711 readings." }),
    step("l-learn", { x: -481, y: -187 }, { name: "Learn", does: "Every settled curve refits the serving models; the refit writes the very files Score reads.", tool: "scripts/rig on a self-terminating box", note: "341 curves; both parity checks to 3e-5; refit 2026-10-19." }),
  ],
  edges: [
    ["l-record", "l-score"],
    ["l-score", "l-recommend"],
    ["l-recommend", "l-publish"],
    ["l-publish", "l-track"],
    ["l-track", "l-learn"],
    ["l-learn", "l-score"],
  ],
}
