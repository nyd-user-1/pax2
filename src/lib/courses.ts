import "server-only"

import itemsJson from "../../data/generated/course-items.json"
import encoderRun from "../../data/generated/model/encoder.json"
import headline from "../../data/generated/model/headline-model.json"
import retention from "../../data/generated/model/retention-v0.json"
import sim from "../../data/generated/model/platform-sim.json"
import varModel from "../../data/generated/model/var-model.json"
import velocity from "../../data/generated/model/velocity-model.json"
import library from "../../data/library.json"
import { seeded } from "@/lib/course"
import { now, putOnce, query, type Item } from "@/lib/ledger"

// Teach a Model's other courses: Ranker, Encoder, Regressor, Simulator and Language model, on
// /labeling/<course>. Each has four chapters; each chapter is a lesson and an exercise whose answers
// are data one of the models needs: comparisons for a ranker, triplets and hard negatives for an
// encoder, estimates and watch times for a regressor, platform decisions and feed sessions for a
// simulator, continuations, preferences, claim labels and edits for a language model. Items come
// from data/generated/course-items.json (scripts/course-items.mjs); what really happened to each
// video stays here on the server and is revealed only after the last answer of a chapter.
//
//   pk                          sk                        item
//   EXERCISE#<course>#<n>       <email>#<round>#<iso>     { voter, round, shown, answer, at }
//   COURSE#<course>#<email>     EVENT#<iso>               started, chapter and finished events (src/lib/course.ts)
//
// scripts/course-exercises.mjs reads the answers back for the models.

type Fact = { title: string; channel: string; family: string; durationSec: number; views: number; median: number; ratio: number; tier: "breakout" | "baseline" | "killed" }
type PoolItem = { id: string; v: string[] }
type Line = { id: string; script: string; line: number; text: string }
const ITEMS = itemsJson as unknown as {
  pools: Record<string, PoolItem[]>
  familyRates: { id: string; family: string; shorts: number; breakoutShare: number }[]
  lines: Line[]
  openings: { script: string; text: string; next: string }[]
  openingPairs: { id: string; scripts: string[] }[]
  facts: Record<string, Fact>
}
const F = ITEMS.facts
const SCRIPTS = (library as { scripts: { id: string; title: string; why?: { line: number; source?: { label: string } }[] }[] }).scripts

// What the client sees of a round. Nothing here says how a video did.
export type Card = { id: string; title?: string; channel?: string }
export type Round = {
  id: string
  kind: "pick" | "order" | "number" | "range" | "text"
  prompt: string
  anchor?: Card
  cards?: Card[]
  texts?: string[]
  choices?: string[]
  /** For a pick: what the answer indexes, and whether "Can't tell" (-1) is offered. */
  from?: "cards" | "texts" | "choices"
  cant?: boolean
  context?: string
  note?: string
  embed?: string
  unit?: string
  max?: number
}
export type Answer = number | number[] | string
export type Result = { headline: string; rows: { shown: string; answer: string; actual?: string }[] }

type Exercise = { pool: string; rounds: number; build: (id: string) => Round; result: (rs: { round: Round; answer: Answer }[]) => Result }
export type CourseChapterDef = { n: number; title: string; lesson: string[]; exercise: Exercise }
export type CourseDef = { id: string; title: string; line: string; chapters: CourseChapterDef[] }

const card = (id: string, titleShown = true): Card => (titleShown ? { id, title: F[id].title, channel: F[id].channel } : { id })
const poolItem = (pool: string, id: string) => ITEMS.pools[pool].find((x) => x.id === id)!
const fmt = (n: number) => Math.round(n).toLocaleString("en-US")
const pct = (x: number) => `${Math.round(x * 100)}%`
const x2 = (x: number) => `${x.toFixed(x < 10 ? 1 : 0)}x`
const titleOf = (id: string) => F[id].title.slice(0, 80)
const CANT = "Can't tell"
const pickLabel = (r: Round, a: Answer) => (typeof a !== "number" ? "" : a < 0 ? CANT : r.from === "cards" ? titleOf(r.cards![a].id) : r.from === "texts" ? r.texts![a] : r.choices![a])
const choiceAnswer = pickLabel
const median = (xs: number[]) => {
  const s = [...xs].sort((p, q) => p - q)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN
}
function spearman(order: number[], truth: number[]) {
  // order: indices in the learner's order; truth: indices in the true order. Both a permutation of 0..k-1.
  const k = order.length
  const rank = (o: number[]) => Object.fromEntries(o.map((v, i) => [v, i]))
  const ra = rank(order)
  const rb = rank(truth)
  const d2 = order.reduce((t, v) => t + (ra[v] - rb[v]) ** 2, 0)
  return 1 - (6 * d2) / (k * (k * k - 1))
}

