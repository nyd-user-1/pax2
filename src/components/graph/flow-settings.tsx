
"use client"

import { X } from "lucide-react"

// The canvas control panel, ported whole from NSR's FlowSettings: reactflow.dev's props
// playground in PAX2's skin, bound to the live canvas. Every row is a <ReactFlow /> prop (or the
// dataset and layout machinery); hovering a label shows the prop's name and what it does.

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={`rounded-md border border-slate-200 bg-white px-2 outline-none focus:border-pax2-light-blue ${props.className ?? ""}`} />
)

export interface FlowProps {
  colorMode: "light" | "dark" | "system"
  selectionMode: "full" | "partial"
  selectNodesOnDrag: boolean
  elevateNodesOnSelect: boolean
  elevateEdgesOnSelect: boolean
  paneClickDistance: number
  preventScrolling: boolean
  selectionOnDrag: boolean
  panOnDrag: boolean
  panOnScroll: boolean
  panOnScrollSpeed: number
  panOnScrollMode: "free" | "vertical" | "horizontal"
  zoomOnScroll: boolean
  zoomOnPinch: boolean
  zoomOnDoubleClick: boolean
  nodesDraggable: boolean
  nodeDragThreshold: number
  nodesConnectable: boolean
  elementsSelectable: boolean
  autoPanOnConnect: boolean
  autoPanOnNodeDrag: boolean
  autoPanSpeed: number
  minZoom: number
  maxZoom: number
  onlyRenderVisibleElements: boolean
  snapToGrid: boolean
  snapGridX: number
  snapGridY: number
  connectionMode: "strict" | "loose"
  connectionRadius: number
  connectionLineType: "default" | "straight" | "step" | "smoothstep" | "simplebezier"
  connectOnClick: boolean
  nodesFocusable: boolean
  edgesFocusable: boolean
  deleteKeyCode: string
  selectionKeyCode: string
  multiSelectionKeyCode: string
  zoomActivationKeyCode: string
  panActivationKeyCode: string
}

export const DEFAULT_FLOW_PROPS: FlowProps = {
  colorMode: "light",
  selectionMode: "full",
  selectNodesOnDrag: true,
  elevateNodesOnSelect: true,
  elevateEdgesOnSelect: false,
  paneClickDistance: 0,
  preventScrolling: true,
  selectionOnDrag: false,
  panOnDrag: true,
  panOnScroll: false,
  panOnScrollSpeed: 0.5,
  panOnScrollMode: "free",
  zoomOnScroll: true,
  zoomOnPinch: true,
  zoomOnDoubleClick: true,
  nodesDraggable: true,
  nodeDragThreshold: 1,
  nodesConnectable: true,
  elementsSelectable: true,
  autoPanOnConnect: true,
  autoPanOnNodeDrag: true,
  autoPanSpeed: 15,
  minZoom: 0.15,
  maxZoom: 2,
  onlyRenderVisibleElements: false,
  snapToGrid: false,
  snapGridX: 25,
  snapGridY: 25,
  connectionMode: "strict",
  connectionRadius: 20,
  connectionLineType: "default",
  connectOnClick: true,
  nodesFocusable: true,
  edgesFocusable: true,
  deleteKeyCode: "Backspace",
  selectionKeyCode: "Shift",
  multiSelectionKeyCode: "Meta",
  zoomActivationKeyCode: "Meta",
  panActivationKeyCode: "Space",
}

type Row =
  | { key: keyof FlowProps; label: string; kind: "bool"; tip: string }
  | { key: keyof FlowProps; label: string; kind: "number"; tip: string; step?: number }
  | { key: keyof FlowProps; label: string; kind: "text"; tip: string }
  | { key: keyof FlowProps; label: string; kind: "select"; tip: string; options: string[] }

interface Section { title: string; rows: Row[] }

