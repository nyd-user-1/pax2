import { cn } from "@/ui/lib/utils"

/** The site's white button, taken from section two's Try it: white, a slate-400 hairline, pax blue
 *  text, shadow-md; on hover the border turns pax blue over a slate-50 wash. One look in three
 *  sizes — lg (Try it), md (Sign up and every other labelled white button), circle (icon buttons) —
 *  and `float` adds the scroll cue's slow drift. Pass extra classes for layout only. */
export function whiteButton(size: "lg" | "md" | "circle", ...extra: (string | false | undefined)[]) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-slate-400 bg-white font-medium text-pax2-blue shadow-md outline-none transition-colors hover:border-pax2-blue hover:bg-slate-50 aria-pressed:border-pax2-blue data-[popup-open]:border-pax2-blue disabled:cursor-not-allowed disabled:opacity-60",
    size === "lg" && "px-7 py-4 text-base",
    size === "md" && "px-5 py-2.5 text-sm",
    size === "circle" && "size-10",
    ...extra,
  )
}

export const FLOAT = "float-cue"
