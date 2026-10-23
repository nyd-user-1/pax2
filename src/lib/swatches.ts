// Shades of blue and red from GovBlock's forecast and simulator (#1e3a8a #2563eb #60a5fa #dbeafe,
// #991b1b #dc2626 #f87171 #fee2e2). Kinds get solid chips; tags get soft ones, picked by name so a
// tag keeps its color everywhere.

const KIND: Record<string, { bg: string; fg: string }> = {
  Experiments: { bg: "#1e3a8a", fg: "#ffffff" },
  Models: { bg: "#2563eb", fg: "#ffffff" },
  "Ad libraries": { bg: "#dc2626", fg: "#ffffff" },
  Video: { bg: "#991b1b", fg: "#ffffff" },
  Elections: { bg: "#60a5fa", fg: "#172554" },
  Opinion: { bg: "#f87171", fg: "#ffffff" },
  Reference: { bg: "#dbeafe", fg: "#1e3a8a" },
  Code: { bg: "#fee2e2", fg: "#991b1b" },
  Report: { bg: "#172554", fg: "#ffffff" },
}

const TAGS = [
  { bg: "#dbeafe", fg: "#1e3a8a" },
  { bg: "#fee2e2", fg: "#991b1b" },
  { bg: "#bfdbfe", fg: "#1e3a8a" },
  { bg: "#fecaca", fg: "#7f1d1d" },
  { bg: "#eff6ff", fg: "#2563eb" },
  { bg: "#fef2f2", fg: "#dc2626" },
]

export const kindStyle = (k: string) => {
  const s = KIND[k] ?? KIND.Reference
  return { background: s.bg, color: s.fg }
}

export const tagStyle = (t: string) => {
  let h = 0
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0
  const s = TAGS[h % TAGS.length]
  return { background: s.bg, color: s.fg }
}
