// What the Build dashboard shows beyond data/build.json: where the data comes from, what each page runs on,
// the limits the build works inside, and what each stretch of the build taught. Written by hand from the build.

export type SourceRow = { name: string; href: string; publisher: string; kind: string; covers: string; runsOn: string; status: "Loaded" | "Stand-in" | "Not connected" }

export const NOT_CONNECTED: SourceRow[] = [
  { name: "The partner's Ads Manager export", href: "/evals", publisher: "Meta Ads Manager", kind: "Paid results", covers: "The partner's real flights: spend, impressions, plays, watch time, actions", runsOn: "Load Data", status: "Stand-in" },
  { name: "The partner's videos", href: "/pipeline", publisher: "The partner", kind: "Video", covers: "The partner's own takes, in place of the synthetic eleven", runsOn: "S3 · worker box", status: "Stand-in" },
  { name: "Meta Ad Library", href: "https://www.facebook.com/ads/library/api", publisher: "Meta", kind: "Ad libraries", covers: "Every Question 3 ad on Facebook and Instagram", runsOn: "—", status: "Not connected" },
  { name: "Meta Marketing API", href: "https://developers.facebook.com/docs/marketing-api/insights", publisher: "Meta", kind: "Paid results", covers: "Results pulled directly, without a CSV", runsOn: "—", status: "Not connected" },
  { name: "TikTok Research API", href: "https://developers.tiktok.com/products/research-api/", publisher: "TikTok", kind: "Video", covers: "Reform campaigns' TikTok videos and counts", runsOn: "—", status: "Not connected" },
]

export type PageTile = {
  href: string
  name: string
  data: string
  state: "real" | "stand-in" | "mixed"
  facts: [string, string][]
  what: string
  how: string
  when: string
  wrong: string[]
  better: string[]
}

