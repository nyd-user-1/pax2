# Onboarding joins the sign-up dress

Restyle the onboarding that follows account creation — today an all-white screen with its own h2 and plainer inputs — so it reads as a continuation of the new /signin, /signup and confirm-code screens. Restyle only: no step, field, action, or copy change beyond what the dress requires.

## The dress (read these, copy their idiom — do not invent)

- `src/app/signup/page.tsx` and `src/app/signup/sign-up-panel.tsx` — the gridded mist background, the centered display h2 in pax2-blue, grey field labels above rounded white inputs, the navy pill primary button with the ArrowRight icon, the muted link line beneath, the tinted notice row (the "We emailed a six-digit code" treatment).
- `src/app/signin/page.tsx` — the same dress on the sign-in side.

## The target

- `src/app/signup/welcome/page.tsx` and everything `src/components/onboarding/stepper.tsx` renders — every step of the flow, not just the first screen.
- Each step keeps its existing fields and actions; its heading becomes the centered display h2; inputs, buttons and links take the dress above; the whole step sits on the same gridded mist surface, centered as the sign-up screens are.

## Rules

- Restyle only. Logic, routes, actions, validation and step order stay untouched.
- No explainer paragraph under any h1/h2, and never the "→" character in UI text (AGENTS.md; the arrow in buttons is the lucide icon).
- Responsive in code; no browser testing — Brendan checks local dev.
- Do not run `tsc` or any typecheck locally (8 GB Mac rule). Read carefully instead.
- Stage by explicit path, commit when done; **do not push** — pushes batch through the monitor.
- Touch nothing outside the files named here plus any component the Stepper itself renders.

## Report

Append a `## Report` section to this file when done: files changed, what each step now looks like in one line each, and anything you chose not to touch and why.