// Measured numbers the lessons quote, read from the files that hold them.
const H = headline as { heldOutAccuracy: number; flagsOnlyAccuracy: number; counts: { pairs: number } }
const ENC = encoderRun as { arms: Record<string, { pooled: number }>; gates: { E: { pooledDelta: number } }; benchmark: { heldOutChannels: number; heldOutDocs: number } }
const RET = retention as { rows: { used: number; videos: number }; spearman: number; meanWatchRatio: number }
const SIM = sim as { all: { videos: number; hits: number; misses: number; peakHour: { hits: number; rest: number } } }
const VEL = velocity as { n: number; aucByHorizon: Record<string, number> }
const WITHIN = (varModel as { metadata: { metrics: { leaveOneChannelOut: { withinChannelAuc: number } } } }).metadata.metrics.leaveOneChannelOut.withinChannelAuc
const SETTLED = ITEMS.familyRates.reduce((t, f) => t + f.shorts, 0)
const in100 = (x: number) => Math.round(x * 100)

// Exercise builders, one per shape.
const pickVideos = (pool: string, rounds: number, prompt: string, opts: { anchor?: boolean; thumbsOnly?: boolean; choices?: string[] } = {}): Omit<Exercise, "result"> => ({
  pool,
  rounds,
  build: (id) => {
    const v = poolItem(pool, id).v
    const shown = opts.anchor ? v.slice(1) : v
    return { id, kind: "pick", prompt, anchor: opts.anchor ? card(v[0]) : undefined, cards: shown.map((x) => card(x, !opts.thumbsOnly)), from: opts.choices ? "choices" : "cards", choices: opts.choices, cant: true }
  },
})
const recorded = (rs: { round: Round; answer: Answer }[], what: string) => `${rs.length} ${what} recorded.`
const tierWord = { breakout: "Broke out", baseline: "Usual", killed: "Missed" } as const
const outcome = (id: string) => `${tierWord[F[id].tier]}, ${x2(F[id].ratio)} the channel median`

