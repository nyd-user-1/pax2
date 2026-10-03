// Every metric and term on screen: the short label used in tables, its full name, and what it means.

export type Term = { id: string; short: string; full: string; definition: string; group: "Score" | "Delivery" | "Engagement" | "Campaigns" }

export const GLOSSARY: Term[] = [
  { id: "resonance", short: "Resonance", full: "Resonance score", group: "Score", definition: "A 0–100 score for how well a paid video earned and kept attention and got people to act, per person reached. 50 is the average of the first round of results. It is built from Engage, Interest and Act, weighted 25%, 40% and 35%." },
  { id: "stop", short: "Engage", full: "Engage rate", group: "Score", definition: "3-second plays divided by impressions: the share of people shown the video whose scroll it stopped." },
  { id: "hold", short: "Interest", full: "Interest rate", group: "Score", definition: "Average watch time divided by the video's length: how much of the video the average viewer watched." },
  { id: "act", short: "Act", full: "Act rate", group: "Score", definition: "Shares, saves and comments divided by 3-second plays: how often viewers did something with the video. Reactions and link clicks are not counted." },
  { id: "counts", short: "Counts", full: "Counts from the record", group: "Score", definition: "The platform numbers each rate is built from, as recorded in the ads export: the part over the whole." },
  { id: "rate", short: "Rate", full: "Observed rate", group: "Score", definition: "The count divided by its base, before any adjustment." },
  { id: "reference-average", short: "Ref. avg", full: "Reference average", group: "Score", definition: "The pooled rate across every scorable video in the first round of results. It is frozen when that round loads, so later rounds are measured against the same yardstick." },
  { id: "weighted-rate", short: "Weighted", full: "Evidence-weighted rate", group: "Score", definition: "(count + k × reference average) ÷ (base + k). A rate built on little evidence is pulled toward the reference average, so a small budget cannot produce an extreme score. k is 2,000 impressions for Engage, 300 viewers for Interest and 800 plays for Act." },
  { id: "distance", short: "Distance", full: "Distance from the reference", group: "Score", definition: "How many reference spreads the weighted rate sits above or below the reference average, measured on the log-odds scale." },
  { id: "component-score", short: "Score", full: "Component score", group: "Score", definition: "The distance turned into 0–100: the share of a normal curve that lies below it. 50 is average; 84 is one spread above." },
  { id: "weight", short: "Weight", full: "Component weight", group: "Score", definition: "How much each component counts toward Resonance: Engage 25%, Interest 40%, Act 35%. A design choice, tested against alternatives on Scoring." },
  { id: "range", short: "Range", full: "Score range", group: "Score", definition: "The span the score is likely to fall in given how much evidence stands behind it: the 10th to 90th percentile of 400 draws consistent with the counts." },
  { id: "limited", short: "Thin data", full: "Limited evidence", group: "Score", definition: "Fewer than 15,000 impressions. The score is shown but its range is wide. Under 1,000 impressions a video is not scored at all." },
  { id: "impressions", short: "Impressions", full: "Impressions", group: "Delivery", definition: "How many times the video was shown in a feed." },
  { id: "reach", short: "Reach", full: "People reached", group: "Delivery", definition: "How many different people saw the video at least once." },
  { id: "frequency", short: "Frequency", full: "Average frequency", group: "Delivery", definition: "Impressions divided by reach: how many times the average person saw it." },
  { id: "spend", short: "Spend", full: "Amount spent", group: "Delivery", definition: "Dollars spent on the flight. A delivery condition, shown beside the score and never inside it." },
  { id: "cpm", short: "CPM", full: "Cost per 1,000 impressions", group: "Delivery", definition: "Spend divided by impressions, times 1,000." },
  { id: "plays3s", short: "3s plays", full: "3-second video plays", group: "Engagement", definition: "Times the video played for at least 3 seconds." },
  { id: "avg-watch", short: "Avg. watch", full: "Average watch time", group: "Engagement", definition: "Seconds the average viewer watched." },
  { id: "thruplays", short: "ThruPlays", full: "ThruPlays", group: "Engagement", definition: "Plays to the end, or to 15 seconds for longer videos (Meta's definition)." },
  { id: "views-per-day", short: "Views/day", full: "Views per day since posting", group: "Campaigns", definition: "Public YouTube views divided by the days since the video was posted. Organic, not paid, and not comparable to Resonance." },
  { id: "median-length", short: "Median length", full: "Median video length", group: "Campaigns", definition: "The middle length across a channel's recent shorts." },
]

export const termById = (id: string) => GLOSSARY.find((t) => t.id === id)
