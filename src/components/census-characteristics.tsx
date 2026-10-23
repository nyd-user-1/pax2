import lift from "../../data/generated/model/vqa-lift.json"
import { CardBlock } from "@/components/blocks"
import { DivergeBar } from "@/components/grow-bar"
import { cn } from "@/ui/lib/utils"

// Visual Characteristics, from the census read off every baseline short's frames (Window Q): each
// characteristic, this short's answer, and the measured lift of the characteristic, in points of shorts
// outperforming 3x their channel median, within channel (data/generated/model/vqa-lift.json). Grey
// where the 90% range crosses zero. Each column's audited accuracy is in its row's hover title.

export type Census = { callToAction: number; ctaSec?: number | null; format: string; setting: string; peopleScreenShare: number; captionsBurnedIn: number; thirdPartyWatermark: number }
type LiftRow = { key: string; label: string; points?: number; low?: number; high?: number; measured?: boolean; videos?: number; channels?: number }

const ROWS = (lift as { rows: LiftRow[] }).rows
const byKey = new Map(ROWS.map((r) => [r.key, r]))
/** Read right out of 100 in Window Q's 100-short audit. */
const ACCURACY: Record<string, number> = { format: 84, setting: 92, captions: 89, cta: 95, person: 81, watermark: 86 }

const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase())
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`

export function CensusCharacteristics({ census }: { census: Census | null }) {
  if (!census)
    return (
      <CardBlock title="Visual Characteristics" height="max">
        <p className="text-sm text-slate-600">No frame census for this video yet.</p>
      </CardBlock>
    )
  const rows = [
    { name: "Format", value: cap(census.format), key: `format:${census.format}`, acc: ACCURACY.format },
    { name: "Setting", value: cap(census.setting), key: `setting:${census.setting}`, acc: ACCURACY.setting },
    { name: "Captions burned in", value: census.captionsBurnedIn ? "Yes" : "No", key: "captionsBurnedIn", acc: ACCURACY.captions },
    { name: "Call to action shown", value: census.callToAction ? (census.ctaSec != null ? `Yes, at ${clock(census.ctaSec)}` : "Yes") : "No", key: "callToAction", acc: ACCURACY.cta },
    { name: "A person in half the frames", value: census.peopleScreenShare >= 0.5 ? "Yes" : "No", key: "personMostFrames", acc: ACCURACY.person },
    { name: "Third-party watermark", value: census.thirdPartyWatermark ? "Yes" : "No", key: "thirdPartyWatermark", acc: ACCURACY.watermark },
  ].map((r) => ({ ...r, lift: byKey.get(r.key) }))
  const reach = Math.max(1, ...rows.map((r) => Math.abs(r.lift?.points ?? 0)))
  return (
    <CardBlock title="Visual Characteristics" height="max">
      <div className="@container flex flex-col gap-3">
        <ul className="flex flex-col divide-y divide-slate-100">
          {rows.map((r, i) => {
            const p = r.lift?.points
            const measured = !!r.lift?.measured
            return (
              <li
                key={r.name}
                className="grid items-center gap-x-4 gap-y-1.5 py-2.5 @md:grid-cols-[minmax(0,1fr)_7rem_minmax(0,9rem)_4.5rem]"
                title={r.lift && p != null ? `${r.lift.label}: 90% range ${r.lift.low} to ${r.lift.high} points, ${r.lift.videos} shorts on ${r.lift.channels} channels. Read right ${r.acc} of 100 in audit.` : `Read right ${r.acc} of 100 in audit.`}
              >
                <span className="text-sm text-slate-700">{r.name}</span>
                <span className="text-sm font-semibold text-slate-900">{r.value}</span>
                {p != null ? <DivergeBar value={p} reach={reach} i={i} measured={measured} /> : <span />}
                <span className={cn("tabular text-right text-sm font-semibold", p == null ? "text-slate-400" : !measured ? "text-slate-500" : p >= 0 ? "text-green-700" : "text-red-700")}>
                  {p == null ? "—" : `${p > 0 ? "+" : ""}${p.toFixed(1)}`}
                </span>
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-slate-500">Points of shorts outperforming 3x their channel median, for shorts with the characteristic against those without, within channel; grey where the 90% range crosses zero.</p>
      </div>
    </CardBlock>
  )
}
