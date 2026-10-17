"use client"

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"
import { GripVertical } from "lucide-react"

import { setDragEntity } from "@/lib/drag-entity"
import type { RecipeType } from "@/lib/graph-data"
import { cn } from "@/ui/lib/utils"

// The model recipe's four cards: an ingredient (a data source), a step (a process), a model (an
// artifact) and an output (a product surface). Each is 240px wide; its status chip and left
// border share one color, so the diagram reads as progress at a glance. Nothing on it executes.

export type FieldSpec = { key: string; label: string; options?: string[]; long?: boolean }

export const RECIPE_FIELDS: Record<RecipeType, FieldSpec[]> = {
  ingredient: [
    { key: "name", label: "Name" },
    { key: "what", label: "What" },
    { key: "where", label: "Where" },
    { key: "size", label: "Size" },
    { key: "license", label: "License" },
    { key: "status", label: "Status", options: ["hold", "partial", "lack"] },
    { key: "note", label: "Note", long: true },
  ],
  step: [
    { key: "name", label: "Name" },
    { key: "does", label: "Does" },
    { key: "tool", label: "Tool" },
    { key: "cost", label: "Cost" },
    { key: "status", label: "Status", options: ["done", "running", "planned", "blocked"] },
    { key: "owner", label: "Owner", options: ["", "PAX2", "Brendan"] },
    { key: "note", label: "Note", long: true },
  ],
  model: [
    { key: "name", label: "Name" },
    { key: "kind", label: "Kind", options: ["encoder", "reranker", "classifier", "cpc", "ranker", "writer", "other"] },
    { key: "definition", label: "Definition" },
    { key: "trainedOn", label: "Trained on" },
    { key: "status", label: "Status", options: ["exists", "planned"] },
    { key: "metrics", label: "Metrics" },
    { key: "where", label: "Where" },
    { key: "note", label: "Note", long: true },
  ],
  output: [
    { key: "name", label: "Name" },
    { key: "surface", label: "Surface" },
    { key: "status", label: "Status", options: ["live", "planned"] },
    { key: "note", label: "Note", long: true },
  ],
}

export const RECIPE_DEFAULTS: Record<RecipeType, Record<string, string>> = {
  ingredient: { name: "New ingredient", status: "lack" },
  step: { name: "New process", status: "planned" },
  model: { name: "New model", kind: "other", status: "planned" },
  output: { name: "New output", status: "planned" },
}

const GREEN = "#16a34a", AMBER = "#d97706", RED = "#dc2626", BLUE = "#2563eb", SLATE = "#94a3b8"
export const STATUS_COLOR: Record<string, string> = {
  hold: GREEN, partial: AMBER, lack: RED,
  done: GREEN, running: BLUE, planned: SLATE, blocked: RED,
  exists: GREEN, live: GREEN,
}
export const statusColor = (s?: string) => STATUS_COLOR[s ?? ""] ?? SLATE

/** The one line under the name, and the smaller line under that. */
const LINE: Record<RecipeType, [string, string]> = { ingredient: ["what", "where"], step: ["does", "tool"], model: ["definition", "where"], output: ["surface", "note"] }

/** What each card type is called on screen. "step" stays the stored type; it reads as a process. */
export const RECIPE_LABEL: Record<RecipeType, string> = { ingredient: "ingredient", step: "process", model: "model", output: "output" }

export const RECIPE_W = 240
export const RECIPE_H = 108

export type RecipeCardData = { type: RecipeType; id: string; label: string; r?: Record<string, string>; dimmed: boolean } & Record<string, unknown>

const HANDLE = "!h-2 !w-2 !border-0 !bg-slate-300"

export function RecipeNode({ data: d, selected }: NodeProps<Node<RecipeCardData>>) {
  const r = d.r ?? {}
  const color = statusColor(r.status)
  const [main, small] = LINE[d.type]
  return (
    <div
      className={cn("group/card relative rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-e1 transition-opacity", selected && "border-pax2-light-blue ring-1 ring-pax2-light-blue", d.dimmed && "opacity-30")}
      style={{ width: RECIPE_W, minHeight: RECIPE_H - 8, borderLeftWidth: 3, borderLeftColor: color }}
    >
      <Handle type="target" position={Position.Left} className={HANDLE} />
      <Handle type="source" position={Position.Right} className={HANDLE} />
      <span
        draggable
        onDragStart={(e) => { e.stopPropagation(); setDragEntity(e.dataTransfer, d) }}
        className="nodrag absolute right-1 top-1 hidden cursor-grab rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 group-hover/card:block"
        title="Drag into the chat"
      >
        <GripVertical className="h-3 w-3" />
      </span>
      <div className="flex items-center gap-1.5 pr-4">
        <span className="text-[9px] uppercase tracking-wide text-slate-400">{d.type === "model" && r.kind ? `model · ${r.kind}` : RECIPE_LABEL[d.type]}</span>
        {r.status && <span className="ml-auto rounded-full px-1.5 py-px text-[9px] font-semibold text-white" style={{ background: color }}>{r.status}</span>}
      </div>
      <p className="mt-0.5 line-clamp-2 font-semibold leading-snug text-slate-900">{r.name || d.label}</p>
      {r[main] && <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-600">{r[main]}</p>}
      {r[small] && r[small] !== "none" && <p className="mt-0.5 truncate text-[10px] text-slate-400">{r[small]}</p>}
    </div>
  )
}

/** The right panel for a selected recipe card: one control per field, applied live. */
export function RecipeForm({ type, values, onChange, onFocus, onDelete }: {
  type: RecipeType
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  onFocus: () => void
  onDelete: () => void
}) {
  const control = "w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-pax2-light-blue"
  return (
    <div className="space-y-2.5">
      {RECIPE_FIELDS[type].map((f) => (
        <label key={f.key} className="block">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">{f.label}</span>
          {f.options ? (
            <select value={values[f.key] ?? ""} onFocus={onFocus} onChange={(e) => onChange(f.key, e.target.value)} className={cn(control, "mt-0.5 h-8")}>
              {f.options.map((o) => <option key={o} value={o}>{o || "None"}</option>)}
            </select>
          ) : f.long ? (
            <textarea value={values[f.key] ?? ""} onFocus={onFocus} onChange={(e) => onChange(f.key, e.target.value)} rows={4} className={cn(control, "mt-0.5 resize-y py-1.5 leading-snug")} />
          ) : (
            <input value={values[f.key] ?? ""} onFocus={onFocus} onChange={(e) => onChange(f.key, e.target.value)} className={cn(control, "mt-0.5 h-8")} />
          )}
        </label>
      ))}
      <button onClick={onDelete} className="mt-2 h-8 rounded-full border border-red-200 px-3.5 text-xs font-medium text-red-600 transition-colors hover:border-red-600 hover:bg-red-50">Delete</button>
    </div>
  )
}
