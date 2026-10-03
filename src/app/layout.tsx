import type { Metadata } from "next"
import { Geist_Mono, Plus_Jakarta_Sans, Source_Serif_4 } from "next/font/google"

import "@/ui/styles/globals.css"
import { Shell } from "@/components/shell"

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans" })
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })
const serif = Source_Serif_4({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-pax-serif" })

export const metadata: Metadata = {
  title: { default: "PAX", template: "%s · PAX" },
  description: "Every advocacy video as a tested argument: a score that shows its math, evidence you can inspect, and the next test to run.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable}`}>
      <body className="min-h-dvh font-sans text-foreground antialiased">
        <Shell>{children}</Shell>
      </body>
    </html>
  )
}
