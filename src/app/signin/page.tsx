import { AuthForm } from "@/components/auth/auth-form"
import { DemoAccess } from "@/components/auth/demo-access"
import { LandingGrid } from "@/components/landing-grid"
import { LandingHeader } from "@/components/record/landing-header"
import { ReadySetGo } from "@/components/auth/ready-set-go"
import TextType from "@/components/text-type"

export const metadata = { title: "Sign in" }

// The mirror of /signup: the landing's first screen with the sign-in form where the hero stands,
// and Sign up in the header. The header's left slot types its line where the PAX button stands
// elsewhere; the grid's red pulse keeps the landing's 1.6 s timing.
const PAX_DRAWN = 1600

export default function SignInPage() {
  return (
    <div className="bg-pax2-mist">
      <LandingGrid pulseAt={PAX_DRAWN} />
      <LandingHeader arriveAt={0} lead={<ReadySetGo className="text-xl md:text-2xl" />} />
      {/* Not positioned, so the gradient paints beneath the fixed grid; the form, positioned, paints above it. */}
      <section className="-mt-16 flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-pax2-lavender to-pax2-mist px-6">
        <div className="relative w-full max-w-[451px]">
          <div className="mb-8 text-center">
            <TextType as="h1" text="Welcome back" loop={false} typingSpeed={70} className="font-display m-0 text-4xl font-normal text-pax2-blue" />
          </div>
          <AuthForm mode="signin" />
        </div>
      </section>
      <DemoAccess />
    </div>
  )
}
