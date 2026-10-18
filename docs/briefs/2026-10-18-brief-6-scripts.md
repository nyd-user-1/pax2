# Brief 6: Requirement 2, Scripts

Written 2026-10-18 by the lead window for an executing window. No AWS spend beyond Bedrock calls while testing the writer, cents. No infrastructure. Do not spawn subagents. Do not push. Stage by explicit pathspec; other windows commit to this tree.

## Read first

`AGENTS.md`, `/Users/brendanstanton/.claude/CLAUDE.md`, `docs/SPEC.md` (requirement 2 and the model names), `docs/briefs/RIG-RULES.md` rules 15, 27, 28 and 29, `docs/HANDOFF-2026-10-18.md` (the hooks section), `src/app/actions.ts` (`writeScript`, the personal script from three answers), the script editor under `src/app/record/script/` and its five research checks, `src/lib/evaluate.ts` (how traits and the forecast are read), `src/lib/forecast.ts` (`recommendations()` and how it reads `data/velocity/metadata-lift.json`), `data/velocity/metadata-lift.json` (within-channel lifts for 23 pre-publish traits, by family), `data/generated/organic-patterns.json` (the 40 coded campaign shorts), `data/generated/model/script-codes.json` (the research prior per library script), `data/generated/swayable-patterns.json`.

Names: the real service every time. PAX2GPT is the rented language model behind the writer, Claude on Bedrock; say so in comments, never on screen. App copy is third person.

## What stands

Seven library scripts annotated with Swayable evidence; a personal script written from three answers; an editor with five research checks; a research prior per script. The gap: the writer and the checks know only the Swayable persuasion priors. They know nothing of what travels on the campaigns' own channels: the organic lifts in `metadata-lift.json` and the 40 coded shorts in `organic-patterns.json`.

## Part A: the writer

A1. One function, `src/lib/organic-evidence.ts`, reads `metadata-lift.json` and `organic-patterns.json` and returns, for a family (reform, voting-rights, nonpartisan, or all), the traits with a measured lift and its range, and the delivery patterns of the shorts that broke out, as short plain sentences with their numbers. One definition, imported by everything below; nothing re-reads the files.

A2. `writeScript`'s prompt gains a section "What travels on these channels" built from A1 for the campaign's family, after the Swayable section. The prompt tells the model to favor those traits where they fit and never to quote the numbers in the script itself.

A3. Test it by writing one personal script from three answers for a reform campaign and keeping the before and after in `docs/briefs/evidence/brief-6-writer.md`, with the prompt diff. Cents on Bedrock.

## Part B: the editor's checks

B1. A sixth check beside the five, from A1: does the script carry the traits that lift on its family's channels, and does it avoid the ones that sink. Each line of the check names the trait, the measured lift with its range, and the line of the script it refers to or "not present".

B2. The check's strength is stated as the lift file states it; never a promised uplift.

## Part C: the research prior

C1. The script that writes `script-codes.json` (find it under `scripts/`) adds the organic evidence to each library script's prior, so the Scripts page shows both sources per line, Swayable and the channels, each attributed.

## Report

Commit per part, subjects in this repository's prose style, file-scoped type checks before each (copy the files to the scratchpad, rewrite `@/` imports, compile with `--outDir`; full-project `tsc` and `eslint` are blocked by hooks, and so are the local dev server and local builds). When done, tell Brendan in a few lines what was built, what was left out, and how you ruled anything the brief left open. Then update `docs/SPEC.md` requirement 2's status line and requirement 2's entry in `src/lib/project-management.ts` to what is true.