const RANKER: CourseDef = {
  id: "ranker",
  title: "The Ranker",
  line: "Puts a set of items in order, the best fit for a goal first.",
  chapters: [
    {
      n: 1,
      title: "Comparisons",
      lesson: [
        "A ranker puts a set of items in order, the best fit for a goal first. Its output is an order, not a verdict on any one item.",
        "People are better at comparing than at scoring. Asked to score a title from 1 to 10, two people use the scale differently; asked which of two titles they would open, they answer the same question. So rankers are usually trained on comparisons: this one over that one.",
        "A comparison is a label of a different shape, one answer about a pair. Many of them add up to an order over every item, including pairs nobody compared directly.",
        "The exercise shows two shorts from one family of channels and asks which to open first. Each pick is a training pair for a ranker of titles.",
      ],
      exercise: {
        ...pickVideos("pairsFamily", 6, "Pick the one to open first."),
        result: (rs) => {
          const decided = rs.filter((r) => (r.answer as number) >= 0)
          const better = decided.filter((r) => {
            const [a, b] = r.round.cards!.map((c) => F[c.id].ratio)
            return (r.answer === 0 ? a : b) > (r.answer === 0 ? b : a)
          }).length
          return {
            headline: `${recorded(rs, "comparisons")} The one picked drew more views against its own channel's median in ${better} of ${decided.length}.`,
            rows: rs.map(({ round, answer }) => ({ shown: round.cards!.map((c) => titleOf(c.id)).join(" / "), answer: pickLabel(round, answer), actual: round.cards!.map((c) => x2(F[c.id].ratio)).join(" / ") })),
          }
        },
      },
    },
    {
      n: 2,
      title: "Implicit feedback",
      lesson: [
        "Most of what a ranker learns from on a live platform was never asked for. Nobody labels a feed; people open some videos, watch some to the end and scroll past the rest. Each act is implicit feedback.",
        "Implicit feedback is plentiful and biased. What sits first gets opened more because it sits first, and what was never shown is never chosen. A ranker trained on raw clicks learns its own past order back.",
        "Platforms correct for this by showing some items in random positions, or by comparing items only when both were in view. An order from a person who saw every item at once avoids the problem from the start.",
        "The exercise shows four shorts at once and asks for the order to watch them. One order holds six comparisons, every pair among the four.",
      ],
      exercise: {
        pool: "quads",
        rounds: 4,
        build: (id) => ({ id, kind: "order", prompt: "Tap them in the order to watch them, first to last.", cards: poolItem("quads", id).v.map((x) => card(x)) }),
        result: (rs) => ({
          headline: recorded(rs, "orders, six comparisons each,"),
          rows: rs.map(({ round, answer }) => ({ shown: `${round.cards!.length} shorts`, answer: (answer as number[]).map((i) => titleOf(round.cards![i].id)).join(" > "), actual: (answer as number[]).map((i) => x2(F[round.cards![i].id].ratio)).join(" > ") })),
        }),
      },
    },
    {
      n: 3,
      title: "Features",
      lesson: [
        "A ranker scores each item from its features and sorts by the score. For a short nobody has watched yet, the features are what a viewer sees in a feed: the thumbnail, the title, the channel and the length.",
        `A ranker of headlines on this site was trained on ${fmt(H.counts.pairs)} winner and loser pairs from randomized headline tests. Given only simple flags on the words, such as a number or a question, it picks the winner ${in100(H.flagsOnlyAccuracy)} times in 100 on tests it never saw; with the words themselves, ${in100(H.heldOutAccuracy)}.`,
        "The thumbnail is a feature no headline test covered. Whether a face, text on the image or a bright color draws the tap can be measured only by people choosing between thumbnails.",
        "The exercise hides the titles and shows two thumbnails. Each pick is a comparison on the image alone.",
      ],
      exercise: {
        ...pickVideos("pairsFamily", 6, "Pick the thumbnail to tap.", { thumbsOnly: true }),
        result: (rs) => ({
          headline: recorded(rs, "thumbnail comparisons"),
          rows: rs.map(({ round, answer }) => ({ shown: round.cards!.map((c) => titleOf(c.id)).join(" / "), answer: typeof answer === "number" && answer >= 0 ? titleOf(round.cards![answer].id) : CANT, actual: round.cards!.map((c) => x2(F[c.id].ratio)).join(" / ") })),
        }),
      },
    },
    {
      n: 4,
      title: "Tests",
      lesson: [
        "A ranker is tested on pairs it never trained on, by how often it puts the better item first. Half is chance; every point above it has to be earned on held-out items.",
        "The better item has to be defined by an outcome, not an opinion. Here it is a breakout: a short that drew three times its channel's median views or more.",
        `A classifier on this site that predicts breakouts from what a short carries at publish was tested on channels it never saw. Given two shorts from one channel, one of them a breakout, it put the breakout first ${in100(WITHIN)} times in 100.`,
        "The exercise asks the learner the same question: two shorts from one channel, one of them a breakout. The score at the end is the learner's own held-out accuracy, beside the classifier's and beside chance.",
      ],
      exercise: {
        ...pickVideos("pairsSame", 8, "One of these two broke out on its channel. Pick it."),
        result: (rs) => {
          const decided = rs.filter((r) => (r.answer as number) >= 0)
          const right = decided.filter((r) => F[r.round.cards![r.answer as number].id].tier === "breakout").length
          return {
            headline: `Right on ${right} of ${decided.length}. Chance is half; the classifier's rate is ${in100(WITHIN)} in 100.`,
            rows: rs.map(({ round, answer }) => ({ shown: round.cards!.map((c) => titleOf(c.id)).join(" / "), answer: pickLabel(round, answer), actual: titleOf(round.cards!.find((c) => F[c.id].tier === "breakout")!.id) })),
          }
        },
      },
    },
  ],
}

