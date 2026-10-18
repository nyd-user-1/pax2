# Brief 4: Teach a Model, first course: the Classifier, on /labeling

Written 2026-10-17 by the lead session for an executing window. No AWS spend: UI only, with labels, course progress and usage events written to DynamoDB through the existing `putOnce` and `query` in `src/lib/ledger.ts` (that file is the app's name for its one DynamoDB table, `pax2-ledger`). Do not spawn subagents. Do not push. Commit per part, staging by explicit pathspec only.

## Model names

The course is generic. Its copy speaks only of model types: "the multi-label classifier," "ranker," "encoder," "regressor." It never names PAX2, PAX2 Trait Labeler, or any product, vendor or language model. Where the course compares the learner's answers with a machine's, the machine is "the classifier." App copy is third person.

## Read first

- `AGENTS.md`, `/Users/brendanstanton/.claude/CLAUDE.md`, `docs/SPEC.md`, `docs/briefs/RIG-RULES.md` rules 15, 21, 24, 27, 28 and 29, and the house rules section of `docs/briefs/2026-10-17-graph-and-recipes.md`.
- `src/app/labeling/page.tsx`, `src/app/labeling/actions.ts`, `src/lib/labeling.ts`, `src/lib/trait-definitions.ts`, `src/components/consensus-vote.tsx`, `src/lib/consensus.ts`, `src/lib/review.ts` (`recordVote`, `votes`), `scripts/consensus-agreement.mjs`, `src/app/usage-actions.ts`, `data/generated/model/organic-codes.json`, `data/generated/swayable-patterns.json`, `data/generated/model/reference-model.json`, `src/components/shell.tsx`.

## What it is

The forty coded campaign shorts and their twenty-eight traits, already on `/labeling`, become a course. A learner gets one video for the whole course and the twenty-eight questions in four chapters of seven. Each chapter teaches one thing a multi-label classifier needs, asks the seven questions on the learner's video, then reveals how the classifier answered the same seven and what the Swayable tests found each trait was worth. Every answer is written to DynamoDB through the vote store the page already uses, so `scripts/consensus-agreement.mjs` keeps working unchanged. Each learner gets a different video and a different order of questions.

Course name: **Teach a Model**. Courses are listed by model type. The first and only course built here: **The Classifier**.

Description, used on the index page verbatim: "A course on how a particular model learns, the multi-label classifier. The course defines a model by type and function and explains what is needed to train that kind of model and why. A classifier has its own requirements: labeled examples, features, agreement between labelers, and a held-out test, that other models do not. As part of the course you assist in the training of a classifier; in doing so you learn to recognize the conditions of its training, the rationale behind each one, and how to conduct your own training of a classifier."

## Part A: routes and data

A1. `/labeling` becomes the Teach a Model index: the course cards by model type. The Classifier, live, with the description above and a Start button. Ranker, Encoder, Regressor as cards marked "Coming," one line each saying what that type does. The sidebar entry under Work in progress reads "Teach a Model."

A2. `/labeling/classifier` is the course. Signed-in users; signed out, the sign-in gate the queues use. `src/lib/course.ts` holds the chapter definitions and the assignment logic.

A3. Chapters, fixed, seven trait keys each, in this grouping:

- Chapter 1, Labels: `messenger_every_people`, `messenger_politician`, `messenger_celebrity`, `messenger_veteran`, `technique_plain_folks`, `technique_pos_testimonial`, `technique_neg_testimonial`.
- Chapter 2, Features: `narration_personal_story`, `narration_explain_facts`, `narration_advocate_opinions`, `policy_facts`, `fact_cite_yes`, `fact_new_yes`, `explicit_vote_for`.
- Chapter 3, Agreement: `emotion_anger`, `emotion_enthusiasm`, `emotion_fear`, `emotion_hope_pride`, `emotion_humor`, `emotion_somber`, `tone_contrast`.
- Chapter 4, Tests: `tone_positive`, `tone_negative`, `production_value_high`, `style_amateur`, `style_text_on_screen`, `style_animation`, `how_scripted`.

The seven within a chapter are shuffled by a seeded order from the learner's email and the video id, so two learners on the same video answer in different orders and one learner's order never changes between visits.

A4. Assignment. On first visit, the learner is assigned the video with the fewest distinct labelers so far among `LABEL_VIDEOS`, ties broken by the seeded order, and the assignment is written once to DynamoDB: `pk COURSE#classifier`, `sk <email>`, `{ videoId, at }` through `putOnce`; a second visit reads it back and never reassigns. Chapter and course completion are events: `pk COURSE#classifier#<email>`, `sk EVENT#<iso>`, `{ kind: "chapter" | "finished", chapter, at }`. Labels themselves go through `recordVote` with conversation `traits-<videoId>` and `tid` the trait's index in `featureLabels`, exactly as today.

## Part B: the chapter page

B1. Each chapter has three states in one page, in order: the lesson, the seven questions, the reveal. A thin progress strip at the top shows the four chapters and which is open. The learner's video plays in the left column throughout, with its transcript below it.

B2. The lesson, under the chapter's heading with no lead-in paragraph: four to six short paragraphs, plain words, third person, written to the points below. No numbers that were not measured.

- Chapter 1, Labels. What a label is: one yes-or-no answer about one example. Why ground truth comes from people and not from the model. How the archive this classifier leans on got its labels: research assistants watched each ad, two or three per video, and their answers were averaged. That the learner is now one of those people. What "pass" means and why it is a valid answer.
- Chapter 2, Features. What the classifier reads: the transcript. What a feature is and the difference between a feature and a label. Why twenty-eight questions from one input make it a multi-label classifier. How this classifier answers today, a language model given the transcript and the trait list, and how a trained classifier would answer instead, from thousands of labeled examples; that the learner's labels are what makes the second possible.
- Chapter 3, Agreement. Why two careful people disagree on a trait like anger. Agreement rate and Cohen's kappa, in one sentence each. What the archive found: near-total agreement on who the messenger is, weak agreement on subjective traits. Why the course asks several people per video and takes the majority.
- Chapter 4, Tests. Why a classifier is scored on examples it never saw. What held-out examples are and why whole channels are held out, not random videos. What a within-channel AUC of 0.55 says and does not say, read from `var-model.json` without naming the file or the product on screen. What happens to the learner's labels next: they measure the classifier now, and train a better one when there are enough.

B3. The questions. `ConsensusVote` as today, one statement at a time, each with its definition from `trait-definitions.ts` beneath, the three buttons agree, disagree, pass, writing through `labelTrait`. The model's answers stay hidden until all seven are answered.

B4. The reveal. A table of the seven traits: the learner's answer, the classifier's answer (`organic-codes.json` value at or above 0.5 reads present), agree or differ, and the trait's measured lean from `swayable-patterns.json` as points with its range, or a dash when the trait is not in that file. One line above the table: how many of the seven agreed. Then Next chapter, or on chapter four, Finish.

B5. Finish. One page: the learner's agreement with the model across all twenty-eight; how many labelers the video has now; a link back to the index and one to `/v/yt-<id>` for the video. A `finished` event is written.

B6. Usage events through `logUsage` from Brief 2: `course-start`, `chapter-start`, `chapter-finish`, `course-finish`, with the course id and chapter number in `meta`.

## Part C: what reads it

C1. `scripts/consensus-agreement.mjs` is unchanged in what it reads. Add to its output the number of distinct labelers per video and the number of videos with three or more, and a per-chapter agreement figure using the grouping in A3.

C2. The ML page's Models block shows, beside the trait labeler's card, the mean kappa and the labeler count from `consensus-agreement.json` when present.

C3. `/dashboard` Readers block gains one line: learners started, chapters finished, courses finished, from the usage events.

## Responsive

The video column stacks above the lesson under `md`. The reveal table scrolls horizontally on phones. Brendan checks layouts in his own browser.

## Commits

Three, one per part, subjects in this repository's prose style. File-scoped type checks before each. When done, tell Brendan in a few lines what was built and what was left out.
