// The production boxes as built, each with its measured runs. Every cost is the one recorded at the
// time, with its date and where it was recorded (a handoff under docs/ or the script's own header);
// "estimate" marks a figure the run log priced in advance and nobody re-measured.

export type Run = { run: string; date: string; did: string; cost: string; source: string; estimate?: boolean }
export type Box = {
  id: string
  name: string
  service: string
  size: string
  rate: string
  script: string
  /** Planned boxes draw dashed and say so. */
  planned?: boolean
  runs: Run[]
}

export const BOXES: Box[] = [
  {
    id: "fleet",
    name: "Proxy fleet",
    service: "EC2 t3.micro × 20, each behind one Webshare static residential IP ($6/month for 20)",
    size: "t3.micro, $0.0104/h",
    rate: "13 s a video through one IP, sleep included (measured 2026-10-19)",
    script: "scripts/catalog-media/fleet.sh",
    runs: [
      { run: "fleet-20261019-090053", date: "2026-10-19", did: "one-box rehearsal, 10 of 10 ids", cost: "about $0.01", source: "docs/LEAD-LOOP.md" },
      { run: "fleet run one", date: "2026-10-19", did: "3,804 of 5,498 pair m4a, 20 boxes self-terminated", cost: "about $0.20", source: "docs/LEAD-LOOP.md" },
      { run: "pairs fleet, morning total", date: "2026-10-19", did: "5,098 of 5,498 mp4 + m4a pairs to catalog-media/", cost: "about $0.30", source: "docs/HANDOFF-2026-10-19-1245.md" },
      { run: "captions fleet 070525", date: "2026-10-20", did: "auto-captions on 11 boxes, about 3 h each", cost: "about $0.35", source: "docs/HANDOFF-2026-10-20-overnight-A.md" },
      { run: "captions retries 102620, 113016", date: "2026-10-20", did: "stopped at the walled-line gate", cost: "about $0.12", source: "docs/HANDOFF-2026-10-20-overnight-A.md" },
    ],
  },
  {
    id: "composition",
    name: "Composition box",
    service: "EC2 c7i, one self-terminating CPU box: ffmpeg and tesseract over every file without a composition record",
    size: "c7i.4xlarge for the full run",
    rate: "5,106 shorts in 4,135 s, 0 errors (measured 2026-10-20)",
    script: "scripts/composition/launch.sh",
    runs: [
      { run: "composition-20261020-070540", date: "2026-10-20", did: "rehearsal, 20 shorts in 81 s on c7i.xlarge", cost: "about $0.01", source: "docs/HANDOFF-2026-10-20-window-c.md" },
      { run: "composition-20261020-070925", date: "2026-10-20", did: "5,106 of 5,106 shorts", cost: "about $0.84", source: "docs/HANDOFF-2026-10-20-window-c.md" },
    ],
  },
  {
    id: "captions",
    name: "Captions path",
    service: "The fleet's captions mode (json3 to catalog-captions/), TranscriptAPI, and Whisper on a GPU box over fetched audio",
    size: "t3.micro fleet · TranscriptAPI monthly plan · g6.xlarge for Whisper",
    rate: "TranscriptAPI: 200 requests a minute, 1 credit per 200; about 90 a minute measured from 8 workers",
    script: "scripts/catalog-media/fleet.sh · scripts/captions/fetch-transcriptapi.mjs · scripts/catalog-audio/whisper.sh",
    runs: [
      { run: "TranscriptAPI", date: "2026-10-19", did: "1,224 transcripts before the plan's credits ran out; the top-up was declined", cost: "the plan's credits", source: "docs/LEAD-LOOP.md" },
      { run: "whisper-20261019-075312", date: "2026-10-19", did: "843 audio files on g6.xlarge", cost: "about $0.95", source: "docs/LEAD-LOOP.md", estimate: true },
    ],
  },
  {
    id: "encoder",
    name: "Encoder retrain box",
    service: "EC2 GPU, fine-tunes the text embedding and rebuilds the index",
    size: "g5.xlarge (no g6e capacity in any zone that night)",
    rate: "about 85 minutes a retrain",
    script: "scripts/encoder/launch.sh",
    runs: [
      { run: "20261020-070703-train", date: "2026-10-20", did: "retrain at the 9,368-transcript corpus", cost: "about $1.43", source: "docs/HANDOFF-2026-10-20-overnight-A.md" },
      { run: "20261020-115427-train", date: "2026-10-20", did: "full-corpus retrain", cost: "about $1.48", source: "docs/HANDOFF-2026-10-20-overnight-A.md" },
    ],
  },
  {
    id: "gpu-q",
    name: "Question box (Q)",
    service: "EC2 spot GPU running Qwen3-VL-4B over each video: every census question in one pass",
    size: "g6e.xlarge class, spot",
    rate: "cost measured on 20 videos before the batch",
    script: "docs/briefs/WINDOW-Q.md",
    planned: true,
    runs: [{ run: "budget", date: "2026-10-22", did: "the whole window", cost: "$5 hard cap", source: "docs/briefs/WINDOW-Q.md" }],
  },
]