const ENCODER: CourseDef = {
  id: "encoder",
  title: "The Encoder",
  line: "Turns an example into a list of numbers, so that similar examples sit close together.",
  chapters: [
    {
      n: 1,
      title: "Embeddings",
      lesson: [
        "An encoder turns an example into a list of numbers, an embedding, so that examples alike in some way land close together. It makes no decision; it makes a space that other models search and sort in.",
        "Closeness is measured by the angle between two lists, cosine similarity. Two shorts on the same subject in the same voice should sit near each other, and a short about something else far away.",
        "What counts as alike is set by the training data, not by the encoder. Trained on shorts that did equally well, it learns one sense of alike; trained on people's judgments, another.",
        "The exercise shows a short and two others and asks which is more like the first. Each answer is a triplet, a check any encoder's space can be held to.",
      ],
      exercise: {
        ...pickVideos("triplets", 6, "Pick the one more like the first.", { anchor: true }),
        result: (rs) => ({
          headline: recorded(rs, "triplets"),
          rows: rs.map(({ round, answer }) => ({ shown: `${titleOf(round.anchor!.id)}`, answer: pickLabel(round, answer) })),
        }),
      },
    },
    {
      n: 2,
      title: "Positives and negatives",
      lesson: [
        "An encoder is trained contrastively: pairs that should be close, the positives, are pulled together, and pairs that should not, the negatives, are pushed apart.",
        "The choice of positives is the whole definition of similar. An encoder on this site took two shorts from one channel with the same outcome as a positive pair, so it learned to place shorts by how they did.",
        "Positives can come from people instead: two shorts a person says would reach the same viewers. That sense of alike is closer to what a campaign wants when it looks for videos comparable to its own.",
        "The exercise shows two shorts from one family of channels and asks whether they would reach the same viewers. Yes is a positive pair; no is a negative.",
      ],
      exercise: {
        ...pickVideos("pairsFamily", 6, "Would these two reach the same viewers?", { choices: ["Same viewers", "Different viewers"] }),
        result: (rs) => ({
          headline: `${rs.filter((r) => r.answer === 0).length} positive and ${rs.filter((r) => r.answer === 1).length} negative pairs recorded.`,
          rows: rs.map(({ round, answer }) => ({ shown: round.cards!.map((c) => titleOf(c.id)).join(" / "), answer: choiceAnswer(round, answer) })),
        }),
      },
    },
    {
      n: 3,
      title: "Hard negatives",
      lesson: [
        "Easy negatives teach little. A short about sports and one about a ballot question are far apart before any training starts.",
        "Hard negatives look alike and are not: same channel, same speaker, a different point. They force the encoder to learn the difference that matters.",
        "Mining them by machine risks picking pairs that are in fact alike, which teaches the encoder the wrong lesson. A person picking the odd one out of three avoids that.",
        "The exercise shows three shorts from one channel and asks which does not belong. The two left form a positive pair, and the odd one is a hard negative for both.",
      ],
      exercise: {
        ...pickVideos("channelTriples", 6, "All three are from one channel. Pick the one that does not belong."),
        result: (rs) => ({
          headline: recorded(rs, "hard negatives"),
          rows: rs.map(({ round, answer }) => ({ shown: round.cards![0].channel ?? "", answer: pickLabel(round, answer) })),
        }),
      },
    },
    {
      n: 4,
      title: "Retrieval",
      lesson: [
        "An encoder is judged by what it retrieves. For a held-out short, take its nearest neighbors in the space and ask whether they predict something true about it.",
        `The encoder on this site was tested that way on ${fmt(ENC.benchmark.heldOutDocs)} shorts from ${ENC.benchmark.heldOutChannels} channels it never saw: the share of a short's 20 nearest neighbors that broke out, scored as an AUC against whether the short itself broke out. A stock encoder reached ${ENC.arms.stock.pooled.toFixed(3)}; the trained one ${ENC.arms.encoder.pooled.toFixed(3)}.`,
        `Its gate, set before the run, asked for 0.02 above the stock encoder. It gained ${ENC.gates.E.pooledDelta.toFixed(3)} and was not published. A gate set in advance is what keeps a near miss from being called a success.`,
        "The exercise shows a short and four candidates and asks for the closest. A person's choice of nearest neighbor is the relevance label a reranker is trained on.",
      ],
      exercise: {
        ...pickVideos("retrieval", 6, "Pick the closest match to the first.", { anchor: true }),
        result: (rs) => ({
          headline: recorded(rs, "relevance judgments"),
          rows: rs.map(({ round, answer }) => ({ shown: titleOf(round.anchor!.id), answer: pickLabel(round, answer) })),
        }),
      },
    },
  ],
}

const viewsRound = (pool: string, kind: "number" | "range", prompt: string) => (id: string): Round => {
  const v = poolItem(pool, id).v[0]
  return { id, kind, prompt, cards: [card(v)], context: `This channel's median short: ${fmt(F[v].median)} views.`, unit: "views" }
}
const logMiss = (guess: number, actual: number) => Math.abs(Math.log10(Math.max(1, guess) / Math.max(1, actual)))

