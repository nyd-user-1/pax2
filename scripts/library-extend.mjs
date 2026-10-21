// Appends the 2026-10-21 batch: twenty-four scripts written from the persuasion record, every
// line's reason traced to a dataset the Library serves. Research keys resolve against
// data/generated/model/reference-model.json on the page, so the numbers are never hand-typed here.
// Facts used: 106 of 160 MA House districts had one name in 2022 (/library/ma-house-2022);
// 628 of the last 1,000 races uncontested, 2014-2022 (/polling); the state's last-place
// competitiveness ranking (the claim of record). Idempotent: existing ids are replaced.

import { readFileSync, writeFileSync } from "node:fs"

const SW = (label) => ({ label: `Swayable archive, 574 vote-choice ads`, href: "/library/swayable-archive", ...(label ? { label } : {}) })
const UP = { label: "Upworthy archive, 32,487 headline tests", href: "/library/upworthy-archive" }
const MA = { label: "MA House 2022 ballot counts", href: "/library/ma-house-2022" }
const POLL = { label: "Uncontested races 2014–2022", href: "/polling" }
const COP = { label: "Coppock, Hill & Vavreck · Science Advances 2020", href: "/library/coppock-2020" }
const WES = { label: "Wesleyan Media Project codebook", href: "/library/wesleyan-codebook" }
const EMO = { label: "Emotional-appeals replication data · Harvard Dataverse", href: "/library/emotional-ads" }

const SOURCE = "PAX2, written from the persuasion record (2026-10-21)"

const S = (id, title, approach, framing, text, why, extra = {}) => ({ id, title, short: extra.short ?? title, approach, framing, source: SOURCE, text, why, ...extra })

