import { MainBlock } from "@/components/blocks"
import { cn } from "@/ui/lib/utils"

// /build's deploy ledger: the Amplify app, the bundle against its cap, the typecheck box (planned),
// and the feed index that ships to S3 instead of the bundle. The bundle figure is the build log's
// BUNDLE line (amplify.yml prints it on every build), stated with the date it was read.

const CAP_MB = 220
const BUNDLE = { mb: 198, asOf: "2026-10-22" }

function Card({ title, planned, children }: { title: string; planned?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border p-4", planned ? "border-dashed border-slate-400 bg-white/50" : "border-slate-200 bg-white")}>
      <div className="flex items-center gap-2">
        <h3 className={cn("text-sm font-semibold", planned ? "text-slate-500" : "text-slate-900")}>{title}</h3>
        {planned && <span className="rounded-full border border-dashed border-slate-400 px-2 py-0.5 text-[11px] font-medium text-slate-500">Planned</span>}
      </div>
      {children}
    </div>
  )
}

function Line({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-slate-500">{k}</span>
      <span className="text-right text-slate-800">{v}</span>
    </div>
  )
}

export function DeployLedger({ shorts }: { shorts: number }) {
  const pct = (BUNDLE.mb / CAP_MB) * 100
  return (
    <MainBlock title="Deploy" height="auto">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Amplify app">
          <Line k="App" v={<span className="font-mono text-xs">pax-2 · d19l6hnxwmfb25</span>} />
          <Line k="Builds" v="on every push to main" />
          <Line k="Runtime" v="Node 22, next build" />
          <Line k="AWS access" v="the compute role; .env.production names the resources" />
        </Card>

        <Card title="Bundle headroom">
          <div className="flex items-baseline justify-between">
            <span className="tabular text-2xl font-semibold text-slate-900">{BUNDLE.mb} MB</span>
            <span className="text-sm text-slate-500">of {CAP_MB} MB</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className={cn("h-full rounded-full", pct > 90 ? "bg-pax2-red-deep" : "bg-pax2-blue")} style={{ width: `${pct}%` }} />
          </div>
          <Line k="Headroom" v={`${CAP_MB - BUNDLE.mb} MB, measured ${BUNDLE.asOf}`} />
          <Line k="Kept out" v="the compiler cache; sharp's binaries; the feed index" />
        </Card>

        <Card title="Typecheck box" planned>
          <Line k="Box" v="a stopped c7i.large, started per push" />
          <Line k="Cost" v="about $2 a month of disk, about 1¢ a check" />
          <Line k="Why" v="the 8 GB Mac cannot typecheck; pushes reach Amplify unchecked" />
          <Line k="Source" v={<span className="font-mono text-xs">docs/briefs/ROADMAP-FETCH-VQA-POLICY.md</span>} />
        </Card>

        <Card title="Feed index on S3">
          <Line k="Object" v={<span className="font-mono text-xs">s3://pax-2-638175140432/app/feed-index.json</span>} />
          <Line k="Shorts" v={shorts.toLocaleString("en-US")} />
          <Line k="Size" v="6.9 MB, outside the bundle" />
          <Line k="Served" v="a first page per render, the rest through /api/feed" />
        </Card>
      </div>
    </MainBlock>
  )
}