const REGRESSOR: CourseDef = {
  id: "regressor",
  title: "The Regressor",
  line: "Predicts a quantity, such as how many views a video gets or how long people watch.",
  chapters: [
    {
      n: 1,
      title: "Quantities",
      lesson: [
        "A regressor predicts a quantity: how many views, how many seconds watched, what share of viewers stay to the end. Its answer is a number on a scale, not a category.",
        "Views span a huge range. A channel's median short may draw a few hundred views and its best a few hundred thousand, so misses are measured on a log scale: guessing 2,000 for 1,000 is the same size of miss as 200 for 100.",
        "The simplest regressor predicts the channel's median every time. Any model worth training has to beat that on shorts it never saw.",
        "The exercise shows a short and its channel's median and asks for its views. The score sets the learner's misses beside the median's.",
      ],
      exercise: {
        pool: "singles",
        rounds: 6,
        build: viewsRound("singles", "number", "How many views did it draw?"),
        result: (rs) => {
          const mine = median(rs.map((r) => logMiss(r.answer as number, F[r.round.cards![0].id].views)))
          const base = median(rs.map((r) => logMiss(F[r.round.cards![0].id].median, F[r.round.cards![0].id].views)))
          return {
            headline: `The typical miss was ${x2(10 ** mine)} off; guessing the channel median every time was ${x2(10 ** base)} off.`,
            rows: rs.map(({ round, answer }) => ({ shown: titleOf(round.cards![0].id), answer: fmt(answer as number), actual: fmt(F[round.cards![0].id].views) })),
          }
        },
      },
    },
    {
      n: 2,
      title: "Targets",
      lesson: [
        "What a regressor is asked to predict decides what it learns. Views reward reach; watch time rewards holding attention; the two often disagree.",
        `A watch-time regressor on this site was trained on a public dataset of short-video viewing, ${fmt(RET.rows.used)} random showings across ${fmt(RET.rows.videos)} videos, where the average viewer watched ${pct(RET.meanWatchRatio)} of a video. On videos held out, its ranking of watch time had a rank correlation of ${RET.spearman.toFixed(2)} with the truth.`,
        "Those viewers were not watching campaign shorts. Watch time for these channels belongs to the channels and is not public, so the target is missing for exactly the videos that matter.",
        "The exercise asks for that target directly: watch a short and give the second at which the learner would have swiped away, or its full length if it held to the end. Each answer is one human watch time.",
      ],
      exercise: {
        pool: "watch",
        rounds: 4,
        build: (id) => {
          const v = poolItem("watch", id).v[0]
          return { id, kind: "number", prompt: "Watch it. Enter the second it would have been swiped away, or its full length if it held to the end.", embed: v, cards: [card(v)], unit: "seconds", max: F[v].durationSec, context: `${F[v].durationSec} seconds long.` }
        },
        result: (rs) => {
          const ratios = rs.map((r) => Math.min(1, (r.answer as number) / F[r.round.cards![0].id].durationSec))
          return {
            headline: `${recorded(rs, "watch times")} The learner watched ${pct(ratios.reduce((a, b) => a + b, 0) / ratios.length)} of each short on average.`,
            rows: rs.map(({ round, answer }) => ({ shown: titleOf(round.cards![0].id), answer: `${answer} s of ${F[round.cards![0].id].durationSec}` })),
          }
        },
      },
    },
    {
      n: 3,
      title: "Ranges",
      lesson: [
        "A single number hides how sure a regressor is. A forecast of 1,000 views means something different when the honest range is 900 to 1,100 than when it is 100 to 10,000.",
        "A prediction interval states the range the true value should fall in most of the time. An 80% interval should miss one time in five; one that never misses is too wide to help, and one that often misses is overconfident.",
        "Checking intervals takes many predictions. Coverage, the share of true values inside their ranges, is the measure.",
        "The exercise asks for a low and a high for each short's views, wide enough that the true count should fall inside four times in five. The score is the coverage.",
      ],
      exercise: {
        pool: "singles",
        rounds: 6,
        build: viewsRound("singles", "range", "Give a low and a high for its views, so the true count falls inside four times in five."),
        result: (rs) => {
          const inside = rs.filter((r) => {
            const [lo, hi] = r.answer as number[]
            const v = F[r.round.cards![0].id].views
            return v >= Math.min(lo, hi) && v <= Math.max(lo, hi)
          }).length
          return {
            headline: `${inside} of ${rs.length} true counts fell inside the ranges. Four in five is the aim.`,
            rows: rs.map(({ round, answer }) => ({ shown: titleOf(round.cards![0].id), answer: (answer as number[]).map(fmt).join(" to "), actual: fmt(F[round.cards![0].id].views) })),
          }
        },
      },
    },
    {
      n: 4,
      title: "Error measures",
      lesson: [
        "A regressor is scored on held-out examples by how far its numbers miss and, when only the order matters, by whether it ranks them right.",
        `Rank correlation measures the second: 1 when the predicted order matches the true order exactly, 0 when the two are unrelated. The watch-time regressor's ${RET.spearman.toFixed(2)} is a rank correlation.`,
        "Ranking by views against each channel's own median takes the channel's size out of the question, so a short from a small channel can rank first.",
        "The exercise shows four shorts and asks for their order by views against their channel medians, highest first. The score is the learner's rank correlation with the true order.",
      ],
      exercise: {
        pool: "quads",
        rounds: 4,
        build: (id) => ({ id, kind: "order", prompt: "Tap them in order of views against their own channel's median, highest first.", cards: poolItem("quads", id).v.map((x) => card(x)) }),
        result: (rs) => {
          const rho = rs.map((r) => {
            const ids = r.round.cards!.map((c) => c.id)
            const truth = ids.map((_, i) => i).sort((a, b) => F[ids[b]].ratio - F[ids[a]].ratio)
            return spearman(r.answer as number[], truth)
          })
          return {
            headline: `Mean rank correlation ${(rho.reduce((a, b) => a + b, 0) / rho.length).toFixed(2)}. A random order averages 0.`,
            rows: rs.map(({ round, answer }) => ({ shown: `${round.cards!.length} shorts`, answer: (answer as number[]).map((i) => x2(F[round.cards![i].id].ratio)).join(" > "), actual: [...round.cards!].sort((a, b) => F[b.id].ratio - F[a.id].ratio).map((c) => x2(F[c.id].ratio)).join(" > ") })),
          }
        },
      },
    },
  ],
}