const SECTIONS: Section[] = [
  {
    title: "Appearance",
    rows: [
      { key: "colorMode", label: "Color Mode", kind: "select", options: ["light", "dark", "system"], tip: "colorMode — controls the color scheme of the flow (canvas chrome, controls, edges)." },
    ],
  },
  {
    title: "Selection",
    rows: [
      { key: "selectionMode", label: "Selection Mode", kind: "select", options: ["full", "partial"], tip: "selectionMode — whether a selection box must fully enclose a node ('full') or merely touch it ('partial')." },
      { key: "selectNodesOnDrag", label: "Select Nodes on Drag", kind: "bool", tip: "selectNodesOnDrag — select a node when you start dragging it." },
      { key: "elevateNodesOnSelect", label: "Elevate Nodes on Select", kind: "bool", tip: "elevateNodesOnSelect — raise selected nodes above their neighbors (z-index)." },
      { key: "elevateEdgesOnSelect", label: "Elevate Edges on Select", kind: "bool", tip: "elevateEdgesOnSelect — raise edges of selected nodes above other edges." },
    ],
  },
  {
    title: "Pane interactions",
    rows: [
      { key: "paneClickDistance", label: "Pane Click Distance", kind: "number", tip: "paneClickDistance — max pointer travel (px) for a press still to count as a click." },
      { key: "preventScrolling", label: "Prevent Scrolling", kind: "bool", tip: "preventScrolling — stop page scroll while the cursor is over the canvas." },
      { key: "selectionOnDrag", label: "Selection on Drag", kind: "bool", tip: "selectionOnDrag — drag on the pane draws a selection box instead of panning." },
      { key: "panOnDrag", label: "Pan on Drag", kind: "bool", tip: "panOnDrag — drag the pane to pan the viewport." },
      { key: "panOnScroll", label: "Pan on Scroll", kind: "bool", tip: "panOnScroll — scroll/trackpad pans instead of zooming." },
      { key: "panOnScrollSpeed", label: "Pan on Scroll Speed", kind: "number", step: 0.1, tip: "panOnScrollSpeed — how fast the viewport pans on scroll." },
      { key: "panOnScrollMode", label: "Pan on Scroll Mode", kind: "select", options: ["free", "vertical", "horizontal"], tip: "panOnScrollMode — constrain scroll-panning to an axis, or leave it free." },
      { key: "zoomOnScroll", label: "Zoom on Scroll", kind: "bool", tip: "zoomOnScroll — scroll to zoom the viewport." },
      { key: "zoomOnPinch", label: "Zoom on Pinch", kind: "bool", tip: "zoomOnPinch — pinch gesture zooms on touch devices." },
      { key: "zoomOnDoubleClick", label: "Zoom on Double Click", kind: "bool", tip: "zoomOnDoubleClick — double-click zooms in one step." },
    ],
  },
  {
    title: "Node interaction",
    rows: [
      { key: "nodesDraggable", label: "Nodes Draggable", kind: "bool", tip: "nodesDraggable — whether nodes can be moved at all." },
      { key: "nodeDragThreshold", label: "Node Drag Threshold", kind: "number", tip: "nodeDragThreshold — pointer travel (px) before a node drag starts; small values make clicks easier." },
      { key: "nodesConnectable", label: "Nodes Connectable", kind: "bool", tip: "nodesConnectable — whether handles accept new connections (the canvas takes lines only into prompt steps, or between recipe cards)." },
      { key: "elementsSelectable", label: "Elements Selectable", kind: "bool", tip: "elementsSelectable — whether nodes and edges can be selected at all." },
    ],
  },
  {
    title: "Auto pan",
    rows: [
      { key: "autoPanOnConnect", label: "Auto Pan on Connect", kind: "bool", tip: "autoPanOnConnect — pan the viewport when a connection drag reaches the canvas edge." },
      { key: "autoPanOnNodeDrag", label: "Auto Pan on Node Drag", kind: "bool", tip: "autoPanOnNodeDrag — pan the viewport when dragging a node past the canvas edge." },
      { key: "autoPanSpeed", label: "Auto Pan Speed", kind: "number", tip: "autoPanSpeed — how fast the viewport auto-pans." },
    ],
  },
  {
    title: "Viewport",
    rows: [
      { key: "minZoom", label: "Minimum Zoom", kind: "number", step: 0.05, tip: "minZoom — how far out you can zoom." },
      { key: "maxZoom", label: "Maximum Zoom", kind: "number", step: 0.5, tip: "maxZoom — how far in you can zoom." },
      { key: "onlyRenderVisibleElements", label: "Render Only Visible Elements", kind: "bool", tip: "onlyRenderVisibleElements — virtualize offscreen nodes/edges; helps huge canvases, costs re-render on pan." },
    ],
  },
  {
    title: "Snap grid",
    rows: [
      { key: "snapToGrid", label: "Snap to Grid", kind: "bool", tip: "snapToGrid — dragged nodes land on the grid." },
      { key: "snapGridX", label: "Snap Grid X", kind: "number", tip: "snapGrid[0] — horizontal grid spacing in px." },
      { key: "snapGridY", label: "Snap Grid Y", kind: "number", tip: "snapGrid[1] — vertical grid spacing in px." },
    ],
  },
  {
    title: "Connection",
    rows: [
      { key: "connectionMode", label: "Connection Mode", kind: "select", options: ["strict", "loose"], tip: "connectionMode — 'strict' allows connections only from a source handle to a target handle; 'loose' allows any handle pair." },
      { key: "connectionRadius", label: "Connection Radius", kind: "number", tip: "connectionRadius — px within which a dragged connection snaps to a nearby handle." },
      { key: "connectionLineType", label: "Connection Line Type", kind: "select", options: ["default", "straight", "step", "smoothstep", "simplebezier"], tip: "connectionLineType — the curve drawn while dragging a new connection." },
      { key: "connectOnClick", label: "Connect on Click", kind: "bool", tip: "connectOnClick — click one handle then another to connect, no drag needed." },
    ],
  },
  {
    title: "Focus",
    rows: [
      { key: "nodesFocusable", label: "Nodes Focusable", kind: "bool", tip: "nodesFocusable — allow nodes to receive focus (e.g. via keyboard)." },
      { key: "edgesFocusable", label: "Edges Focusable", kind: "bool", tip: "edgesFocusable — allow edges to receive focus (e.g. via keyboard)." },
    ],
  },
  {
    title: "Keyboard",
    rows: [
      { key: "deleteKeyCode", label: "Delete Key", kind: "text", tip: "deleteKeyCode — key that removes selected elements from the canvas (the records stay in PAX2)." },
      { key: "selectionKeyCode", label: "Selection Key", kind: "text", tip: "selectionKeyCode — hold to draw a selection box." },
      { key: "multiSelectionKeyCode", label: "Multi-Selection Key", kind: "text", tip: "multiSelectionKeyCode — hold to add to the current selection." },
      { key: "zoomActivationKeyCode", label: "Zoom Activation Key", kind: "text", tip: "zoomActivationKeyCode — hold to enable scroll-zoom while it is otherwise off." },
      { key: "panActivationKeyCode", label: "Pan Activation Key", kind: "text", tip: "panActivationKeyCode — hold to pan with the pointer." },
    ],
  },
]

