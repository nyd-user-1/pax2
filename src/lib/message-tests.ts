// Message tests (Brendan, 2026-10-24): a randomized test of videos against a placebo, run on pax itself.
// Each respondent consents, passes an attention check, answers the background questions, watches one
// randomly assigned video (a test video or the placebo), then answers the outcome questions. The design
// mirrors the Grow Progress tests already on /experiments (same outcome wording, same voter groups) so the
// two can be compared. No respondents are bought yet: the flow, the storage and the analysis are ready
// for whatever panel is contracted, and the simulator checks the analysis against planted effects.
//
// Methodology, fixed before fielding:
//   - Between subjects: one video per respondent; every test video is compared with the placebo.
//   - Assignment: simple randomization, uniform over the arms, made on the server after the background
//     questions, so a screened-out respondent is never assigned.
//   - Exclusion: only the attention check, asked before any video. Failing it ends the survey. The video
//     check after the video is reported, never used to exclude (it is post-treatment).
//   - Estimate: lift over the placebo, adjusted for the background answers (Lin 2013: OLS with centered
//     covariates interacted with treatment, HC2 robust standard errors). Unadjusted difference in means
//     alongside. Voter groups: unadjusted difference within the group, flagged when a cell is small.
//   - Many arms: Holm's correction across the arms' ballot-support lifts.
//   - Unweighted: weighting to the population waits for a real sample.

export type Arm = { id: string; label: string; youtube: string; placebo: boolean; check: number | null }
export type Choice = { question: string; options: string[] }

export type MessageTest = {
  id: string
  name: string
  measure: string
  status: "draft" | "live" | "closed"
  arms: Arm[]
  attention: Choice & { answer: number }
  videoCheck: Choice | null
  vote: Choice & { yes: number[] }
  comprehension: (Choice & { explainer: string; answer: number }) | null
  perArm: number
  confidence: 90 | 95
  completion: { code: string; url: string; screenUrl: string }
  by: string
  createdAt: string
  updatedAt: string
}

/** What the respondent's browser is sent: the questions, never the answers or the arms. */
export type PublicSurvey = {
  attention: Choice
  videoCheck: Choice | null
  vote: Choice
  comprehension: (Choice & { explainer: string }) | null
}

export type Step = "consent" | "attention" | "about" | "video" | "check" | "vote" | "comprehension" | "done" | "screened"

export type Response = {
  id: string
  testId: string
  step: Step
  preview: boolean
  panel: Record<string, string>
  startedAt: string
  completedAt: string | null
  attention: number | null
  passed: boolean | null
  about: Record<string, string>
  arm: string | null
  watched: number | null
  check: number | null
  vote: number | null
  comprehension: number | null
}

/** The background questions: the voter groups of the Grow Progress report, in its order. `adjust` marks
 *  the ones the estimate is adjusted for. */
export const ABOUT: { key: string; label: string; question: string; options: string[]; adjust: boolean }[] = [
  { key: "gender", label: "Gender", question: "What is your gender?", options: ["Man", "Woman", "Another gender"], adjust: true },
  { key: "age", label: "Age", question: "How old are you?", options: ["18–34", "35–54", "55+"], adjust: true },
  { key: "race", label: "Race/ethnicity", question: "Which best describes you?", options: ["Black", "Latino", "White", "Asian", "Another race or ethnicity"], adjust: false },
  { key: "education", label: "Education", question: "What is the highest level of school you have completed?", options: ["High school or less", "Some college", "Bachelor's degree or more"], adjust: true },
  { key: "income", label: "Household income", question: "What was your household's income last year?", options: ["$0–$49K", "$50K–$99K", "$100K+"], adjust: false },
  { key: "parent", label: "Parental status", question: "Are you the parent or guardian of a child under 18?", options: ["Yes", "No"], adjust: false },
  { key: "ideology", label: "Political ideology", question: "Politically, do you consider yourself…", options: ["Liberal", "Moderate", "Conservative"], adjust: true },
  { key: "party", label: "Party ID", question: "Generally speaking, do you think of yourself as a…", options: ["Democrat", "Independent or other", "Republican"], adjust: true },
  { key: "urbanicity", label: "Urbanicity", question: "Which best describes where you live?", options: ["Urban", "Suburban", "Rural"], adjust: false },
  { key: "vote2024", label: "2024 presidential vote", question: "In the 2024 presidential election, did you vote for…", options: ["Kamala Harris", "Donald Trump", "Someone else", "I did not vote"], adjust: true },
  { key: "turnout2022", label: "2022 midterm turnout", question: "Did you vote in the November 2022 election?", options: ["Yes", "No", "Not sure"], adjust: false },
]

const code = () => Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("")

/** A new test, its questions in the Grow Progress tests' wording. */
export function newTest(id: string, by: string): MessageTest {
  const at = new Date().toISOString()
  return {
    id,
    name: "Untitled test",
    measure: "Question 3",
    status: "draft",
    arms: [{ id: "placebo", label: "Placebo", youtube: "", placebo: true, check: null }],
    attention: {
      question: "Many people find questions about public issues interesting. To show you are reading carefully, select “Somewhat disagree.”",
      options: ["Strongly agree", "Somewhat agree", "Neither agree nor disagree", "Somewhat disagree", "Strongly disagree"],
      answer: 3,
    },
    videoCheck: {
      question: "Which of these was the video you just watched mainly about?",
      options: ["A Massachusetts ballot question about elections", "A consumer product", "A sports event", "A recipe"],
    },
    vote: { question: "If the election were held today, how would you vote on Ballot Question 3?", options: ["Yes", "No", "Would not vote"], yes: [0] },
    comprehension: {
      explainer:
        "Question 3 would change how Massachusetts holds primary elections for state offices. Instead of a separate primary for each party, all candidates would appear on the same primary ballot, and the two candidates with the most votes overall would advance to the general election.",
      question: "Which of the following best describes the main change Question 3 would make to Massachusetts state primary elections?",
      options: [
        "Create one primary with all candidates on the same ballot, with the top two vote-getters overall advancing to the general election",
        "Let voters rank candidates in order of preference in the general election",
        "Require candidates to collect more signatures to appear on the ballot",
        "End primary elections for state offices",
      ],
      answer: 0,
    },
    perArm: 500,
    confidence: 90,
    completion: { code: code(), url: "", screenUrl: "" },
    by,
    createdAt: at,
    updatedAt: at,
  }
}

export const publicSurvey = (t: MessageTest): PublicSurvey => ({
  attention: { question: t.attention.question, options: t.attention.options },
  videoCheck: t.videoCheck,
  vote: { question: t.vote.question, options: t.vote.options },
  comprehension: t.comprehension ? { explainer: t.comprehension.explainer, question: t.comprehension.question, options: t.comprehension.options } : null,
})

/** A YouTube id from an id or any YouTube URL (watch, shorts, youtu.be, embed). */
export function youtubeId(s: string): string {
  const v = s.trim()
  const m = v.match(/(?:v=|shorts\/|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : /^[A-Za-z0-9_-]{11}$/.test(v) ? v : ""
}
