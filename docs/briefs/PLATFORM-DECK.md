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
