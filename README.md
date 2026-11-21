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

## Models, Artifacts & Scoring

### Model Artifact Directory Layout

```text
├── encoder/                       # PAX2 Encoder (bge-m3) artifacts & serving index
├── headline/                      # PAX2 Headline Ranker v1 (ONNX) & v0 baseline
├── learning/                      # Online / incremental learning state & updates
├── plum/                          # PLUM contrastive resonance & semantic-ID artifacts
├── video/                         # Video-level feature & composition outputs
├── video-resonance/               # Video resonance scoring artifacts
├── var-model.json                 # PAX2 Classifier v1 (metadata + thumbnail arms)
├── var-model-v2.json              # PAX2 Classifier v2 (metadata + transcript TF-IDF; Gate C failed)
├── var-model-v3.json              # PAX2 Classifier v3 (transcript + 32-dim encoder PCA; served)
├── var-model-v3b.json             # PAX2 Classifier v3b (v3 + composition; Gate C failed)
├── thumb-pca.json                 # 8-component CLIP ViT-B-32 PCA projection for v1 thumbnail arm
├── velocity-model.json            # PAX2 Velocity Classifier (1h, 3h, 6h live Hit prediction)
├── headline-model.json            # PAX2 Headline Ranker v0 logistic fallback
├── headline-v1.json               # PAX2 Headline Ranker v1 metadata & calibration
├── headline-v1-reference.json     # 10,452 held-out Upworthy reference scores for percentile lookup
├── composition-ranker.json        # PAX2 Composition Ranker (23 edit/audio/OCR/title features)
├── composition-ranker-combined.json # Composition Ranker + PAX2 Encoder neighbor metrics
├── pairwise-v0.json               # Bradley-Terry pairwise ranker (all families; Gate P failed)
├── pairwise-v0-reform-votingrights.json # Bradley-Terry pairwise ranker (Reform & Voting Rights; Gate P passed)
├── reference-model.json           # PAX2 Persuasion Reference (146 Swayable studies meta-regression)
├── resonance-formula.json         # Resonance scoring weights & formula parameters
├── memorability-lift.json         # ResMem / visual memorability lift parameters
├── martian-publish-policy.json    # Automated publish-gate & policy rules
├── martian-publish-policy-eval.json # Policy evaluation outputs
├── feed-v0.json                   # Cold-start KuaiRand-1K feed ranker (not served)
├── retention-v0.json              # Cold-start KuaiRand-1K retention regressor (not served)
├── semantic-id-model.json         # PLUM residual k-means (40/64/64) baseline (Gate S failed)
├── predictions-v2.jsonl           # Held-out evaluation predictions (v2)
├── predictions-v3.jsonl           # Held-out evaluation predictions (v3)
├── predictions-v3b.jsonl          # Held-out evaluation predictions (v3b)
└── training-set.manifest.json     # Corpus manifest, label rules & feature definitions
```

### Served Models & Gates

| Model | Base / Architecture | Artifact / Endpoint | Role | Key Benchmark |
| :--- | :--- | :--- | :--- | :--- |
| **PAX2 Resonance Encoder** (Behavior Arm) | `BAAI/bge-m3` (FlagEmbedding InfoNCE + PLUM co-occurrence, $\lambda=0.144$) | `NYSgpt/pax2-resonance-encoder` (`plum/`) | Dense short embeddings (`title` + `description` + `transcript`) | **0.6050** pooled kNN-AUC; **0.5824** Gate B pair ranking |
| **PAX2 Encoder** | `BAAI/bge-m3` (dense fine-tune) | `NYSgpt/pax2-encoder` (`encoder/`, `encoder-map.json`) | Serving index & 32-component PCA features for Classifier `v3` | **0.608** pooled / **0.604** within-channel kNN-AUC |
| **PAX2 Classifier `v3` / `v1`** | L2 Logistic Regression ($\lambda=2.0$) | `var-model-v3.json`, `var-model.json`, `thumb-pca.json` | Pre-publish outlier probability ($\ge 3\times$ channel median); serves `v3` when transcript + embedding exist, else `v1` | `v3`: **0.648** held-out AUC (**2.03x** top-decile lift); `v1`: **0.611** pooled |
| **PAX2 Velocity Classifier** | L2 Logistic Regression ($\lambda=2.0$) | `velocity-model.json`, `velocity-features.json` | Live 72-hour Hit prediction at `1h`, `3h`, and `6h` post-publish | 6h: **0.729** pooled / **0.862** within-channel AUC (**3.7x** lift) |
| **PAX2 Headline Ranker `v1`** | `google-bert/bert-base-uncased` (pairwise linear head) | `model-v1.onnx` (`pax2-headline` Lambda) + `headline-model.json` fallback | Pairwise headline click-rate ranking & Upworthy percentile scoring | **0.672** held-out pairwise accuracy (`v0` fallback: 0.610) |
| **PAX2 Composition Ranker** | Bradley-Terry Logistic ($L2=0.001$) | `composition-ranker.json`, `composition-ranker-combined.json` | Interpretable edit, audio, OCR, and title feature ranking | **0.566** composition-only / **0.595** combined pair accuracy |
| **PAX2 Persuasion Reference** | Random-effects meta-regression | `reference-model.json` | Descriptive ad-trait effect benchmarks from 146 Swayable studies (CC0) | Descriptive reference only (not predictive) |

### Scoring Equations

- **Outlier & Velocity Classifiers:** $p = \sigma\left(\text{intercept} + \sum_f \text{coef}_f \cdot \frac{x_f - \text{mean}_f}{\text{sd}_f}\right)$
- **Pairwise & Composition Rankers:** $\text{score}(\text{short}) = \sum_f w_f \cdot \frac{x_f - \text{mean}_f}{\text{sd}_f}$
