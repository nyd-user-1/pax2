"use client"

import StrokeText from "@/components/stroke-text"

import "./load-curtain.css"

// The A's crossbar, the font's own second contour, in PAX Curtain's units (1000 to the em; the A starts
// after P's 600-unit advance). Drawn whole, it crosses over both legs.
const STRIPE = [
  [153, 141],
  [190, 273],
  [410, 273],
  [447, 141],
]

/** The PAX mark drawing itself, as on the root page's header button, without the button: navy strokes
 *  and fill, the A in red with its crossbar white. The box holds the font's full line box so nothing
 *  moves as it draws. */
export function PaxDraw({ size = 34 }: { size?: number }) {
  const s = size / 1000
  const stripe = STRIPE.map(([x, y]) => `${(600 + x) * s},${-y * s}`).join(" ")
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
        overlay={<polygon data-after-fill points={stripe} style={{ fill: "#fff", opacity: 0 }} />}
      />
    </span>
  )
}
