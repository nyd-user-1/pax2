import type { Metadata } from "next"
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google"

import "@/ui/styles/globals.css"
import { DevInspector } from "@/components/dev/inspector"
import { Shell } from "@/components/shell"
import { currentUser } from "@/lib/auth"

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans" })
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: { default: "Hermes", template: "%s · Hermes" },
  description: "Every advocacy video as a tested argument: a score that shows its math, evidence you can inspect, and the next test to run.",
}

export default async function RootLayout({ children, drawer }: LayoutProps<"/">) {
  const signedIn = !!(await currentUser())
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh font-sans text-foreground antialiased">
        <Shell drawer={drawer} signedIn={signedIn}>
          {children}
        </Shell>
        {process.env.NODE_ENV === "development" && <DevInspector />}
      </body>
    </html>
  )
}
