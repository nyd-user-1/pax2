// What each Swayable trait means, for the people labeling on /labeling.
//
// Where the words come from. In Hewitt et al. (APSR 2024) every ad was rated by undergraduate
// research assistants who watched it: eight assistants with three ratings per video in 2018,
// eleven with two in 2020, the ratings adjusted for rater bias and averaged. The paper's
// Supplementary Material reports each item's reliability (Appendix A.4, Figure OA9) but not the
// item wording; the technique items follow the propaganda devices the paper cites (Yourman 1939,
// the Institute for Propaganda Analysis). The definitions below are PAX2's plain reading of each
// item, written to be answered from the video alone. Reliability in the original was high for
// explicit traits (who the messenger is) and low for subjective ones ("how pushy" sat at 0.23 for
// a single rater), so a pass is the right answer when the video does not make it clear.
// data/raw/swayable/definitions.R is the archive's own code, verbatim: defined_term_names, its name for each term.
// data/raw/swayable/reliability-DA35.tsv is Table DA35 of the Dataverse appendix: the raters' ICC(C,k) per item, 2018 and 2020.

import reliability from "../../data/generated/swayable-reliability.json"

export const SOURCE_NOTE =
  "Rated in the original archive by research assistants watching each ad, two or three per video, averaged. Answer from what the video shows and says; pass when it is not clear."

export const TRAIT_DEFINITIONS: Record<string, string> = {
  technique_plain_folks: "The speaker presents as an ordinary person like the viewer, one of us, to earn trust: everyday setting, everyday words, no title or office in front.",
  technique_pos_testimonial: "Someone vouches for the candidate or the cause from their own experience or standing.",
  technique_neg_testimonial: "Someone speaks against the opponent or the other side from their own experience or standing.",
  messenger_every_people: "The people speaking are presented as ordinary citizens, not candidates, officials, experts or celebrities.",
  messenger_politician: "A candidate or an elected official speaks on camera or in voice.",
  messenger_celebrity: "Someone known outside politics speaks: an entertainer, athlete, or public figure.",
  messenger_veteran: "A speaker identified as having served in the military.",
  narration_personal_story: "The video is built around one person's own experience, told in their words.",
  narration_explain_facts: "The video informs: what the measure or policy is, what happened, how it works.",
  narration_advocate_opinions: "The video argues a position and asks the viewer to agree, more than it explains.",
  policy_facts: "Specific claims about what a policy, law or ballot measure does or would do.",
  fact_cite_yes: "At least one fact is attributed to a named source: a study, an agency, a news outlet, a document.",
  fact_new_yes: "It offers at least one fact most viewers would not already know.",
  emotion_anger: "The video works to make the viewer angry at someone or something.",
  emotion_enthusiasm: "The video works to make the viewer excited or energized about the candidate or cause.",
  emotion_fear: "The video works to make the viewer afraid of what happens if the other side wins.",
  emotion_hope_pride: "The video works to make the viewer feel hopeful or proud: of a place, a people, a future.",
  emotion_humor: "The video is trying to be funny, at least in part.",
  emotion_somber: "The video is grave and serious in mood: quiet, solemn, mournful.",
  tone_positive: "Mostly about the merits of the candidate, cause or measure it supports. One of positive, negative and contrast is the ad's primary tone; agree with at most one.",
  tone_negative: "Mostly about the faults of the opponent, the other side, or the way things are. One of positive, negative and contrast is the ad's primary tone; agree with at most one.",
  tone_contrast: "Sets the two sides against each other, us against them, this against that. One of positive, negative and contrast is the ad's primary tone; agree with at most one.",
  explicit_vote_for: "It plainly asks the viewer to vote for the candidate or the ballot question.",
  production_value_high: "Professionally made: lighting, sound, editing, graphics, music.",
  style_amateur: "Looks shot on a phone by the speaker or a friend: handheld, unpolished, selfie-like.",
  style_text_on_screen: "Words on screen beyond captions of the speech: titles, numbers, labels, slogans.",
  style_animation: "Animated or motion-graphic sequences, not only live footage.",
  how_scripted: "The delivery reads as written and rehearsed rather than spoken off the cuff.",
}

/** The archive's name for each trait, from defined_term_names in data/raw/swayable/definitions.R.
 *  scripts/swayable-reliability.mjs matches these names to the reliability table. */
export const TRAIT_NAMES: Record<string, string> = {
  technique_plain_folks: "Technique: Plain folks",
  technique_pos_testimonial: "Technique: Positive testimonial",
  technique_neg_testimonial: "Technique: Negative testimonial",
  messenger_every_people: "Messenger: Everyday people",
  messenger_politician: "Messenger: Politician",
  messenger_celebrity: "Messenger: Celebrity",
  messenger_veteran: "Messenger: Veteran",
  narration_personal_story: "Narration: Personal story",
  narration_explain_facts: "Narration: Facts",
  narration_advocate_opinions: "Narration: Advocate opinions",
  policy_facts: "Policy facts",
  fact_cite_yes: "Cited fact",
  fact_new_yes: "New fact",
  emotion_anger: "Emotion: Anger",
  emotion_enthusiasm: "Emotion: Enthusiasm",
  emotion_fear: "Emotion: Fear",
  // The worker reads the archive's emotion_pride column as emotion_hope_pride (worker/model.py).
  emotion_hope_pride: "Emotion: Pride",
  emotion_humor: "Emotion: Humor",
  emotion_somber: "Emotion: Somber",
  tone_positive: "Primary tone: Positive",
  // tone_negative and how_scripted are tagging columns the archive's label map does not name;
  // they keep their featureLabels text.
  tone_negative: "Negative tone",
  tone_contrast: "Primary tone: Contrast",
  explicit_vote_for: "Explicit vote for",
  production_value_high: "Production value: High",
  style_amateur: "Style: Amateur",
  style_text_on_screen: "Style: Text on screen",
  style_animation: "Style: Animation",
  how_scripted: "Sounds scripted",
}

export type Reliability = { year: number; icc: number; lower: number; upper: number }
/** How well the archive's raters agreed on a trait, ICC(C,k) per year (Table DA35), for the trait
 *  keys whose archive name has a row; written by scripts/swayable-reliability.mjs. */
export const TRAIT_RELIABILITY = reliability.traits as Record<string, Reliability[]>
