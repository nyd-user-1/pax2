// Every script /scripts lists, in its order: the library's, then the Voter Freedom adaptations.
// The chat's + menu loads this on demand, so the JSON stays out of the chat bundle.

import library from "../../data/library.json"
import vf from "../../data/generated/vf-scripts.json"

export type ListedScript = { id: string; title: string; framing: string; text: string }

export const SCRIPT_LIST: ListedScript[] = [
  ...library.scripts.map((s) => ({ id: s.id, title: s.title, framing: s.framing, text: s.text })),
  ...(vf.scripts as { id: string; title: string; hook: string; text: string }[]).map((v) => ({ id: `vf-${v.id}`, title: v.title, framing: v.hook, text: v.text })),
]
