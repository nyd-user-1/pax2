# The platform deck — an HTML sketch

Build one self-contained HTML slide deck: `docs/sketches/platform-deck.html`. It states what this system is, what it measures, and what the measurements say. Commit by explicit path; do not push. No local typechecks.

## The source text, and the one rule about it

The text below is the deck's hidden skeleton. Mirror its structure and borrow its exact phrases as slide headings and row labels — but the deck never mentions this text, a company, a role, a job, hiring, or "requirements." No slide may read as a response to anything. It reads as a standalone statement of a built system, and the overlap of language does the work silently.

> Parallax Innovations is a civic communications lab building modern persuasion infrastructure for the movement to improve American democracy and elections. We combine technology, data, and services to help our partners reach, engage, and persuade voters. Our ambition is to build a closed-loop learning system that gets smarter every time we speak. Its AI core will connect the content we create with engagement data, audience research and experiments to learn which messages, messengers and formats work with which voters — and feed those lessons back into how we create, target and distribute the next communication.
>
> Accountabilities: Set platform strategy and capabilities roadmap: what it should measure, what its learning agenda will be, how it learns and improves quarter over quarter. Define the scoring framework: how content engagement and persuasion are quantified, how they are weighted, and how scores connect to real outcomes. Extend the intelligence platform beyond transcript-analysis so that it evaluates videos, including visuals, presenters, format and production choices. Make the model decisions: which commercial and open models to use and route between, whether fine-tuning or custom components are worth it, and the tradeoffs in cost, speed and accuracy. Build the data loop so that performance data from platforms, partners, audience surveys and experiments flows back into the platform cleanly. Oversee dashboards and reporting that explain what the platform is accomplishing. Prove that it works, explain its limits: back-test against historical content, compare predictions with actual results, check findings against survey and experimental (including RCT) evidence. Build the evals and guardrails that let the platform learn within defined limits, so its outputs can be trusted and explained. Turn intelligence into decisions: clear guidance on frame, format, messenger and audience; map the message-by-audience grid; package the intelligence so partners can use it.
>
> First 60 days: a scoring framework in place to enable strong week-to-week experiments. First six months: a working feedback loop connecting content, audience and outcome data; initial scoring and predictive capabilities tested against results.

## The deck

One slide per theme, in this order: the closed-loop learning system; the scoring framework; beyond transcript-analysis; the model decisions; the data loop; dashboards and reporting; prove that it works, explain its limits; turn intelligence into decisions; then a closing slide pairing the 60-day and six-month descriptions with what exists today.

Every claim on every slide is a fact from this repository, with its figure and its source:

- Counts from `data/generated/accounting.json` (catalog 19,057 shorts; baseline 5,379; transcripts 14,896) — read the file, do not trust these parentheses.
- The learning loops from `docs/briefs/WINDOW-P.md` and `WINDOW-P2.md` Reports: eleven loops, each registered before its fit, PASS and FAIL stated per loop, published to the private Hugging Face repo `NYSgpt/martian-learning-loops`.
- The Resonance formula from `data/generated/model/resonance-formula.json` (the fitted weights and held-out AUC as the file states them).
- The persuasion evidence from `docs/cards/pax2-persuasion-reference.md` (Swayable randomized ad tests; per-trait effects with intervals; its own stated limits).
- The visual census and codebook from `docs/briefs/WINDOW-Q.md` and `docs/briefs/CODEBOOK-5K.md` Reports **if they have landed when you build**; if a Report is not yet appended, the slide row states the run is in progress and names the measured figure that will replace it. Never invent the number.
- Surfaces by path: /dashboard, /evals, /pipeline, /pipeline-2, /reinforcement-learning, /metrics, the video page's evidence blocks.
- Model economics from `src/lib/production.ts` and the briefs: open weights on spot boxes with measured per-run costs beside bought inference where that is cheaper.

Honesty rows stay in: what the system does not yet hold (survey and experiment inlets carry machinery but no data until real publishes; audiences are channel categories, not voter segments; no partner portal). State each as a fact with its unlock, one line, no apology.

## Voice and dress

- Third person throughout. The deck never says "I" or "we," never names a model vendor or an assistant. Attribute work to the platform.
- Scientific voice: declarative sentences carrying a fact, a number, a mechanism. No metaphor, no hyperbole, no mood words. Uncertainty states its basis (interval, sample size, holdout).
- Defined terms come from `src/lib/glossary.ts` — one concept, one name ("outperformed 3x", "Resonance", "Outlier Score"). Never "breakout"; name the arithmetic.
- No lead-in paragraph under any heading. No caption that restates what a figure already shows. No "→" anywhere.
- Styling with care: a single HTML file, no external dependencies, no framework. Use the app's own palette and type choices (read `tailwind.config.ts` and the shell) rather than inventing a look. Arrow-key and scroll navigation, one slide per viewport, clean print. Charts, if any, are inline SVG, honest axes, no decoration.

## Report

Append `## Report`: the slide list as built, every figure's source file, which rows were marked in-progress and why, and anything deferred.

## Report

Built `docs/sketches/platform-deck.html`: one self-contained file, no external dependencies, nine slides, one per viewport (scroll snap), arrow keys / Page keys / Space / Home / End navigate, a dot rail on the right, landscape print one slide per page. Palette from `src/app/pax2.css` (pax2 blue, light blue, lavender, mist, above/below), type stack Plus Jakarta Sans and Geist Mono as `src/app/layout.tsx` loads them (system fallbacks, nothing fetched). Two inline SVG charts and one loop diagram. Third person throughout; no "→"; no vendor or assistant named; "breakout" absent.

