"use client"

import StrokeText from "@/components/stroke-text"

import "./load-curtain.css"

/** The PAX mark drawing itself, as on the root page's header button, without the button: navy strokes
 *  and fill, the A in red. The box holds the font's full line box so nothing moves as it draws. */
export function PaxDraw({ size = 34 }: { size?: number }) {
  return (
    <span className="flex items-center text-pax2-blue [&_[data-fill-char]:nth-child(2)]:fill-pax2-red [&_[data-stroke-char]:nth-child(2)]:stroke-pax2-red" style={{ width: (size * 96) / 34, height: (size * 48) / 34 }}>
      <StrokeText
        text="PAX"
        strokeColor="currentColor"
        fillColor="currentColor"
        strokeWidth={1}
        fontSize={size}
        fontFamily="'PAX Curtain', monospace"
        letterSpacing={0}
        drawDuration={0.9}
        fillDelay={0.1}
        stagger={0.08}
      />
    </span>
  )
}
