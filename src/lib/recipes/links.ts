// A recipe card's `where` or `metrics` names a repository path, an S3 location or a Hugging Face
// id; each part that looks like one of those becomes a link. Parts are split on commas.

const REPO = "https://github.com/nyd-user-1/pax2/blob/main/"
const REPO_DIRS = /^(src|data|scripts|worker|lambda|docs|public)\//

export type LinkPart = { text: string; href: string | null }

export function hrefOf(raw: string): string | null {
  const t = raw.trim().replace(/\s+\S*$/, (m) => (/^\s+[a-z]\w*$/i.test(m) ? "" : m))
  if (/^https?:\/\//.test(t)) return t
  if (/^s3:\/\/[\w.-]+/.test(t)) return `https://s3.console.aws.amazon.com/s3/buckets/${t.slice(5).replace(/\/.*/, "")}?region=us-east-1&prefix=${encodeURIComponent(t.slice(5).replace(/^[^/]+\/?/, ""))}`
  if (REPO_DIRS.test(t)) return REPO + t.replace(/\/$/, "")
  if (/^(hf:|huggingface:)?[\w-]+\/[\w.-]+$/.test(t) && !/\.\w{2,5}$/.test(t)) return `https://huggingface.co/${t.replace(/^(hf:|huggingface:)/, "")}`
  return null
}

export function linkParts(value: string | undefined): LinkPart[] {
  return (value ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((text) => ({ text, href: hrefOf(text) }))
}
