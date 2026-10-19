import { DemoAccess } from "@/components/auth/demo-access"
import { LandingGrid } from "@/components/landing-grid"
import { LandingHeader } from "@/components/record/landing-header"
import { SignUpPanel } from "./sign-up-panel"

export const metadata = { title: "Sign up" }

// The landing's first screen (src/app/record/page.tsx) with the sign-up form where the hero stands:
// the same grid, header and ground. No curtain here, so the header arrives at once, PAX draws at
// 450 ms, and the grid's red pulse runs as the drawing finishes.
const PAX_DRAWN = 1600

export default function SignUpPage() {
  return (
    <div className="bg-pax2-mist">
      <LandingGrid pulseAt={PAX_DRAWN} />
      <LandingHeader arriveAt={0} signIn />
      {/* Not positioned, so the gradient paints beneath the fixed grid; the form, positioned, paints above it. */}
      <section className="-mt-16 flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-pax2-lavender to-pax2-mist px-6">
        <div className="relative w-full max-w-[451px]">
          <SignUpPanel />
        </div>
      </section>
      <DemoAccess />
    </div>
  )
}