export const PAGES: PageTile[] = [
  {
    href: "/scored",
    name: "Home",
    data: "Stand-in results and videos",
    state: "stand-in",
    facts: [["Round", "2"], ["Videos", "11"], ["Results", "Stand-in"], ["Reads", "Ledger"]],
    what: "The current round at a glance: what to do next, the scored videos in a row, and how each framing is doing.",
    how: "Reads the workspace's loaded rounds from the ledger and scores every video against the frozen reference; Next up is built from what is missing (a round to load, a reading to ask for, a call to make).",
    when: "First thing each round: see what changed and what needs doing.",
    wrong: ["Every score comes from stand-in results until the partner's export is loaded."],
    better: ["Show what changed since the last visit.", "Volunteer videos in the row once uploads are analyzed."],
  },
  {
    href: "/dashboard",
    name: "Dashboard",
    data: "The ledger, sample data where it is empty",
    state: "mixed",
    facts: [["Blocks", "6"], ["Source", "Ledger"], ["Empty state", "Sample"], ["Charts", "GovBlock"]],
    what: "The campaign's content operation in one place: activity by day, volunteer videos, reach, calls called right, decisions from proposal to a made video.",
    how: "Counts readings, decisions, calls and submissions in the ledger; where the ledger is empty it shows labeled sample data so the page keeps its shape.",
    when: "Weekly, to see whether the loop is actually turning.",
    wrong: ["Most of what shows today is sample data, labeled as such."],
    better: ["Trend lines across rounds once there are several.", "A filter per campaign once there is more than one."],
  },
  {
    href: "/videos",
    name: "Videos",
    data: "Synthetic videos, stand-in results",
    state: "stand-in",
    facts: [["Videos", "11"], ["Scripts", "3"], ["Voices", "3"], ["Sorts", "4"]],
    what: "Every video as a card with its score, filtered by script and voice, sorted by score, reach, A to Z or newest.",
    how: "Each card is a video with its latest score; a card opens its version page in a drawer.",
    when: "To compare versions of the same script, or find the strongest messenger.",
    wrong: ["The videos are synthetic: Polly voices over stock footage."],
    better: ["The partner's own videos and volunteers' uploads in the same grid."],
  },
  {
    href: "/v/listen-stephen",
    name: "Version page",
    data: "Stand-in results; real analysis of synthetic videos; Hermes readings",
    state: "mixed",
    facts: [["Route", "/v/[id]"], ["Boxes", "4"], ["Reading", "~16 s"], ["Analysis", "3 checks"]],
    what: "One video in full: the player, its numbers, Rating (the score and its parts), Formula (the AI's notes), Transcript, and the Assessment with Call it.",
    how: "The score is computed from the loaded results; Formula and Transcript come from the pipeline's analysis; Assessment asks Claude on Bedrock for a reading that must cite the records.",
    when: "To understand why one video scored as it did and decide what to test next.",
    wrong: ["Results are stand-ins; the analysis is real but of synthetic videos."],
    better: ["Side-by-side with its siblings.", "Readings that compare against the campaign's real shorts."],
  },
  {
    href: "/scripts",
    name: "Scripts",
    data: "Research priors, polls, consensus, 2022 Massachusetts ballots",
    state: "real",
    facts: [["Scripts", "3"], ["Prior", "617 ads"], ["Map", "160 districts"], ["Votes", "Consensus"]],
    what: "The scripts to record, each with a research-based prior, what polling says about its claim, and where people agree, plus the uncontested-districts map.",
    how: "Priors come from the Swayable-based reference model; polling and consensus from GovBlock; the map from 2022 ballot counts.",
    when: "Before recording: choose which script deserves a messenger.",
    wrong: ["The research priors predict little out of sample, as the paper itself found."],
    better: ["The Upworthy hook score on each opening line.", "Polling specific to Question 3 as it is released."],
  },
  {
    href: "/record",
    name: "Record",
    data: "Working flow; uploads saved, not yet analyzed",
    state: "mixed",
    facts: [["Steps", "7"], ["Starts", "4 ways"], ["Studio", "No camera"], ["Uploads", "S3"]],
    what: "The volunteer's flow: pick a script or write one from three answers, film with a teleprompter or build in the studio, send.",
    how: "Runs full screen without the sidebar; a recording uploads straight to S3 and is logged as a submission.",
    when: "Whenever a volunteer is ready to record.",
    wrong: ["Uploads are saved but never analyzed or scored."],
    better: ["An upload starts the pipeline.", "Feedback to the volunteer once their video is scored."],
  },
  {
    href: "/evals",
    name: "Evals",
    data: "The ledger, sample data where it is empty",
    state: "mixed",
    facts: [["Loads", "2 rounds"], ["Calls", "Locked"], ["Uploads", "Load Data"], ["Empty state", "Sample"]],
    what: "Where results come in and get checked: the load history, Load Data, volunteer videos, decisions, and how each call came out.",
    how: "Every load, decision and call is a ledger record; calls are compared with the next round's scores.",
    when: "When a new export arrives, and after each round to see which calls held.",
    wrong: ["Decisions and calls shown are sample data until the loop is used."],
    better: ["Accuracy over time per person making calls."],
  },
  {
    href: "/campaigns",
    name: "Campaigns",
    data: "Public YouTube shorts, Google ad spend, election returns",
    state: "real",
    facts: [["Campaigns", "4"], ["Shorts", "129"], ["Map modes", "4"], ["Advertisers", "17"]],
    what: "Four reform campaigns side by side: their shorts' views per day and length, where reform money went on Google, and where races go uncontested.",
    how: "Shorts come from the YouTube Data API; the map from Google's political-ads report and Klarner election returns in GovBlock's lake.",
    when: "To benchmark against the field and see where the argument lands hardest.",
    wrong: ["Views are public counts only; the campaigns' own analytics are not available."],
    better: ["An organic score from views, likes and comments.", "The Question 3 shorts analyzed by the pipeline."],
  },
  {
    href: "/scoring",
    name: "Scoring",
    data: "The research archives and the reference model",
    state: "real",
    facts: [["Formula", "Resonance 1"], ["Parts", "3"], ["Reference", "Round 1"], ["Archive", "617 ads"]],
    what: "How Resonance is built, tested and limited, and what the research says about which ad features persuade.",
    how: "The formula, its weights and ranges are explained with the live reference; the research tab reads the reference model.",
    when: "When a number needs defending.",
    wrong: ["Resonance measures attention and action, not persuasion."],
    better: ["Resonance 2 beside it.", "A persuasion check on a slice of videos."],
  },
  {
    href: "/glossary",
    name: "Glossary",
    data: "Definitions",
    state: "real",
    facts: [["Terms", "23"], ["Linked from", "Info icons"], ["Groups", "Score, Delivery"], ["Edits", "lib/glossary.ts"]],
    what: "Every term on screen with its full name and definition.",
    how: "Each short label's info icon links to its entry here.",
    when: "Whenever a label is unclear.",
    wrong: [],
    better: ["Definitions in a hover card as well as on this page."],
  },
  {
    href: "/library",
    name: "Library",
    data: "Twelve datasets, previewed from S3",
    state: "real",
    facts: [["Datasets", "12"], ["Files", "S3"], ["Previews", "Live"], ["Kinds", "8"]],
    what: "Every dataset behind the app, with what it can and cannot tell you, its files and previews.",
    how: "Descriptions are written by hand; file lists and previews are read from S3.",
    when: "To check where a number comes from.",
    wrong: [],
    better: ["Each dataset linked to the pages that use it, both ways."],
  },
  {
    href: "/pipeline",
    name: "Pipeline",
    data: "The analysis results and their costs",
    state: "real",
    facts: [["Checks", "3"], ["Videos", "11 of 11"], ["Per video", "$0.04"], ["Trigger", "By hand"]],
    what: "What each video goes through after it is made: what starts a run, the three checks on the worker box, and where the results land.",
    how: "Reads each video's analysis results; while a batch runs, the box writes its progress for the page to show.",
    when: "To see what a video's notes came from, or what a run cost.",
    wrong: ["Every run is started by hand."],
    better: ["Uploads start runs."],
  },
]

