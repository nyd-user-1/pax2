# pax2

## Architecture & Core Surfaces

- **PAX Platform & Score Engine (`src/`):** Next.js 16 application housing the scoring engine (`/scoring`), autoscoring workflows, research library (`/library`), creative evaluations (`/evals`), campaigns (`/campaigns`), breakout outlier tracking (`/outliers`), DynamoDB ledger, and chat interface.
- **Background Worker (`worker/`):** Asynchronous job runner and queue processor for background tasks and ledger operations.
- **Serverless Pipelines (`lambda/`):** AWS Lambda handlers for automated data ingestion, caption processing, and event-driven workflows.
- **Interactive Maps & Graph Canvases:** Geospatial views powered by MapLibre GL (`react-map-gl`) alongside directed node graphs built with React Flow (`@xyflow/react`) and Dagre (`@dagrejs/dagre`).
- **Programmatic Video & Voice (`remotion`):** Client-side video playback and rendering via `@remotion/player` and `@remotion/web-renderer`, integrated with generative video providers (Higgsfield, Kling, Runway, Veo) and voice synthesis (ElevenLabs, Amazon Polly).

## Tech Stack

- **Web & UI:** Next.js 16 (App Router, Turbopack), React 19, TypeScript 5, Tailwind CSS v4, Base UI, shadcn, Lucide Icons, Sonner, Motion, GSAP
- **Editor & Markdown:** ProseMirror (`prosemirror-*`), `react-markdown`, `remark-gfm`, KaTeX
- **Visualization & Maps:** MapLibre GL, `react-map-gl`, React Flow (`@xyflow/react`), Dagre, ECharts, Recharts
- **Video & Audio:** Remotion 4 (`@remotion/player`, `@remotion/web-renderer`), Higgsfield, Kling, Runway, Veo, ElevenLabs, Amazon Polly
- **Cloud, Auth & Email (AWS):** Amplify Hosting (`amplify.yml`), Bedrock Runtime, Cognito (`aws-jwt-verify`), DynamoDB, EC2, EventBridge, Lambda, S3, SESv2, SSM, Resend
- **Data & Tooling:** `youtubei.js`, Zod 4

## Repository Structure

```text
├── .github/workflows/   # CI/CD workflows
├── data/                # Reference datasets, research priors, and baseline records
├── docs/                # Project specs, briefs, and reference documentation
├── lambda/              # AWS Lambda functions and deployment scripts
├── public/              # Static assets (/logos, /visuals, /flags)
├── scripts/             # Data processing, export, and maintenance scripts
├── src/                 # Next.js App Router pages, API routes, score engine, and UI
├── worker/              # Background worker jobs and queue consumers
├── AGENTS.md            # AI agent conventions and UI rules
├── amplify.yml          # AWS Amplify build and deployment configuration
└── next.config.ts       # Next.js configuration, redirects, and bundle exclusions
```

## Getting Started

### Prerequisites

- **Node.js** 22+ and **npm**
- **AWS Credentials** supplied via compute IAM role or local AWS CLI (`us-east-1`) for Bedrock, Cognito, DynamoDB, EC2, EventBridge, Lambda, Polly, S3, SESv2, and SSM

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com
   cd pax2
   ```

2. Install dependencies:
   ```bash
   npm ci
   ```

3. Start the development server (includes the dev-only inspector component):
   ```bash
   npm run dev
   ```

## Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Next.js development server (purges `.next` automatically if cache exceeds 8 GB). |
| `npm run build` | Builds the Next.js production bundle (stubs out `@/components/dev/inspector`). |
| `npm start` | Starts the production Next.js server. |
| `npm run typecheck` | Runs TypeScript type checking (`tsc --noEmit`). |

## Configuration & Deployment Notes

- **AWS Amplify Build Pipeline (`amplify.yml`):**
  - Runs on **Node.js 22** using `npm ci --no-audit --no-fund` with `node_modules/**/*` cached across builds.
  - Injects AWS resource identifiers (`PAX2_REGION`, `PAX2_BUCKET`, `PAX2_LEDGER_TABLE`) and Amplify app environment settings into `.env.production` at build time while relying on the compute IAM role for AWS credentials.
  - Logs `.next/server` and `.next/standalone` bundle sizes on every build and deletes `.next/cache` before packaging `.next/**/*` to stay under Amplify's 220 MB server artifact limit.
- **Bundle Optimizations (`next.config.ts`):** Marks all `@aws-sdk/*` clients as `serverExternalPackages`, sets `images: { unoptimized: true }`, and excludes `sharp` and `@img` from output file tracing.
- **Dev Inspector Stubbing:** In non-development builds, Turbopack aliases `@/components/dev/inspector` to `./src/components/dev/inspector.stub.tsx` so dev tooling never ships in production chunks.
- **Static Asset Caching:** `/logos/*`, `/visuals/*`, and `/flags/*` are served with `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`.
- **Legacy Route Redirects:** `/reviews` → `/evals`, `/campaign` → `/campaigns`, `/method` → `/scoring`, `/reference` → `/scoring?tab=research`, `/sources` → `/library`, and `/break-out` → `/outliers` (308 permanent).
- **Workers & Lambdas:** Deployed independently from `worker/` and `lambda/`.
