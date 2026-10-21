// The record-mode interview asks with real controls: the assistant emits a ```pax-fields```
// block (a JSON array of fields) and the transcript renders actual inputs in its place.
// Ported from from-sam's livingston-fields protocol (src/lib/form-fields.ts), slimmed to the
// onboarding's needs: three kinds, no stored record behind it. The user can always ignore the
// controls and answer in the chat box — both roads are the same turn to the model.

export type ChatFieldKind = 'text' | 'textarea' | 'choice'

export interface ChatField {
  key: string
  label: string
  kind: ChatFieldKind
  options?: string[]
  placeholder?: string
}

const BLOCK = /```pax-fields\s*([\s\S]*?)```/
const OPEN_BLOCK = /```pax-fields[\s\S]*$/
const KINDS: ChatFieldKind[] = ['text', 'textarea', 'choice']

/** Read the field block out of a message, if there is one. */
export function parseFieldBlock(text: string): ChatField[] | null {
  const m = BLOCK.exec(text)
  if (!m) return null
  let raw: unknown
  try {
    raw = JSON.parse(m[1].trim())
  } catch {
    return null
  }
  const list = Array.isArray(raw) ? raw : [raw]
  const out: ChatField[] = []
  for (const r of list) {
    if (!r || typeof r !== 'object') continue
    const f = r as Record<string, unknown>
    const key = typeof f.key === 'string' ? f.key.trim() : ''
    const label = typeof f.label === 'string' ? f.label.trim() : ''
    if (!key || !label) continue
    const options = Array.isArray(f.options) ? f.options.filter((o): o is string => typeof o === 'string' && o.trim() !== '') : undefined
    const kind = KINDS.includes(f.kind as ChatFieldKind) ? (f.kind as ChatFieldKind) : 'text'
    // A choice with nothing to choose from is a text box, not a dead row of chips.
    out.push({
      key,
      label,
      kind: kind === 'choice' && !options?.length ? 'text' : kind,
      options,
      placeholder: typeof f.placeholder === 'string' ? f.placeholder : undefined,
    })
  }
  return out.length ? out : null
}

/** The block is scaffolding; it never belongs in the prose. */
export const stripFieldBlock = (text: string) => text.replace(BLOCK, '').replace(/\n{3,}/g, '\n\n').trimEnd()

/** A block still streaming in — fence open, not yet closed — would otherwise show as raw JSON
 *  until it completes. Once whole blocks are stripped, an opening fence left is an open one. */
export const stripOpenBlock = (text: string) => text.replace(OPEN_BLOCK, '').trimEnd()

/** The user turn the controls send: readable lines, the same words a typed answer would use. */
export const answersText = (fields: ChatField[], values: Record<string, string>) =>
  fields
    .filter((f) => (values[f.key] ?? '').trim())
    .map((f) => `${f.label}: ${values[f.key].trim()}`)
    .join('\n')