export type Limit = { label: string; sub: string; used: number; limit: number; unit: string }

export type Lesson = { title: string; when: string; outcome: "clean" | "partial" | "failed"; headline: string; ran: string[]; lessons: string[] }

export const LESSONS: Lesson[] = [
  {
    title: "45-second versions",
    when: "Oct 3",
    outcome: "partial",
    headline: "11 rendered, 11 analyzed",
    ran: ["takes.py: one Polly generative clip per script line, Mixkit footage per line, ffmpeg captions", "analyze.py: Transcribe, Pegasus, measured sound", "scripts/standin.mjs: both rounds rebuilt for the new lengths"],
    lessons: [
      "Polly's generative voices return no word timings. Synthesizing each line on its own gives exact line starts; words inside a line are timed by their share of its characters.",
      "The worker box shuts itself down unless a process named pax-job… is running. A batch started as job-run.sh was stopped halfway; it reran as pax-job-analyze.sh.",
      "Interest divides watch time by the video's length, so stand-in results must be rebuilt whenever lengths change.",
      "The ledger keeps every load, so new results go into a fresh workspace rather than over the old one.",
    ],
  },
  {
    title: "Maps",
    when: "Oct 3",
    outcome: "clean",
    headline: "2 maps fixed",
    ran: ["The geometry address moved from a browser component to src/lib/geo.ts"],
    lessons: ["A constant exported from a browser component reaches the server as a function. The maps fetched a nonsense address and pulsed forever; shared values live in plain modules (the same cause as the tone helper earlier)."],
  },
  {
    title: "Real Question 3 shorts",
    when: "Oct 3",
    outcome: "clean",
    headline: "2 of 2 downloaded",
    ran: ["youtubei.js, Android client, from a home connection"],
    lessons: ["YouTube refuses requests from AWS addresses; the same request from a home connection works.", "ytdl-core fails on YouTube's current player; youtubei.js does not.", "Combined picture-and-sound files come at about 360p: enough for analysis, not for polished playback."],
  },
  {
    title: "Analysis cost",
    when: "Oct 3",
    outcome: "partial",
    headline: "$0.15 a video",
    ran: ["Costs estimated at list prices from each video's length"],
    lessons: ["The shot-and-text detection service was three-quarters of the cost at $0.20 a minute and mostly repeated what Pegasus notes, so the pipeline dropped it. A video now costs about $0.04."],
  },
  {
    title: "Hermes readings",
    when: "Oct 2",
    outcome: "clean",
    headline: "15–16 seconds a reading",
    ran: ["Claude Sonnet on Bedrock, three parallel calls: narrative, evidence, next steps"],
    lessons: ["Nested lists sometimes came back as JSON inside a string; a repair step parses them.", "One long call ran out of output; three parallel calls with word limits fit and finish together."],
  },
  {
    title: "Worker box setup",
    when: "Oct 2",
    outcome: "partial",
    headline: "t4g.large, self-stopping",
    ran: ["pip installs, ffmpeg, the data jobs"],
    lessons: ["Upgrading python-dateutil broke the box's AWS command line; jobs use boto3 directly.", "Two conversions at once ran the box out of memory; it now has swap and runs one at a time."],
  },
]