const ROW = "flex items-center justify-between gap-3 py-1"
const LABEL = "text-xs text-slate-500"

function Tip({ tip }: { tip: string }) {
  const [name, ...rest] = tip.split(" — ")
  return (
    <span className="pointer-events-none absolute right-full top-0 z-20 mr-2 hidden w-56 rounded-lg bg-white p-2.5 shadow-e2 ring-1 ring-slate-200 group-hover:block">
      <span className="block font-mono text-[10px] text-slate-500">{name} #</span>
      <span className="mt-1 block text-xs leading-snug text-slate-900">{rest.join(" — ")}</span>
    </span>
  )
}

export function FlowSettingsPanel({
  value, onChange, dataset, onDataset, datasets, layoutMode, onLayoutMode, onClose, onReset,
}: {
  value: FlowProps
  onChange: (p: FlowProps) => void
  dataset: string
  onDataset: (d: string) => void
  datasets: { id: string; label: string }[]
  layoutMode: string
  onLayoutMode: (m: string) => void
  /** Standing alone it carried its own close; inside the graph's sidebar there is nothing to close. */
  onClose?: () => void
  onReset: () => void
}) {
  const set = (key: keyof FlowProps, v: unknown) => onChange({ ...value, [key]: v })
  const SELECT = "h-7 rounded-md border border-slate-200 bg-white px-2 font-mono text-xs text-slate-900"

  return (
    <div className="px-3 pt-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{"<ReactFlow /> Props"}</h2>
        <div className="flex items-center gap-3">
          <button onClick={onReset} className="text-xs text-slate-500 hover:text-pax2-blue">Reset</button>
          {onClose && <button onClick={onClose} className="text-slate-400 hover:text-slate-900" aria-label="Close"><X className="h-4 w-4" /></button>}
        </div>
      </div>

      <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Nodes &amp; Edges</p>
      <div className={ROW}>
        <span className={LABEL}>Dataset</span>
        <select value={dataset} onChange={(e) => onDataset(e.target.value)} className={SELECT}>
          {datasets.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      </div>

      <p className="mb-1 mt-4 text-[10px] uppercase tracking-wide text-slate-400">Layouting algorithms</p>
      <div className={ROW}>
        <span className={LABEL}>Library</span>
        <select value={layoutMode} onChange={(e) => onLayoutMode(e.target.value)} className={SELECT}>
          <option value="none">None</option>
          <option value="dagre-lr">Dagre (LR)</option>
          <option value="dagre-tb">Dagre (TB)</option>
        </select>
      </div>

      {SECTIONS.map((s) => (
        <div key={s.title} className="mt-4">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">{s.title}</p>
          {s.rows.map((r) => (
            <div key={String(r.key)} className={`${ROW} group relative`}>
              <span className={LABEL}>{r.label}</span>
              <Tip tip={r.tip} />
              {r.kind === "bool" && (
                <button
                  onClick={() => set(r.key, !value[r.key])}
                  className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
                    value[r.key] ? "border-pax2-light-blue bg-pax2-light-blue text-white" : "border-slate-300 bg-white"
                  }`}
                  aria-checked={Boolean(value[r.key])}
                  role="checkbox"
                >
                  {Boolean(value[r.key]) && (
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </button>
              )}
              {r.kind === "number" && (
                <Input
                  type="number"
                  step={r.step ?? 1}
                  value={String(value[r.key])}
                  onChange={(e) => set(r.key, Number(e.target.value))}
                  className="h-7 w-20 text-right font-mono text-xs"
                />
              )}
              {r.kind === "text" && (
                <Input
                  value={String(value[r.key])}
                  onChange={(e) => set(r.key, e.target.value)}
                  className="h-7 w-28 text-right font-mono text-xs"
                />
              )}
              {r.kind === "select" && (
                <select value={String(value[r.key])} onChange={(e) => set(r.key, e.target.value)} className={SELECT}>
                  {r.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
