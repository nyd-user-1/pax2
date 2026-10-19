// The demo accounts behind the sign-in corner's quiet "Terms and conditions" link: one login per
// sidebar audience. The credentials are public by design — the popover shows them to anyone who
// finds it — so the sandbox is the protection: a demo account makes and reads its own world
// (a demo admin sees only demo-owned videos) and can never publish, rescore, review, or touch
// the poller or the pipeline. No "server-only" here: the sign-in popover renders these.

export type DemoAccount = { role: string; line: string; email: string; password: string }

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: "Creator", line: "Make a video and watch it get scored", email: "creator@pax-demo.app", password: "Create-demo-26!" },
  { role: "Research", line: "The tracking, evidence and models", email: "research@pax-demo.app", password: "Research-demo-26!" },
  { role: "Admin", line: "The ops surfaces, hands off the levers", email: "admin@pax-demo.app", password: "Admin-demo-26!" },
]

export const DEMO_ADMIN = "admin@pax-demo.app"
export const DEMO_EMAILS = new Set(DEMO_ACCOUNTS.map((a) => a.email))
