// What the Build dashboard shows beyond data/build.json: where the data comes from, what each page runs on,
// the limits the build works inside, and what each stretch of the build taught. Written by hand from the build.

export type SourceRow = { name: string; publisher: string; kind: string; covers: string; runsOn: string; status: "Loaded" | "Stand-in" | "Not connected" }

export const NOT_CONNECTED: SourceRow[] = [
  { name: "Parallax's Ads Manager export", publisher: "Meta Ads Manager", kind: "Paid results", covers: "The partner's real flights: spend, impressions, plays, watch time, actions", runsOn: "Load Data", status: "Stand-in" },
  { name: "Parallax's videos", publisher: "Parallax", kind: "Video", covers: "The partner's own takes, in place of the synthetic eleven", runsOn: "S3 · worker box", status: "Stand-in" },
  { name: "Meta Ad Library", publisher: "Meta", kind: "Ad libraries", covers: "Every Question 3 ad on Facebook and Instagram", runsOn: "—", status: "Not connected" },
  { name: "Meta Marketing API", publisher: "Meta", kind: "Paid results", covers: "Results pulled directly, without a CSV", runsOn: "—", status: "Not connected" },
  { name: "TikTok Research API", publisher: "TikTok", kind: "Video", covers: "Reform campaigns' TikTok videos and counts", runsOn: "—", status: "Not connected" },
]

export type PageTile = { href: string; name: string; data: string; state: "real" | "stand-in" | "mixed" }

export const PAGES: PageTile[] = [
  { href: "/", name: "Home", data: "Stand-in results and videos", state: "stand-in" },
  { href: "/dashboard", name: "Dashboard", data: "The ledger, sample data where it is empty", state: "mixed" },
  { href: "/videos", name: "Videos", data: "Synthetic videos, stand-in results", state: "stand-in" },
  { href: "/v/listen-stephen", name: "Version page", data: "Stand-in results; real analysis of synthetic videos; PAX readings", state: "mixed" },
  { href: "/scripts", name: "Scripts", data: "Research priors, polls, consensus, 2022 Massachusetts ballots", state: "real" },
  { href: "/record", name: "Record", data: "Working flow; uploads saved, not yet analyzed", state: "mixed" },
  { href: "/evals", name: "Evals", data: "The ledger, sample data where it is empty", state: "mixed" },
  { href: "/campaigns", name: "Campaigns", data: "Public YouTube shorts, Google ad spend, election returns", state: "real" },
  { href: "/scoring", name: "Scoring", data: "The research archives and the reference model", state: "real" },
  { href: "/glossary", name: "Glossary", data: "Definitions", state: "real" },
  { href: "/library", name: "Library", data: "Twelve datasets, previewed from S3", state: "real" },
  { href: "/pipeline", name: "Pipeline", data: "The analysis results and their costs", state: "real" },
]

export type Limit = { label: string; sub: string; used: number; limit: number; unit: string }

export type Lesson = { title: string; when: string; outcome: "clean" | "partial" | "failed"; headline: string; ran: string[]; lessons: string[] }

export const LESSONS: Lesson[] = [
  {
    title: "45-second versions",
    when: "Oct 3",
    outcome: "partial",
    headline: "11 rendered, 11 analyzed",
    ran: ["takes.py: one Polly generative clip per script line, Mixkit footage per line, ffmpeg captions", "analyze.py: Transcribe, Rekognition, Pegasus, measured sound", "scripts/standin.mjs: both rounds rebuilt for the new lengths"],
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
    lessons: ["Rekognition is three-quarters of the cost at $0.20 a minute, and mostly repeats what Pegasus notes. Without it a video costs about $0.04."],
  },
  {
    title: "PAX readings",
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
