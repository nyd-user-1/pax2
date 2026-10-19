import { PaxMark } from "@/components/pax-mark"

/** The PAX wordmark everywhere outside the root page: the static PAX mark (src/components/pax-mark.tsx).
 *  The animated curtain is the root page's alone. Kept as its own name so every caller stays as it is. */
export function Wordmark({ className, size = 22 }: { className?: string; size?: number }) {
  return <PaxMark className={className} size={size} />
}
