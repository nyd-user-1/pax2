import type { Metadata } from "next"
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google"

import "@/ui/styles/globals.css"
import { DevInspector } from "@/components/dev/inspector"
import { LoadCurtainGate } from "@/components/load-curtain-gate"
import { Shell } from "@/components/shell"
import { currentUser } from "@/lib/auth"

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans" })
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: { default: "PAX2", template: "%s · PAX2" },
  description: "Every advocacy video as a tested argument: a score that shows its math, evidence you can inspect, and the next test to run.",
}

export default async function RootLayout({ children, drawer }: LayoutProps<"/">) {
  const user = await currentUser()
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <head>
        {/* Every card's thumbnail comes from YouTube's image host; the handshake happens once, early. */}
        <link rel="preconnect" href="https://i.ytimg.com" />
      </head>
      <body className="min-h-dvh font-sans text-foreground antialiased">
        <LoadCurtainGate />
        <Shell drawer={drawer} signedIn={!!user} admin={!!user?.admin}>
          {children}
        </Shell>
        {process.env.NODE_ENV === "development" && <DevInspector />}
      </body>
    </html>
  )
}
