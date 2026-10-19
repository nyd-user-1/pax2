/* eslint-disable @next/next/no-img-element */
import { existsSync } from "node:fs"
import { join } from "node:path"

import { CardBlock } from "@/components/blocks"
import { patternsData } from "@/lib/velocity-analytics"

// The tracked catalog's channels, open to everyone. A user's own connected channels live at /my-channels.

export const dynamic = "force-dynamic"
export const metadata = { title: "Channels" }

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n))

export default async function ChannelsPage() {
  const data = await patternsData()
  const channels = data.channels
    .slice()
    .sort((a, b) => (b.subs ?? 0) - (a.subs ?? 0))
    .map((c) => ({ ...c, logo: existsSync(join(process.cwd(), "public", "logos", "channels", `${c.id}.jpg`)) }))
  return (
    <CardBlock title={`Channels (${channels.length})`} height="auto">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {channels.map((c) => (
          <a key={c.id} data-find={c.name} href={`https://youtube.com/channel/${c.id}`} target="_blank" rel="noreferrer" className="lift flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-e2">
            {c.logo ? (
              <img src={`/logos/channels/${c.id}.jpg`} alt="" className="size-10 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-pax2-lavender text-sm font-semibold text-pax2-blue">{c.name.charAt(0)}</span>
            )}
            <span className="min-w-0">
              <span className="block truncate font-medium text-slate-900">{c.name}</span>
              <span className="tabular block text-xs text-slate-500">
                {c.subs != null ? `${compact(c.subs)} subs · ` : ""}{c.n} tracked · {c.pushed} above 3x
              </span>
            </span>
          </a>
        ))}
      </div>
    </CardBlock>
  )
}