### Slides as built

1. **The closed-loop learning system**: the loop (Create, Publish, Measure, Learn) and the learning agenda table, every loop's verdict by its registered rule.
2. **The scoring framework**: Outlier Score and outperformed 3x; Resonance Gen 1 (definition, formula, fitted weights); the persuasion layer; the outcome link; held-out AUC chart of the three components and the stack.
3. **Beyond transcript-analysis**: composition, winning modes, the composition pair picker, thumbnail traits, the failed video-embedding heads and video arm, the visual census and the ad codebooks; the presenter rule.
4. **The model decisions**: fine-tuning decided by held-out result (live and dropped), transcript routing, measured cost per run, the language routing.
5. **The data loop**: held-short counts per stage (bar chart), the poller, the partner paid export, the ledger, epoch markers; the survey/experiment inlet row.
6. **Dashboards and reporting**: /dashboard, /evals, /pipeline, /pipeline-2, /reinforcement-learning, /metrics, the video page's evidence blocks; the partner-portal row.
7. **Prove that it works, explain its limits**: back-test, predictions against results, RCT evidence, registration before fit, failures kept; the observational and transfer rows.
8. **Turn intelligence into decisions**: frame, format, messenger, next action; the message-by-audience grid row.
9. **Closing**: the 60-day and six-month descriptions as tile headings, each paired with what exists today; the Resonance generations as the next refit.

### Every figure's source

- `data/generated/accounting.json` (built 2026-10-22T17:24:44Z): catalog 19,057; index 18,307; media 15,762; transcripts 14,896; composition 5,979; baseline 5,379; transcript sources 13,105 / 1,212 / 579; the passed (15, two in build) and failed (9) ledgers and every model score quoted from them (classifier v2 0.597 vs 0.624, v3 0.648, video arm 0.636, video head v3 0.5695 vs 0.5776, early-hit 0.729 / 0.862, embedding +0.031, headline picker 0.672, re-scorer 0.572, composition pair 0.566 / 0.595).
- `data/generated/model/resonance-formula.json`: weights b0 0.1926, b_c 0.1573, b_x 0.1048, b_h 0.155; held-out rows 1,240 on 10 channels; AUCs 0.5835 / 0.5745 / 0.5815, stack 0.5977, within-channel 0.5963; the acceptance rule. Definition and generations from `docs/RESONANCE.md`.
- `docs/briefs/WINDOW-P.md` Report: the publish policy's DR topic +0.145 (+0.024, +0.273), 18,307 replayed rows, the epoch marker, NYSgpt/martian-publish-policy.
- `docs/briefs/WINDOW-P2.md` Report: loops 1–11 verdicts and intervals, 349 curves and 8 slates (0.875 against uniform 0.207), mode-match AUC 0.598 (0.568, 0.624), 1,191 remake candidates, 500 + 500 active-learning lists, the family counsel (30% to 49% of draws), the surviving winning mode, the 24 craft axes, $0 spend, NYSgpt/martian-learning-loops.
- `docs/cards/pax2-persuasion-reference.md`: 146 studies, 433 / 575 estimates, plain-folks +0.79 (0.32 to 1.25), explicit ask +0.59 (0.19 to 0.99), leave-one-study-out R² −0.001, the 2018/2020 transfer caveat.
- `src/lib/production.ts`: composition 5,106 shorts in 4,135 s, about $0.84; media 5,098 pairs, about $0.30; embedding retrain about 85 minutes, about $1.43.
- `data/generated/voter-freedom-paid.json`: 20 creatives, $41,570.87 spend, 10,561,553 impressions, 2026-09-28 to 2026-10-05.
- `src/lib/writer-prompt.ts` (citing `data/velocity/metadata-lift.json`): shorts of 20 seconds or less, +6.5 points (90% range 1 to 13; 6 channels, 56 shorts).
- `data/library.json`: the library scripts' line-by-line citations (Swayable, Upworthy, Wesleyan codebook, channel lifts).
- `src/lib/ledger.ts`: the append-only table.

### Marked in progress, and why

- **Visual census** (slide 3): `docs/briefs/WINDOW-Q.md` has no appended Report. The row cites its latest Progress line, 5,108 of 5,379 answered at 2026-10-22T22:09Z, and names the figure that replaces it: per-column audited accuracy and lift. Untracked `data/generated/model/vqa-*.json` files exist in the working tree; none of their numbers were used, since no Report vouches for them.
- **Ad codebooks** (slide 3): `docs/briefs/CODEBOOK-5K.md` has no appended Report. The row names what replaces it: per-trait agreement with the reference coder and the counts coded.

### Deferred, and choices stated

- The glossary's Resonance entry (`src/lib/glossary.ts`, the paid 0–100 score built from Engage, Interest and Act) is out of date against `docs/RESONANCE.md`; the deck follows `docs/RESONANCE.md`. The glossary entry is not changed here.
- Model economics name no model vendor: models are described by kind and size ("open-weights 4-billion-parameter vision-language model", "a hosted commercial model"). Infrastructure is named by what it is (self-terminating CPU and GPU boxes).
- No per-run cost exists yet for the census or the codebook batches; slide 4 states the census's $5 cap and leaves the measured cost to Window Q's Report.
- Not pushed.