const SIMULATOR: CourseDef = {
  id: "simulator",
  title: "The Simulator",
  line: "Plays out how a system responds to an action, such as a platform deciding who is shown a video.",
  chapters: [
    {
      n: 1,
      title: "Running forward",
      lesson: [
        "A simulator is a model of a system that can be run forward: given a starting state and an action, it produces what happens next, step by step.",
        "A platform's feed is such a system. A new short is shown to a small audience, the platform watches what they do, and it decides whether to show the short to more people. A simulator of that loop would let a campaign try a video before posting it.",
        `Its decisions have to be learned from outcomes. Of the ${fmt(SIM.all.videos)} shorts this site followed through their first 72 hours, ${SIM.all.hits} became Hits at three times the channel median or more and ${SIM.all.misses} became Misses at half or less.`,
        "The exercise puts the learner in the platform's seat: a short, and the choice to show it to more people or stop. About half the shorts broke out and about half missed.",
      ],
      exercise: {
        pool: "pushStop",
        rounds: 8,
        build: (id) => ({ id, kind: "pick", prompt: "Show it to more people, or stop?", cards: [card(poolItem("pushStop", id).v[0])], from: "choices", choices: ["Show it to more people", "Stop showing it"] }),
        result: (rs) => {
          const right = rs.filter((r) => (r.answer === 0) === (F[r.round.cards![0].id].tier === "breakout")).length
          return { headline: `Right on ${right} of ${rs.length}. Chance is half.`, rows: rs.map(({ round, answer }) => ({ shown: titleOf(round.cards![0].id), answer: choiceAnswer(round, answer), actual: outcome(round.cards![0].id) })) }
        },
      },
    },
    {
      n: 2,
      title: "The seed test",
      lesson: [
        "The first audience is the seed test. Its viewers watch, skip, finish or scroll, and those first hours carry most of what can be known about a short.",
        `A classifier on this site that reads a short's first hours shows how fast that knowledge arrives. On ${VEL.n} shorts its AUC was ${VEL.aucByHorizon["1"].toFixed(2)} after one hour, ${VEL.aucByHorizon["3"].toFixed(2)} after three and ${VEL.aucByHorizon["6"].toFixed(2)} after six, where 0.5 is chance.`,
        "Simulating the seed test needs simulated viewers, and they have to be modeled on real ones: what a person watches and what they skip when shorts arrive one after another.",
        "The exercise is a short feed. Each short arrives alone, and the answer is watch or skip. A session of those answers is one viewer's raw material for the simulator, and for a ranker of feeds.",
      ],
      exercise: {
        pool: "feed",
        rounds: 8,
        build: (id) => ({ id, kind: "pick", prompt: "Watch or skip?", cards: [card(poolItem("feed", id).v[0])], from: "choices", choices: ["Watch", "Skip"] }),
        result: (rs) => ({
          headline: `${rs.filter((r) => r.answer === 0).length} watched and ${rs.filter((r) => r.answer === 1).length} skipped of ${rs.length}.`,
          rows: rs.map(({ round, answer }) => ({ shown: titleOf(round.cards![0].id), answer: choiceAnswer(round, answer), actual: outcome(round.cards![0].id) })),
        }),
      },
    },
    {
      n: 3,
      title: "Base rates",
      lesson: [
        "A simulator has to reproduce how often things happen before it can say when. One that makes every third short a Hit is wrong before it is run.",
        `Base rates differ by kind of channel. The catalog's ${fmt(SETTLED)} settled shorts broke out at different rates in each family of channels.`,
        "People misjudge base rates. A vivid breakout is remembered; the many shorts that drew their usual audience are not.",
        "The exercise asks, for each family of channels, what share of its shorts broke out. The measured share is shown beside each estimate.",
      ],
      exercise: {
        pool: "familyRates",
        rounds: 5,
        build: (id) => {
          const f = ITEMS.familyRates.find((x) => x.id === id)!
          return { id, kind: "number", prompt: "What percent of this family's shorts broke out, at three times the channel median or more?", context: f.family, unit: "percent", max: 100 }
        },
        result: (rs) => {
          const miss = rs.map((r) => Math.abs((r.answer as number) - ITEMS.familyRates.find((f) => f.id === r.round.id)!.breakoutShare * 100))
          return {
            headline: `The estimates missed by ${Math.round(miss.reduce((a, b) => a + b, 0) / miss.length)} points on average.`,
            rows: rs.map(({ round, answer }) => ({ shown: round.context!, answer: `${answer}%`, actual: pct(ITEMS.familyRates.find((f) => f.id === round.id)!.breakoutShare) })),
          }
        },
      },
    },
    {
      n: 4,
      title: "Checking against the world",
      lesson: [
        "A simulator is checked by running it on cases whose outcomes are known and comparing what it produces with what happened: how many Hits, how many Misses, and when the views came.",
        `On this site's followed shorts, a Hit's steepest hour of growth came at hour ${SIM.all.peakHour.hits} after posting, against hour ${SIM.all.peakHour.rest} for the rest. A simulator that has every short peak in its first hour fails that check whatever its averages say.`,
        "People make the same three-way call a simulator has to make: will this short be a Hit, a Miss or neither.",
        "The exercise asks that call on shorts whose outcomes are known, about a third of each kind. The score is set beside the one in three a guess would get.",
      ],
      exercise: {
        pool: "hitMiss",
        rounds: 9,
        build: (id) => ({ id, kind: "pick", prompt: "Hit, Miss, or in between?", cards: [card(poolItem("hitMiss", id).v[0])], from: "choices", choices: ["Hit: 3x the channel median or more", "In between", "Miss: half the median or less"] }),
        result: (rs) => {
          const tierOf = ["breakout", "baseline", "killed"]
          const right = rs.filter((r) => tierOf[r.answer as number] === F[r.round.cards![0].id].tier).length
          return { headline: `Right on ${right} of ${rs.length}. A guess gets one in three.`, rows: rs.map(({ round, answer }) => ({ shown: titleOf(round.cards![0].id), answer: choiceAnswer(round, answer), actual: outcome(round.cards![0].id) })) }
        },
      },
    },
  ],
}

