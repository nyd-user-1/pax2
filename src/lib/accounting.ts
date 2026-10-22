// The accounting page's counts and model ledger, as scripts/accounting.mjs last wrote them
// (data/generated/accounting.json, rebuilt with `node scripts/accounting.mjs`). Small enough to import.
import data from "../../data/generated/accounting.json"

export type LedgerRow = { name: string; kind: string; does: string; inputs: string; score: string; last: string }
export type Counts = { all: number; transcript: number; media: number; picked: number; blind: number; composition: number; index: number; lab: number; e2: number }

export const accounting = data as { builtAt: string; counts: Counts; transcriptSources: Record<string, number>; passed: LedgerRow[]; failed: LedgerRow[] }

/** "Oct 22": the date the counts were taken, for every block that shows them. */
export const asOf = () => new Date(accounting.builtAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
