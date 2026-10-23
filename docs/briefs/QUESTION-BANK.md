# The question bank — every question the measurements can already answer, asked like a human

The suggested prompts today are not questions a person would ask, and they undersell what the platform measures. Fix both: build the full universe of free questions — answerable instantly from stored measurements, no GPU, no box — and ship them as the suggested-prompt chips. `docs/roadmap/roadmap-1.html` ("Video question bank") is the seed; its reader-voice chips set the register ("What happens in the first two seconds?"). Commit by explicit path; do not push. No local typechecks.

## 1. Inventory what can be answered for free

Walk the stores and list every measurement a question can resolve to: composition (shots, cuts, pacing, the loudness curve, every on-screen-text moment), transcripts with word timings, the serving index (nearest neighbors), velocity (views, outperformed 3x, channel medians, the 72-hour curves), the census seven with their audited accuracies (`data/generated/model/vqa-census.json`, accuracies in `docs/briefs/WINDOW-Q.md`'s Report), the codebook three once `data/generated/codebook.json` carries real codes, topic clusters and the measured lifts, the winning-modes craft axes, the Swayable lean, the publish policy's advice. The Report lists the inventory.

## 2. Write the questions

For each measurement, questions in the reader's voice — what a creator or partner would actually tap, not what the column is named. Target 40 to 80, each with: the question as shown, the columns it reads, and the answer template. Three registers, all present:

- **The video in hand**: "What happens before my first word lands?" "When should I ask viewers to act?" "What does this look like on mute?" "Show me every moment with on-screen text."
- **Against the field**: "Why might this one have outperformed?" "What do videos like this one do differently?" "What's different about my best video?"
- **What to do**: questions whose answers end in a grounded recommendation — only where the registry holds a measured lift; the citation renders with it.

The bar for every question: a human would ask it unprompted, and the answer demonstrates measurement — a number, a timestamp, a comparison with its basis. A question whose data is missing for a given video renders its unlocking action (the metrics pattern: run the flask, add captions), never an apology and never an invented answer.

## 3. Build the answering layer and bank it

One definition file (question id, phrasing, resolver, template) and one resolver lib over the existing stores — typed lookups, no model call anywhere in this brief. Precompute the expensive joins per baseline video into `data/generated/question-bank.json`; resolve the cheap ones at render. State the file's size in the Report; over 8 MB, per-video on S3 read server-side.

## 4. Ship the chips

The roadmap's placement: chips on the video page's chat side panel and in /chat when a video is attached. Render from the bank; log `chip-shown` (position, propensity, surface) and `chip-tap` exactly as `learning/chat-suggested-prompts.json` registers them, so loop 9's bandit starts learning which questions humans ask the moment chips exist.

## Rules

- Question phrasing is conversational; answer templates are scientific voice — a fact, a number, a basis. Defined terms from `src/lib/glossary.ts`; never "breakout"; no "→"; no identity or demographic inference anywhere.
- Where a census column answers, the answer carries its audited accuracy once, quietly ("read from the frames, 95 of 100 right in audit").
- GPU-answered free-text questions are out of scope here; they are pass 2, registered separately.

## Sketches (added 2026-10-22, before the Report)

Three cheap HTML sketches under `docs/sketches/`, committed with the rest:

1. `question-universe.html` — the whole bank on one browsable page: the three registers as sections, every question drawn as its chip with the columns it reads and its basis in small type beneath, and GPU-only pass-2 questions present but dashed.
2. `chips-video-panel.html` — the video page with the chat side panel open at its standing 420px, the chip row above the composer, one chip tapped and its answer rendered in the app's chat dress: the number, the timestamp, the basis.
3. `chips-chat.html` — /chat with a video attached from the plus menu, the same chips re-ranked for that context, one answered, and a small dev-corner overlay showing the `chip-shown` and `chip-tap` events the taps would log.

## Report

Append `## Report`: the inventory, the question list by register with resolver columns, the bank's size and home, the chips as shipped with their event wiring, and anything deferred with why.

## Progress

**2026-10-22, the universe for review.** 57 free questions (28 the video in hand, 21 against the field, 8 what to do) and 9 pass-2 questions, each with its columns, basis, answer template and unlocking action, in `src/lib/question-bank.ts`; drawn whole in `docs/sketches/question-universe.html` with how many of the 5,379 baseline shorts each answers today (`node --experimental-strip-types scripts/question-universe.mjs`). Strike or reword there or in the file; edits fold in before the chips ship.

Inventory, over the 5,379 baseline shorts:

| store | what a question can resolve to | covers |
|---|---|---|
| composition, per short (`data/raw/composition/raw/`) | every scene cut, OCR word count and text area each second, loudness each second, integrated level and range | 5,379 |
| composition, summary (`model/composition.json`) | 23 features: pacing, hook cuts/text/words, loudness, brightness, title traits | 5,379 (speech timing 4,714) |
| transcripts | the words; timed where the source is captions (4,135) or Whisper (579); the transcript API's 664 carry word order only | 5,378 |
| census (`model/vqa-census.json`) | captions, call to action and its second, format, setting, people screen share, third-party watermark; audit counts from `vqa-audit.json` ride with each answer; people count (0.36) and product (unvalidated) are not used | 5,379 |
| codebook (`codebook.json`, landed 20:20 today) | 28 Swayable traits, Wesleyan goal, Upworthy title patterns | 5,375 / 5,375 / 5,379 |
| serving index (`data/raw/composition/index`) | nearest neighbors, cosine on 1,024 dimensions | 5,379 |
| velocity catalog | views, likes, comments, channel median, Outlier Score, tier | 5,379 |
| 72-hour curves (`model/velocity-features.json`) | views at 1, 6, 24, 72 h | 59 |
| craft templates (`video-reads.json`) | within-channel percentiles on 24 axes | 5,379 |
| winning modes | mode-match score; one surviving mode, held-out lift 50.8% against 39.9% | 5,379 |
| topics + topic lift | 40 clusters; 14 topics with a lift measured in 5+ channels | 5,379 |
| composition findings | 2,770 within-channel pairs, overall and per cluster, 7 splits at q < 0.1 | all |
| length crossing | outperform/underperform share by length bin | all |
| census registry (`model/vqa-registry.json`) | Breakout lift per census trait; one recommendation (on-screen call to action, -7.0) | all |
| publish policy | posterior over topic x length x hour block, by family | 5,379 |
| Swayable patterns | 28 trait differences in vote choice; no trait's 90% range clears zero, so persuasion answers stay descriptive | all |

On-screen text is stored as word counts, not the words, so "what would someone know by second three with the sound off" is pass 2.

## Report (2026-10-22)

**Inventory.** The table under Progress, with one change during the build: the codebook landed at 20:20, so the Swayable, Wesleyan and Upworthy questions answer from it (5,375 / 5,378 / 5,379 baseline shorts). Every Swayable trait's 90% range crosses zero, so persuasion answers stay descriptive. The census's `peopleScreenShare` is the share of sampled frames with a person, not the frame area, and the people question was reworded to match before it was scored and cut.

**Scoring.** Brendan scored 65 of 66 on the universe page (1 cut, 5 keep): 25 fives, 18 fours, 10 threes, 11 twos, 3 ones. The three 1s are removed. The unscored one, "How do I get closer to the winning craft?", is now "How should I edit this to look like the ones that outperformed?" and counts as a 5. Every question carries its score in `src/lib/question-bank.ts`. Chips are the 39 rated 4-5 that need no GPU; the 2s and 3s stay defined, without resolvers.

**The questions, by register, with the columns each resolver reads.**

**The video in hand** (12)

| score | chip | reads |
|---|---|---|
| 5 | Is there a call to action, and when does it show? | `census.callToAction`, `census.ctaSec` |
| 5 | How many words is the script? | `transcript.words`, `composition.durationSec` |
| 5 | What kind of video is this? | `census.format` |
| 5 | Where was this shot? | `census.setting` |
| 5 | Which persuasion techniques does it use? | `codebook.swayable`, `swayable.traits` |
| 5 | Is this trying to persuade? | `codebook.wesleyan` |
| 4 | Does my hook open on a face, on text, or on b-roll? | `census.format`, `raw.frames[0..2].words` |
| 4 | What does this look like on mute? | `census.captionsBurnedIn`, `composition.textFrameShare`, `composition.textWordsPerFrame` |
| 4 | Is it loud enough? | `composition.loudnessLufs`, `composition.loudnessRange` |
| 4 | How does it end? | `raw.frames[-3..].words`, `raw.loudness.perSecond[-3..]`, `census.ctaSec`, `transcript.words[-8..]` |
| 4 | How much does the picture move? | `composition.visualActivity`, `craft.visualActivity` |
| 4 | What does my title do? | `composition.titleChars`, `composition.titleWords`, `composition.titleQuestion`, `composition.titleNumber`, `composition.titleCapsRun`, `composition.titleEmoji` |

**Against the field** (19)

| score | chip | reads |
|---|---|---|
| 5 | Where does this rank on my channel? | `catalog.ratio`, `catalog.channelId` |
| 5 | What's different about my best video? | `catalog.ratio`, `craft.*` |
| 5 | Show me videos like this one. | `index.neighbors[0..5]`, `catalog.ratio` |
| 5 | What do videos like this one do differently? | `index.neighbors[0..20]`, `catalog.tier`, `composition.*` |
| 5 | Is this a good length? | `catalog.durationSec`, `lengths.bins`, `lengths.crossing` |
| 5 | How does my opening compare with ones that outperformed? | `composition.cutsHook`, `composition.textHook`, `composition.wordsHook`, `composition.firstWordSec`, `findings.overall` |
| 5 | How does this format do elsewhere? | `census.format`, `registry.rows[format=*]` |
| 5 | Are people liking and commenting more than usual? | `catalog.likes`, `catalog.comments`, `craft.likeRate`, `craft.commentRate` |
| 5 | How fast did it pick up views? | `velocity72.views1h`, `velocity72.views6h`, `velocity72.views24h`, `velocity72.views72h` |
| 5 | What separates winners from the rest on this topic? | `topics.cluster`, `findings.clusters[].splits`, `findings.findings` |
| 5 | Do my videos that outperformed share a format? | `census.format`, `catalog.tier`, `catalog.channelId` |
| 5 | Will this change minds? | `codebook.swayable`, `swayable.traits` |
| 4 | How did this do against my usual? | `catalog.views`, `catalog.channelMedian`, `catalog.ratio`, `catalog.tier` |
| 4 | Why might this one have outperformed? | `catalog.ratio`, `registry.rows[measured]`, `topics.lift`, `modes.score`, `lengths.bins` |
| 4 | What's this about, and how does that topic do? | `topics.cluster`, `topics.lift` |
| 4 | Does this match the craft of the winners? | `modes.scores`, `modes.full.modes[survived]` |
| 4 | Where does this stand out on my channel? | `craft.*` |
| 4 | Is it ahead of where my videos usually are? | `velocity72.*`, `velocity72.byChannel` |
| 4 | Is my title built like headlines that win? | `codebook.upworthy.patterns`, `upworthy-top.patterns` |

**What to do** (8)

| score | chip | reads |
|---|---|---|
| 5 | Should I put a call to action on screen? | `census.callToAction`, `census.ctaSec`, `registry.rows[callToAction]` |
| 5 | When should I ask viewers to act? | `census.ctaSec`, `registry.rows[callToAction]`, `composition.durationSec` |
| 5 | How should I edit this to look like the ones that outperformed? | `modes.full.modes[survived].center`, `craft.*` |
| 5 | What one change would help most? | `registry.rows[recommendation]`, `modes.*`, `findings.findings` |
| 5 | What should my next one be about? | `topics.lift` |
| 5 | What would make it more persuasive? | `codebook.swayable`, `swayable.traits` |
| 4 | When should I post the next one like this? | `policy.mean`, `policy.precision`, `topics.cluster`, `catalog.durationSec`, `channels.family` |
| 4 | What length should the next one be? | `policy.mean`, `topics.cluster`, `channels.family` |

**Held, rated 2-3, defined but unanswered** (16): When does my first word land? (3); What happens before my first word lands? (2); Show me every moment with on-screen text. (3); How many shots do I use, and where's the longest? (3); How long before the first cut? (2); How fast is it cut? (2); What's happening at the loudest moment? (2); Where does the sound drop out? (3); How fast do I talk? (3); How much of it is talking? (2); What am I saying when text first appears? (3); Are my captions burned in? (2); Is anyone else's logo on screen? (2); Is it too dark? (3); How many of my shorts have captions? (3); How many of my shorts open on text? (3).

**Pass 2, GPU read** (8): Is my thumbnail frame actually in the video? (4); Does anything on screen contradict what's said? (5); What would someone know by second three with the sound off? (4); Are my captions readable on a phone? (4); Am I on screen in the first second? (2); Does this show a news clip or someone else's footage? (2); How long is our logo on screen in each video? (2); Which of our videos have voting footage we could reuse? (3).

**The bank.** `data/generated/question-bank.json`, **3.0 MB**, committed and read server-side (under the 8 MB line, so no S3). It carries what the uncommitted stores supply, per baseline short (5,379): catalog figures, transcript word count and last words, OCR words in the first 3 s and the last 3 s with their loudness, and the 20 nearest other-channel neighbors in the serving index, plus baseline quantiles, channel families and the 40 cluster labels. Rebuild: `node scripts/question-bank/build.mjs` (calls `scripts/question-bank/neighbors.py`). Everything committed (census, codebook, composition summary, craft templates, winning modes, topic lift, findings, length crossing, the census lift and registry, publish policy, Swayable and Upworthy) is read at answer time by `src/lib/question-resolver.ts`: one typed resolver per chip, no model call anywhere. Run over 43 baseline shorts (39 chips each), no answer carried an undefined, NaN or broken value. The two 72-hour questions answer for 59 shorts and render their unlocking action for the rest.

**The answers.** Conversational chip, scientific answer: a number, a timestamp or a comparison, and its basis in small type under it. Census answers carry their audit once ("read from the frames, 94 of 99 right in audit"). Recommendations render only where a measured lift backs them, each with its citation: the on-screen call to action (three chips), and the winning mode's held-out lift (two chips). Everything else is descriptive. A video missing a measurement gets its unlocking action as a dashed row (Run the flask links to /lab), never an apology.

**The chips as shipped.**
- Video page: **Ask about this video** under the player opens the chat in the right panel at 420px, preloaded with the video. Inside the drawer, where the right panel is the drawer itself, it opens the full page with `?ask=1` and the panel opens there.
- /chat: picking a short from the plus menu's Shorts brings the chips over the input.
- Four chips a draw. Slots by register: video panel = video, video, field, action; /chat = field, action, video, field. A tap sends the chip as the reader's turn and the measured answer as the reply (`model: measured`, no Retry). The answer's basis rides in a `pax-basis` block, so saved chats reopen with it. The tapped chip leaves the row and the next draw excludes it.

**Event wiring.** `chip-shown` and `chip-tap` are added to `USAGE_KINDS` (`src/lib/usage.ts`) and written through the existing `logUsage` beacon. `chip-shown`: subject = chip id, meta `{position, propensity, surface, videoId}`, one row per chip per draw. `chip-tap`: meta `{position, surface, videoId}`. That is exactly the registration in `learning/chat-suggested-prompts.json`. The propensity is exact: each slot draws uniformly from the unshown chips of its register, so P(chip at position) = 1 / (eligible in that register at that draw). The registry's arms now list the 39 chip ids (`scripts/policy/loops/cold_start_specs.py`, regenerated JSON).

**Sketches.** `docs/sketches/question-universe.html` (scorable, scores prefilled from the file), `chips-video-panel.html`, `chips-chat.html`, the last two filled with the resolver's real answers for one Brennan Center short. The event overlay the brief asked for on `chips-chat.html` was removed by Brendan's ruling; the events live only in the code.

**Deferred.**
- The 16 held questions (rated 2-3): no resolvers. Their columns are in the file if a later rating lifts them.
- Pass 2 (8): needs a GPU read of the frames. "Does anything on screen contradict what's said?" was rated 5 and "thumbnail in the video", "second three on mute" and "captions readable" 4, so pass 2 has its order.
- Not checked: types (no local typecheck; the remote build checks them) and how the pages look in the browser (left for Brendan in local dev).
- In the working tree, `src/components/chat/chat.tsx` carries another session's uncommitted chat-saving work alongside these changes. Only the chip changes were staged, built on the committed file, so that session's commit will carry both.
