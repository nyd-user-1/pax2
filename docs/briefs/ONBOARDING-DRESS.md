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

## Report

**Files changed**
- `src/app/signup/welcome/page.tsx`: the page now lays down /signup's ground: the `bg-pax2-mist` wrapper and the fixed `LandingGrid`, with its red pulse at the same 1.6 s.
- `src/components/onboarding/stepper.tsx`: the dress, applied to every step. The column sits on the lavender-to-mist gradient, painted beneath the grid with the column above it, exactly as /signup does. `FIELD` is auth-form's `FIELD` verbatim. The primary is auth-form's `BUTTON` with its lucide `ArrowRight`, sized to its label (`px-6`, not `w-full`) because it shares the action row with the back chevron. Skip and Connect YouTube are a white, slate-400 hairline, pax2-blue-text outline at the same 48px height. `Heading` is the sign-up h1: `TextType`, `font-display text-4xl text-pax2-blue`, centered, keyed on its text so each step types fresh. Labels are auth-form's `text-sm font-medium text-slate-700`. The dot rail's current dot is pax2 blue.

**Each step**
- About: typed blue centered heading; grey labels over the four rounded white inputs; blue Continue with arrow.
- Makes: typed heading; the three choices are now rounded white rows with a slate-400 hairline, turning pax2 blue with the light-blue focus ring when picked; Skip outline / blue Continue.
- Wants: typed heading with "Select all that apply" centered under it; the six tiles take the same hairline and picked state.
- Connect: typed heading; the Google error is a tinted notice row with an alert icon in the MailCheck row's shape; Connect YouTube is a full-width white outline; the footnote is unchanged.
- Upload: typed heading; the drop zone is dashed slate-400 with a lavender icon disc; file rows and the YouTube-match select are rounded white with the hairline; the progress bar is pax2 blue; "Getting your files from YouTube" is the lavender tinted notice row.
- Done: the typed heading (channel or all-set copy); the channel chips are unchanged; blue View analysis / Go to PAX with arrow.

**Not touched, and why**
- `src/components/onboarding/ingest.tsx` (ChannelCard, ChannelChip, the private/unlisted picker and its slate-950 Include button): /my-channels and /my-channels/[id] render the same components, so restyling them here would restyle those pages too, which is outside this brief. Their white slate-200 cards sit cleanly on the mist. If they should take the dress, that is a separate brief for both surfaces.
- No `LandingHeader`: its only action is Sign in / Sign up, which means nothing to a signed-in user. The original page had no header either.
- The brief calls the primary a "navy pill". The dress as built is `rounded-xl bg-pax2-blue`, not a pill, so the stepper copies what /signup ships.
- Logic, routes, actions, validation, step order and all copy are unchanged. No typecheck was run (8 GB rule). There is no "→" and no new paragraph under any heading.
