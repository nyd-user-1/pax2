# UI/UX: the sidebar regrouped, /chat as home, and the accounting page's Models and Flow tabs reworked

Three jobs, approved by Brendan 2026-10-22. Deterministic; restyle and rewire only what is named.

## 1. The sidebar (src/components/shell.tsx, the NAV list and `item` renderer)

Target order, from Brendan's mock:

- Chat (first; the Home row and `/app/home` leave the sidebar — the route itself stays)
- **Create** group with tree children: Record (`/recording`), Scripts (`/scripts`)
- **Explore** group with tree children: Channels, Tags, Videos
- **Lab** group with tree children: My Channels (`/my-channels`), My Videos (`/my-videos`)
- Learn
- RESEARCH section unchanged.

Groups are rows with their own icon; children indent on the trunk-and-elbow tree already in this repo (the comment-thread design — grep for it, never import a lookalike). Every item keeps its current lucide icon; new group rows: Create `Clapperboard`, Explore `Compass`, Lab `FlaskConical`. Group rows may link to their first child or just disclose — match how the mock reads (children always visible, no collapse).

## 2. /chat is the signed-in home

- Wherever sign-in and sign-up resolve their `next` parameter (start at `src/app/signin/page.tsx`, the auth actions, and the account chip's links), the default when `next` is absent or `/` becomes `/chat`.
- Sign-in reached from any other page keeps returning to that page — the existing `next=` machinery; change only the default.
- Do not touch the onboarding flow's own redirects (`/signup/welcome`).

## 3. The Models tab (scripts/accounting.mjs — edit the generator, then run `node scripts/accounting.mjs`)

- The Model column shows the name alone (no parenthetical); a new **Kind** column follows it: logistic regression, fine-tuned transformer, fine-tuned embedding, ridge regression, Bradley-Terry pairwise, projection head, residual k-means, reference — read each row's current name/description to assign honestly.
- Drop the Gate and Trained columns.
- Status column: exactly two values — **Live** (was serving) and **Staged** (was ready or parked; all three Ready rows become Staged).
- Failed table keeps its Why it failed column; same Name/Kind treatment.

## 4. The Flow tab (same generator)

- The trigger boxes (Record on camera, Upload a finished file) get `background pax2 blue (#1e3a8a), white text`.
- Add the models into the flow at the stage each serves: the headline picker at Scored; the classifier, encoder, reranker at Scored/analysis. Models not called by this flow pre-date the trigger: render them in a row **above** the trigger boxes (they are why the flow can score at all). Use the Models tab's Live/Staged names; keep each mention one short label.

## Rules

- No explainer paragraph under any heading; never the "→" character in UI text.
- Responsive in code; no browser testing; no local typecheck (8 GB rule) — read carefully.
- Stage by explicit path, commit when done; **do not push**.
- Touch nothing outside: `src/components/shell.tsx`, the sign-in/sign-up redirect sites, `scripts/accounting.mjs` + the regenerated `docs/ACCOUNTING.html`.

## Report

Append a `## Report` section here: files changed, one line per job on what shipped, anything left and why.
