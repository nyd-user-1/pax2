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

## Report

**Files changed**: `src/components/shell.tsx`, `src/components/auth/auth-form.tsx`, `scripts/accounting.mjs`, `docs/ACCOUNTING.html` (regenerated).

1. **Sidebar.** `NAV` is now `NAV_TREE`, in this order:
   - Chat.
   - Create (`Clapperboard`): Record, Scripts.
   - Explore (`Compass`): Channels, Tags, Videos.
   - Lab (`FlaskConical`): My Channels, My Videos.
   - Learn.

   Group rows are plain rows with an icon and no link; their children are always open. The children hang on the existing comment-thread trunk-and-elbow lines, now drawn from each group's icon. Home is off the sidebar; `/app/home` still resolves. A flat `NAV` is derived from the tree, so search and the phone strip list every page with no group rows. Research and Admin are unchanged.
2. **/chat as home.** Every sign-in path resolves through `nextPath()` in auth-form, which covers the account chip, the gate's links, the landing header and every `?next=` redirect. Its sign-in default is now `/chat`, and a `next` of `/` counts as absent. An explicit `next` still wins. Sign-up with no `next` still goes to `/signup/welcome`.
3. **Models tab.**
   - Model holds the name alone; Kind follows it.
   - Each Kind comes from the model's own training code: `scripts/rig/*.py`, `pairwise/train.mjs`, `composition/fit.mjs`, `video-resonance/train.py`, the `var-model*.json` methods.
   - Gate and Trained are gone. Status is Live (the seven serving rows) or Staged (the three ready rows plus the two parked ones).
   - Failed keeps "Why it failed" and gets the same Name and Kind columns.
4. **Flow tab.**
   - The two trigger boxes are pax2 blue (#1e3a8a) with white text.
   - Headline picker, Outlier classifier v3, Behavior-corrected text embedding and Candidate re-scorer sit as chips under Scored.
   - The other nine passed models sit as a chip row above the triggers.
   - Chip names are read from the ledger, and the generator throws if a Scored name drifts.

**Judgment calls and leftovers**
- Several scores only made sense next to the Gate column (for example "E +0.027; B 0.582", "under it", a bare "0.672"). Each now names its metric and, where a failure depends on it, the bar it missed. The numbers are unchanged.
- Create's Clapperboard is also Videos' icon, and Lab's FlaskConical is also Score method's. The brief fixed both, so the duplicates stand.
- The header title for `/recording` still reads "Create" while the row reads Record. `TITLES` was not named in the brief, so it was left alone.
- The onboarding exit to `/app/home` was left alone, per the rule on the onboarding flow's own redirects.
- A "→" remains in `docs/ACCOUNTING.html`, inside one YouTube video's title in the data. It is not UI copy.
- No typecheck was run (8 GB rule). Not pushed.