const lineById = (id: string) => ITEMS.lines.find((l) => l.id === id)!
const scriptTitle = (id: string) => SCRIPTS.find((s) => s.id === id)?.title ?? id

const LANGUAGE: CourseDef = {
  id: "language-model",
  title: "The Language Model",
  line: "Predicts the next word, and from that writes, summarizes and answers in text.",
  chapters: [
    {
      n: 1,
      title: "The next word",
      lesson: [
        "A language model predicts the next word from the words before it. Trained on enough text, that one skill becomes writing, summarizing and answering.",
        "What it knows is what was in the text. It writes the next line of a script the way scripts in its training went on, which makes it fluent and generic at once.",
        "Lines written by people for a particular cause and audience are what a model needs to write for that cause and audience, rather than for the average one.",
        "The exercise gives the first line of a script and asks for the next. The script's own next line is shown after, and both are kept.",
      ],
      exercise: {
        pool: "openings",
        rounds: 3,
        build: (id) => ({ id, kind: "text", prompt: "Write the line that comes next.", context: ITEMS.openings.find((o) => o.script === id)!.text }),
        result: (rs) => ({ headline: recorded(rs, "continuations"), rows: rs.map(({ round, answer }) => ({ shown: round.context!, answer: String(answer), actual: ITEMS.openings.find((o) => o.script === round.id)!.next })) }),
      },
    },
    {
      n: 2,
      title: "Preference",
      lesson: [
        "A model that predicts text well does not yet know which text is better. That comes from preference data: two answers to the same request, and a person's choice between them.",
        "Preference pairs are how language models are tuned toward what people want. Many such choices teach a model which of two plausible outputs to favor.",
        "For a script, the opening line decides whether a viewer stays. Which opening holds a viewer of a campaign short is a question only viewers can answer.",
        "The exercise shows two opening lines from the script library and asks which would keep a viewer watching.",
      ],
      exercise: {
        pool: "openingPairs",
        rounds: 6,
        build: (id) => {
          const p = ITEMS.openingPairs.find((x) => x.id === id)!
          return { id, kind: "pick", prompt: "Pick the opening that would keep a viewer watching.", texts: p.scripts.map((s) => ITEMS.openings.find((o) => o.script === s)!.text), from: "texts", cant: true }
        },
        result: (rs) => ({ headline: recorded(rs, "preference pairs"), rows: rs.map(({ round, answer }) => ({ shown: round.texts!.join(" / "), answer: pickLabel(round, answer) })) }),
      },
    },
    {
      n: 3,
      title: "Grounding",
      lesson: [
        "A language model states things fluently whether or not they are true. A wrong figure in a smooth sentence is the commonest failure and the hardest to see.",
        "Grounding is the remedy: the model writes from records it is given, and every claim of fact points at its source.",
        "Grounding starts with knowing which sentences are claims. A fact needs a source; an opinion or an appeal needs none. A model that cannot tell them apart either cites too little or buries a script in citations.",
        "The exercise shows lines from the script library and asks what each one is. Each answer is a label for teaching a model to find the claims in its own writing.",
      ],
      exercise: {
        pool: "lines",
        rounds: 7,
        build: (id) => ({ id, kind: "pick", prompt: "What is this line?", context: lineById(id).text, from: "choices", choices: ["A fact that needs a source", "An opinion or an appeal", "Neither"] }),
        result: (rs) => ({
          headline: `${rs.filter((r) => r.answer === 0).length} of ${rs.length} lines marked as facts that need a source.`,
          rows: rs.map(({ round, answer }) => {
            const l = lineById(round.id)
            const src = SCRIPTS.find((s) => s.id === l.script)?.why?.find((w) => w.line === l.line)?.source?.label
            return { shown: l.text, answer: choiceAnswer(round, answer), actual: src ? `The library cites ${src}` : "No source cited in the library" }
          }),
        }),
      },
    },
    {
      n: 4,
      title: "Evaluation",
      lesson: [
        "A language model is evaluated by people more than by any score. Automatic measures check that a script is fluent and on topic; only a reader can say whether it lands.",
        "The most useful evaluation is an edit. A person rewrites what was written, and the pair, before and after, shows exactly what better means.",
        "Edit pairs train a model toward the edit, and they show where its habits fail most: the same kind of line rewritten again and again.",
        "The exercise gives lines from the script library and asks for a rewrite that lands harder and stays true. The original and the rewrite are kept as a pair.",
      ],
      exercise: {
        pool: "lines",
        rounds: 3,
        build: (id) => ({ id, kind: "text", prompt: "Rewrite this line so it lands harder. Keep it true.", context: lineById(id).text, note: scriptTitle(lineById(id).script) }),
        result: (rs) => ({ headline: recorded(rs, "edit pairs"), rows: rs.map(({ round, answer }) => ({ shown: round.context!, answer: String(answer) })) }),
      },
    },
  ],
}

