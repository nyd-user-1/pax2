# The VC deck — a minimal story deck

Build `docs/sketches/vc-deck.html`. Leave `docs/sketches/platform-deck.html` untouched — this is a second deck with a different job. That one states the system; this one tells the story to an investor who has never seen it. Commit by explicit path; do not push. No local typechecks.

## The job

Product demo, not technical specs. One idea per slide, very few words, big type, generous air. 8 to 12 slides. A reader should get the whole arc in ninety seconds without a presenter.

The arc:

1. **What it is** — one line. A platform that learns what makes short political video work, and feeds every lesson into the next video.
2. **The problem** — campaigns make vertical video blind: creative is guessed, measured late or never, and every lesson dies with its campaign. Say it plainly in two or three short lines.
3. **Why now** — voters are on Shorts, Reels and TikTok; measuring video at scale used to cost a research department and now costs single-digit dollars. (True in this repo: tonight's full visual census of 5,379 videos ran for under $5. Use that fact.)
4. **The loop** — the heart slide. Publish, measure, learn, advise the next video. Draw it as a circle, simply. Every video makes the next one smarter.
5.–7. **Three feature stories**, one slide each, told as moments:
   - A creator records a take. Before it publishes, the platform scores it and names the two changes most likely to move viewers — grounded in 617 randomized political-ad experiments, not opinion.
   - Any video, one button: nine checks later the platform knows what the video has, what it's missing, and what unlocks it (the flask and scan screen).
   - The model shows its work: a public ledger of every belief it has updated — what arrived, what it believed before and after, which advice changed (/reinforcement-learning).
8. **The moat** — a measured corpus of 19,057 political shorts that grows daily; learning loops whose evaluation rules are registered before any fit, so the findings can be trusted and sold; a persuasion evidence base from randomized experiments wired into the creative tools.
9. **The value** — for a campaign: supporters become creators with guidance that has grounds; spend goes to the videos the early hours already favor; lessons compound across campaigns instead of dying with them.
10. **Close** — the vision in one line. No ask, no financials; invent nothing.

## Facts and claims

Every number on a slide is a fact from this repository and carries no more precision than its source: counts from `data/generated/accounting.json`; the loops and verdicts from `docs/briefs/WINDOW-P.md` / `WINDOW-P2.md`; the evidence base from `docs/cards/pax2-persuasion-reference.md`; costs from `src/lib/production.ts` and the briefs. Use numbers sparingly — this deck persuades with the story, and three true numbers beat ten. No invented metrics, no market-size figures, no projections.

## Voice and dress

- Third person throughout: the platform does things; no "I", no "we", no model vendor or assistant named anywhere.
- Plain spoken English, short declarative lines. No hyperbole, no mood words, no jargon; a term that needs the glossary doesn't belong on a slide. Warmth comes from the story, not adjectives.
- Defined terms that do appear use their exact names (`src/lib/glossary.ts`); never "breakout" — name the arithmetic if a slide needs it.
- No lead-in paragraph under any heading; no caption restating a visual; no "→".
- Single self-contained HTML file, no external dependencies. The app's own palette and type (read `tailwind.config.ts` and the shell). Arrow-key and scroll navigation, one slide per viewport, clean print. If the loop drawing needs art, inline SVG, minimal.

## Report

Append `## Report`: the slide list as built, each number's source, and anything deferred with why.
