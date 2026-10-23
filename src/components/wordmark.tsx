import { PaxMark } from "@/components/pax-mark"

/** The PAX wordmark: the static PAX mark (src/components/pax-mark.tsx). The drawn one is the root page's
 *  header and /chat's empty state (src/components/pax-draw.tsx). Kept as its own name so every caller stays as it is. */
export function Wordmark({ className, size = 22 }: { className?: string; size?: number }) {
  return <PaxMark className={className} size={size} />
}