export const COURSES: CourseDef[] = [RANKER, ENCODER, REGRESSOR, SIMULATOR, LANGUAGE]
export const courseById = (id: string) => COURSES.find((c) => c.id === id) ?? null

// Pools that are not video items: their round ids come from the other lists.
const poolIds = (pool: string): string[] =>
  pool === "familyRates" ? ITEMS.familyRates.map((f) => f.id) : pool === "openings" ? ITEMS.openings.map((o) => o.script) : pool === "openingPairs" ? ITEMS.openingPairs.map((p) => p.id) : pool === "lines" ? ITEMS.lines.map((l) => l.id) : ITEMS.pools[pool].map((x) => x.id)

/** A learner's rounds for one chapter: drawn from the pool in an order seeded by email, course and
 *  chapter, so each learner gets different items and the same ones on every visit. */
export function rounds(email: string, course: CourseDef, n: number): Round[] {
  const ex = course.chapters[n - 1].exercise
  return seeded(poolIds(ex.pool), `${email}|${course.id}|${n}`).slice(0, ex.rounds).map(ex.build)
}

/** What was shown in a round, stored with the answer so the row stands alone. */
export const shownIn = (r: Round) => [r.anchor?.id, ...(r.cards ?? []).map((c) => c.id)].filter(Boolean) as string[]

export function validAnswer(r: Round, a: unknown): a is Answer {
  if (r.kind === "pick") {
    const n = r.from === "cards" ? r.cards!.length : r.from === "texts" ? r.texts!.length : r.choices!.length
    return Number.isInteger(a) && (a as number) >= (r.cant ? -1 : 0) && (a as number) < n
  }
  if (r.kind === "order") return Array.isArray(a) && a.length === r.cards!.length && new Set(a).size === a.length && a.every((x) => Number.isInteger(x) && x >= 0 && x < a.length)
  if (r.kind === "number") return typeof a === "number" && Number.isFinite(a) && a >= 0 && (r.max == null || a <= r.max)
  if (r.kind === "range") return Array.isArray(a) && a.length === 2 && a.every((x) => typeof x === "number" && Number.isFinite(x) && x >= 0)
  return typeof a === "string" && a.trim().length >= 2 && a.length <= 1000
}

type Row = Item & { voter: string; round: string; answer: Answer; at: string }
const pk = (course: string, n: number) => `EXERCISE#${course}#${n}`

export async function saveAnswer(email: string, course: string, n: number, r: Round, answer: Answer) {
  const at = now()
  await putOnce({ pk: pk(course, n), sk: `${email}#${r.id}#${at}`, voter: email, round: r.id, shown: shownIn(r), answer: typeof answer === "string" ? answer.trim() : answer, at })
}

/** The learner's latest answer per round of one chapter. */
export async function myAnswers(email: string, course: string, n: number): Promise<Record<string, Answer>> {
  const rows = (await query<Row>(pk(course, n), `${email}#`)).sort((a, b) => a.at.localeCompare(b.at))
  return Object.fromEntries(rows.map((r) => [r.round, r.answer]))
}

export function chapterResult(course: CourseDef, n: number, rs: Round[], a: Record<string, Answer>): Result {
  return course.chapters[n - 1].exercise.result(rs.map((round) => ({ round, answer: a[round.id] })))
}
