# The glossary rewrite — every definition checked against ground truth

`src/lib/glossary.ts` is the app's vocabulary: 48 entries in six groups, linked by Term chips from six surfaces. It has drifted from the rulings — the Resonance entry still describes the old paid 0–100 score. Rewrite it entry by entry against the sources below. Commit by explicit path; do not push. No local typechecks.

## Hard rules

- **Every `id` stays exactly as it is.** Chips link by id; renaming one breaks surfaces silently. Grep each id's usages before touching anything else about it. Entries may be added where a surface uses an undefined term; an entry may be removed only if a grep shows no usage anywhere.
- Scientific voice: each definition states what the term is, its arithmetic or mechanism, and where the number comes from. No metaphor, no synonyms for defined terms, never "breakout" — name the arithmetic ("share of shorts over 3x their channel median").
- One concept, one name: "outperformed 3x", "Outlier Score", "Resonance" are the approved names; definitions must not coin alternatives.

## Ground truth, by group

- **Score** (16 entries): `docs/RESONANCE.md` is authoritative for Resonance — the registered formula, not the old paid score; `data/generated/model/resonance-formula.json` for the fitted weights and held-out AUC; `docs/RESONANCE-STD.html` and `docs/RESONANCE-COMPARE.html` where they state the standard; the outperformed-3x arithmetic as the briefs register it.
- **Campaigns** (10): `docs/cards/pax2-persuasion-reference.md` (Swayable — keep its stated limits in the definition), `data/library.json`, `docs/PARTNER-CSV.html` and `data/generated/voter-freedom-paid.json` for the paid flight terms.
- **Engagement / Delivery**: `docs/ANALYTICS-API.html` and `docs/DATA-API.html` for what each measured field actually is; `docs/CORPUS.html` and `data/generated/accounting.json` for corpus terms and counts (state counts as "as of the accounting run," never hardcoded as timeless).
- **Graph / House**: `docs/HOUSE.html`, `docs/HOME.html`, `docs/PROPOSALS.html`, `docs/STUDIO-ONLY.html`.
- **The learning loops**: `docs/briefs/WINDOW-P.md` and `WINDOW-P2.md` Reports for any term about the publish policy, registration, or off-policy evaluation.
- **Tonight's landings**: if `docs/briefs/WINDOW-Q.md` and `docs/briefs/CODEBOOK-5K.md` carry appended Reports when you work, add or update entries for the census columns and the three codebooks from those Reports; if not yet landed, define them from the briefs and the persuasion reference and mark nothing as measured that isn't.
- Where an HTML doc and a `.md` ruling disagree, the `.md` ruling wins; name the conflict in the Report instead of papering over it.

## Report

Append `## Report`: every entry changed with the source that ruled it, entries added or removed with their usage grep, conflicts found between sources, and anything left stale deliberately with why.