const BATCH = [
  // ---- The hard number ----
  S("six-score", "106 of 160", "The hard number", "The 2022 count, said once and left to stand.",
    "In 2022, 106 of the 160 Massachusetts House districts had exactly one name on the ballot.\nNot one competitive race — one name. No second choice printed anywhere.\nI checked my own district. One name.\nQuestion 3 opens the primary so every candidate faces every voter, and the top two go to November.\nIf your ballot should carry more than one name, vote yes on Question 3.",
    [
      { line: 0, note: "The count opens the script: a concrete number in the first line is the opening pattern that won the randomized headline tests.", source: UP },
      { line: 0, note: "106 of 160 is the 2022 general-election ballot count, district by district.", source: MA },
      { line: 4, note: "The explicit ask closes it; asking directly for the vote is one of the two strongest script choices in the control-tested ads.", research: "explicit_vote_for" },
    ]),
  S("thousand", "628 of 1,000", "The hard number", "A decade of races in one count.",
    "Massachusetts held about a thousand state House races over the last decade.\n628 of them had one name on the ballot.\nThat is not a bad year. That is the system working as designed.\nQuestion 3 redesigns it: one open primary, every voter, every candidate, and the top two advance.\nVote yes on Question 3.",
    [
      { line: 1, note: "628 of the last 1,000 races, 2014–2022, from the returns PAX2 holds.", source: POLL },
      { line: 2, note: "A fact most viewers haven't heard is one of the few script choices that paid off on favorability in the tests.", research: "fact_new_yes", outcome: "favorability" },
      { line: 4, note: "The ask, stated plainly.", research: "explicit_vote_for" },
    ]),
  S("dead-last", "Dead Last", "The hard number", "The ranking, then the remedy.",
    "There are fifty states, and Massachusetts ranks fiftieth in electoral competitiveness.\nLast. Behind every state people make jokes about.\nWe did not get here because voters stopped caring. We got here because most races end before voters ever see them.\nQuestion 3 puts every candidate in front of every voter in one open primary.\nVote yes on 3, and make fiftieth place somebody else's problem.",
    [
      { line: 0, note: "The last-place competitiveness ranking is the claim of record this library is built around; the returns behind it are on the polling page.", source: POLL },
      { line: 2, note: "Contrast carried a positive lean in the control-tested ads — naming the cause against the false explanation.", research: "tone_contrast" },
      { line: 4, note: "The ask closes.", research: "explicit_vote_for" },
    ]),
  S("one-name", "The Ballot in Your Hand", "The hard number", "What uncontested looks like at the booth.",
    "Picture your ballot. State Representative. One name. One oval.\nThat was the whole race in 106 of our 160 districts in 2022.\nFilling in that oval is not choosing. It is confirming.\nQuestion 3 gives the choice back: an open primary where every voter picks among every candidate, and the top two meet in November.\nVote yes on Question 3.",
    [
      { line: 0, note: "The script opens on the object in the viewer's hand, not an abstraction — the concrete-first opening from the headline tests.", source: UP },
      { line: 1, note: "The 2022 district count.", source: MA },
      { line: 4, note: "The ask.", research: "explicit_vote_for" },
    ]),
  // ---- Plain folks ----
  S("nurse", "Night Shift", "Plain folks", "A nurse's version of accountability.",
    "I'm a nurse. If I skipped my checks because nobody was watching, I'd lose my license.\nMy state representative hasn't had an opponent in three elections. Nobody is watching.\nThat is not about one person. It is about what any of us do when no one can replace us.\nQuestion 3 means every seat gets a real race.\nI'm voting yes on 3. Watch them again.",
    [
      { line: 0, note: "Plain-folks framing — the speaker's own job carries the argument — is the single strongest trait in the control-tested ads.", research: "technique_plain_folks" },
      { line: 2, note: "One message, said plainly: the randomized ad experiments found small, roughly uniform effects, which rewards a single clear claim over a stack of them.", source: COP },
      { line: 4, note: "The ask, first person.", research: "explicit_vote_for" },
    ]),
  S("carpenter", "No-Bid Job", "Plain folks", "A contractor's word for an uncontested race.",
    "I'm a carpenter. When a job goes out without bids, everybody knows what happens to the price and the work.\nMost State House races here are no-bid jobs. One name, no competition, same result.\n628 of the last thousand races had one candidate.\nQuestion 3 puts every seat out to bid: open primary, every voter, top two advance.\nVote yes on Question 3.",
    [
      { line: 0, note: "Plain-folks speech from a trade the viewer recognizes.", research: "technique_plain_folks" },
      { line: 2, note: "The decade count.", source: POLL },
      { line: 4, note: "The ask.", research: "explicit_vote_for" },
    ]),
  S("teacher", "Show Your Work", "Plain folks", "A teacher's standard, applied to the ballot.",
    "I teach eighth grade. My students don't get credit for answers they never had to defend.\nIn 2022, 106 of 160 House races in this state had one name on the ballot. No debate. Nothing to defend.\nWe hold fourteen-year-olds to a higher standard than the people writing our laws.\nQuestion 3 makes every candidate show their work to every voter.\nVote yes on 3.",
    [
      { line: 0, note: "Plain-folks framing.", research: "technique_plain_folks" },
      { line: 1, note: "The 2022 count.", source: MA },
      { line: 3, note: "Everyday people as messengers lean positive in the tests.", research: "messenger_every_people" },
    ]),
  S("diner", "Open Six Days", "Plain folks", "A small-business read on competition.",
    "I run a diner. If the place across the street closed, I could serve worse coffee at a higher price — for a while.\nMassachusetts politics has no place across the street. Most races have one name on the ballot.\nCompetition isn't a theory to me. It is why I'm good at my job.\nQuestion 3 brings it back: open primary, every voter, top two.\nVote yes on Question 3.",
    [
      { line: 0, note: "Plain-folks framing, the strongest tested trait.", research: "technique_plain_folks" },
      { line: 2, note: "Advocating from lived experience rather than policy abstraction; personal story leans positive in the tests.", research: "narration_personal_story" },
      { line: 4, note: "The ask.", research: "explicit_vote_for" },
    ]),
  // ---- The ask ----
  S("ask-first", "Yes on 3, Here's Why", "The ask", "The ask opens instead of closing.",
    "Vote yes on Question 3. Here is the whole argument.\nIn 2022, two thirds of our House districts had one name on the ballot.\nQuestion 3 replaces the closed primary with one open race: every candidate, every voter, top two to November.\nIt does not help one party. It helps whoever shows up with the most voters.\nThat's it. Yes on 3.",
    [
      { line: 0, note: "The ask moved to the first line — the batch's structural test of where the strongest tested choice belongs; the archive measured that ads with the ask beat ads without it, not where it sits.", research: "explicit_vote_for" },
      { line: 1, note: "The 2022 count, rounded honestly: 106 of 160 is 66%.", source: MA },
    ]),
  S("ask-twice", "Twice, Plainly", "The ask", "The ask opens and closes the same script.",
    "I'm asking for your vote on Question 3. Not your outrage — your vote.\nMost State House races here have one name on the ballot. The decade's count is 628 uncontested out of a thousand.\nAn open primary fixes the arithmetic: every candidate in front of every voter, top two advance.\nSo I'll say it twice because it matters once: vote yes on Question 3.",
    [
      { line: 0, note: "The explicit ask, twice; the tested trait is its presence.", research: "explicit_vote_for" },
      { line: 1, note: "The decade count.", source: POLL },
      { line: 2, note: "One mechanism, no sidebars — sized to the small, uniform effects the randomized ad experiments measure.", source: COP },
    ]),
  S("fifteen", "Fifteen Seconds", "The ask", "The shortest defensible version.",
    "One number, one ask.\n106 of 160 Massachusetts House districts had one name on the ballot in 2022.\nQuestion 3 opens the primary to every voter and sends the top two to November.\nVote yes on 3.",
    [
      { line: 1, note: "The count.", source: MA },
      { line: 3, note: "The ask; nothing else is in the script to dilute it.", research: "explicit_vote_for" },
    ]),
  S("november", "Make November Mean It", "The ask", "The ask framed as restoring the general election.",
    "November is supposed to be the decision.\nIn most of our House districts it is a formality — one name was printed before you walked in.\nQuestion 3 makes November a choice again: an open primary for everyone, and the top two on your fall ballot.\nIf you want your vote to decide something, vote yes on Question 3.",
    [
      { line: 1, note: "The uncontested record behind 'formality.'", source: POLL },
      { line: 3, note: "The ask, conditioned on the viewer's own stake.", research: "explicit_vote_for" },
    ]),
  // ---- Anger / contrast ----
  S("rubber-stamp", "The Rubber Stamp", "Anger", "The anger script, aimed at the system.",
    "Every two years we line up, show our ID, and rubber-stamp a decision that was made without us.\nOne name on the ballot in 106 of 160 districts. That is not an election. It is a receipt.\nNobody in power has to explain a single vote, because nobody can replace them.\nQuestion 3 ends the rubber stamp: open primary, every voter, top two.\nVote yes on 3.",
    [
      { line: 0, note: "Anger on purpose; angry ads ran ahead on favorability in the control tests, and the emotional-appeals replication is the check on that reading.", research: "emotion_anger", outcome: "favorability", source: EMO },
      { line: 1, note: "The 2022 count.", source: MA },
      { line: 4, note: "The ask.", research: "explicit_vote_for" },
    ]),
  S("no-debate", "No Debate", "Anger", "What never happens in an uncontested seat.",
    "No debate. No town hall. No awkward questions at the door.\nThat is what one name on the ballot buys: a representative who never has to answer anyone.\nIt happened in two thirds of our House districts in 2022.\nQuestion 3 puts a second name on your November ballot — every time.\nVote yes on Question 3.",
    [
      { line: 0, note: "The repetition pattern — three absences in one line — follows the tested contrast structure.", research: "tone_contrast" },
      { line: 2, note: "The count.", source: MA },
      { line: 3, note: "The mechanism stated as the viewer's own gain; the ask follows.", research: "explicit_vote_for" },
    ]),
  S("picked", "Picked For You", "Anger", "Who chooses, when voters don't.",
    "Somebody picked your state representative. It probably wasn't you.\nWhen a race is uncontested, the real decision happened earlier — in a primary most voters never see.\n628 of the last thousand races here ended that way.\nQuestion 3 moves the decision back into the open, where you are.\nVote yes on 3.",
    [
      { line: 0, note: "The anger lever, pointed at the process rather than a person — the tone coding the Wesleyan scheme separates.", research: "emotion_anger", outcome: "favorability", source: WES },
      { line: 2, note: "The decade count.", source: POLL },
    ]),
  S("two-districts", "Two Districts", "Contrast", "A contested and an uncontested district, side by side.",
    "In one Massachusetts district, two candidates knocked doors all fall, debated twice, and answered for every vote.\nNext door: one name on the ballot. No doors, no debate, no answers.\nSame state. Same year. The difference was the ballot.\nQuestion 3 makes the first district the rule instead of the exception.\nVote yes on Question 3.",
    [
      { line: 0, note: "Pure contrast structure, the tested lean.", research: "tone_contrast" },
      { line: 1, note: "The uncontested half of the pair is the 2022 record, not an invention.", source: MA },
      { line: 4, note: "The ask.", research: "explicit_vote_for" },
    ]),
  // ---- Messenger: veteran ----
  S("veteran-ballot", "What I Signed Up For", "Messenger", "A veteran reads the uncontested ballot.",
    "I served because people here get to choose who governs them.\nThen I came home, opened my ballot, and found one name for State Representative. No choice on the page.\nIn 2022 that was true in 106 of our 160 districts.\nQuestion 3 puts the choice back: every candidate, every voter, one open primary.\nI'm voting yes on 3.",
    [
      { line: 0, note: "A veteran as messenger leans positive in the control-tested ads, though the interval is wide — the tests lean, they don't settle it.", research: "messenger_veteran" },
      { line: 2, note: "The count.", source: MA },
      { line: 4, note: "The ask, first person.", research: "explicit_vote_for" },
    ]),
  S("veteran-earned", "Earned, Not Issued", "Messenger", "The veteran's standard for holding a seat.",
    "In the service, rank is earned, and it can be lost.\nA State House seat should work the same way. Here, most of them are issued: one name on the ballot, decade after decade.\nQuestion 3 makes every seat earned — an open primary, every voter, and the top two in November.\nVote yes on Question 3.",
    [
      { line: 0, note: "Veteran messenger, with the same wide-interval caveat.", research: "messenger_veteran" },
      { line: 1, note: "'Most of them' is the decade record.", source: POLL },
    ]),
  // ---- Somber ----
  S("quiet-booth", "The Quiet Booth", "Somber", "The somber read: what an empty race sounds like.",
    "The polling place is quiet in an uncontested year. Volunteers outnumber voters by the afternoon.\nPeople aren't lazy. They can count. One name on the ballot means the decision was already made.\nThat quiet is what 628 uncontested races in a decade sounds like.\nQuestion 3 gives people a reason to come back.\nVote yes on 3.",
    [
      { line: 0, note: "The somber register leans positive in the control tests; the emotional-appeals replication is the cross-check.", research: "emotion_somber", source: EMO },
      { line: 2, note: "The decade count.", source: POLL },
    ]),
  S("still-comes", "She Still Comes", "Somber", "The voter who shows up anyway.",
    "My mother has voted in every election since 1978. Most years now, her State House ballot has one name on it.\nShe fills in the oval anyway, because that is who she is.\nShe deserves a ballot that respects the trip.\nQuestion 3 puts a real race on it: open primary, every voter, top two.\nFor her, vote yes on Question 3.",
    [
      { line: 0, note: "A personal story in the somber register — both lean positive in the tests, neither decisively; the pairing is the experiment.", research: "narration_personal_story" },
      { line: 1, note: "'Most years' is the record, not rhetoric.", source: POLL },
      { line: 4, note: "The ask.", research: "explicit_vote_for" },
    ]),
  // ---- Negative testimonial ----
  S("stopped", "Why My Neighbor Stopped", "Testimonial", "The cost of uncontested races, in one voter.",
    "My neighbor stopped voting in state races. He told me why: 'They don't need me. There's one name on the ballot.'\nHe's not wrong about the ballot. 106 of 160 districts looked like that in 2022.\nHe's wrong that it can't change.\nQuestion 3 puts a second name in front of him — every candidate, every voter, top two.\nVote yes on 3, and give him a reason to come back.",
    [
      { line: 0, note: "A negative testimonial — the cost told through a person — leans positive in the control-tested ads.", research: "technique_neg_testimonial" },
      { line: 1, note: "The count.", source: MA },
      { line: 4, note: "The ask.", research: "explicit_vote_for" },
    ]),
  S("skipped", "I Skipped Two", "Testimonial", "First person: the lapsed voter comes back.",
    "I skipped the last two state elections. I'm not proud of it, but look at the ballot I got: one name, no race, nothing to decide.\nThis year is different, because this year the ballot carries Question 3.\nOne open primary. Every candidate. Every voter. Top two to November.\nI'm going back for that one. Vote yes on Question 3.",
    [
      { line: 0, note: "First-person negative testimonial; amateur, direct-to-camera delivery also leans positive in the tests.", research: "technique_neg_testimonial" },
      { line: 0, note: "The phone-shot register the script is written for.", research: "style_amateur" },
      { line: 3, note: "The ask.", research: "explicit_vote_for" },
    ]),
  // ---- Curiosity ----
  S("real-election", "The Election You Missed", "Curiosity", "The decision happens before November.",
    "Massachusetts holds an election most voters never see.\nIt is called the primary, and in two thirds of our House districts it is the whole contest — November just notarizes it.\nQuestion 3 moves that hidden election into the open: every voter invited, every candidate on one ballot, top two advance.\nStop missing the election that counts. Vote yes on 3.",
    [
      { line: 0, note: "A curiosity-gap opening — the claim is withheld for one line — the structure that won the headline tests.", source: UP },
      { line: 1, note: "'Two thirds' is the 2022 count.", source: MA },
      { line: 3, note: "The ask.", research: "explicit_vote_for" },
    ]),
  S("one-question", "One Question", "Curiosity", "The whole argument as a single question.",
    "Here's a question: when did you last see a State House debate in your district?\nIf you can't remember, it is probably because there was nobody to debate. One name, 106 of 160 districts, 2022.\nQuestion 3 makes debates worth holding again — every candidate faces every voter in one open primary.\nVote yes on Question 3.",
    [
      { line: 0, note: "Question-led opening, the curiosity structure from the headline archive.", source: UP },
      { line: 1, note: "The count.", source: MA },
      { line: 3, note: "The ask.", research: "explicit_vote_for" },
    ]),
]

const path = new URL("../data/library.json", import.meta.url).pathname
const lib = JSON.parse(readFileSync(path, "utf8"))
const ids = new Set(BATCH.map((s) => s.id))
lib.scripts = [...lib.scripts.filter((s) => !ids.has(s.id)), ...BATCH]
writeFileSync(path, JSON.stringify(lib, null, 1) + "\n")
console.log(`library.json now carries ${lib.scripts.length} scripts (${BATCH.length} from this batch)`)
