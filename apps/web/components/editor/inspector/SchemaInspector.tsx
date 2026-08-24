"use client";

import { useEditorSurface } from "@/components/editor/EditorSurfaceProvider";
import { Panel, Tabs } from "@/components/ui";
import type { V2LayerPatch } from "@motionvideo/editor-core/v2";
import { ChevronDown, Circle, FileText, Image, Music2, PlaySquare, Square } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

const inputClass =
  "h-7 w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-site)] px-2 text-[12px] text-[var(--fg-primary)] outline-none focus:border-[var(--border-focus)]";

type V2Layer = ReturnType<typeof useEditorSurface>["document"]["layers"][number];

function layerIcon(layer: V2Layer) {
  if (layer.type === "text") return FileText;
  if (layer.type === "image") return Image;
  if (layer.type === "video") return PlaySquare;
  if (layer.type === "shape") return layer.payload.shape === "ellipse" ? Circle : Square;
  if (layer.type === "group") return Square;
  return Music2;
}

function layerLabel(layer: V2Layer): string {
  return layer.type === "shape" ? layer.payload.shape : layer.type;
}

function InspectorSection({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-[var(--border-subtle)] last:border-b-0">
      <button
        type="button"
        className="flex min-h-9 w-full items-center justify-between px-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)]"
        aria-expanded={open}
        onClick={onToggle}
      >
        {label}
        <ChevronDown size={13} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open ? <div className="space-y-2 px-3 pb-3">{children}</div> : null}
    </section>
  );
}

function NumberField({
  label,
  value,
  step = 0.01,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-[11px] text-[var(--fg-muted)]">{label}</span>
      <input
        type="number"
        step={step}
        className={`${inputClass} max-w-[7rem]`}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
      />
    </label>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-[11px] text-[var(--fg-muted)]">{label}</span>
      <span className="max-w-[7rem] truncate text-right font-mono text-[11px] text-[var(--fg-secondary)]">{value}</span>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-[var(--fg-muted)]">{label}</span>
      <input type="text" className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function EmptyInspector({
  width,
  height,
  fps,
  background,
}: {
  width: number;
  height: number;
  fps: number;
  background: string;
}) {
  return (
    <div className="space-y-3 p-3" data-testid="inspector-empty">
      <div className="rounded-md border border-dashed border-[var(--border-strong)] px-3 py-4 text-[12px] text-[var(--fg-muted)]">
        Chọn một layer trên sidebar hoặc timeline để xem thuộc tính.
      </div>
      <InspectorSection label="Composition" open onToggle={() => undefined}>
        <ReadonlyField label="Size" value={`${width} × ${height}`} />
        <ReadonlyField label="FPS" value={`${fps}`} />
        <ReadonlyField label="Background" value={background} />
      </InspectorSection>
    </div>
  );
}

function SelectionHeader({ layer }: { layer: V2Layer }) {
  const Icon = layerIcon(layer);
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
        <Icon size={14} strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-[var(--fg-primary)]">{layer.id}</p>
        <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">
          {layerLabel(layer)} · {layer.timing.start.toFixed(2)}–{(layer.timing.start + layer.timing.duration).toFixed(2)}s
        </p>
      </div>
      <span className="rounded border border-[var(--border-subtle)] px-1.5 py-1 text-[10px] text-[var(--fg-muted)]">V2</span>
    </div>
  );
}

/** Inspector shell for Protocol V2; common/type-specific controls remain on the existing surface. */
export function SchemaInspector() {
  const { document, selectedLayerIds, applyCommand, diagnostics } = useEditorSurface();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ timing: true, transform: true, text: true, style: true });
  const selected = useMemo(() => document.layers.find((layer) => layer.id === selectedLayerIds[0]), [document.layers, selectedLayerIds]);

  const patchLayer = (patch: V2LayerPatch) => {
    if (selected) applyCommand({ type: "patch-layer", layerId: selected.id, patch });
  };
  const toggle = (id: string) => setOpenSections((state) => ({ ...state, [id]: !(state[id] ?? false) }));

  const properties = selected ? (
    <div className="min-h-full" data-testid="inspector-properties">
      <SelectionHeader layer={selected} />
      {diagnostics.length > 0 ? (
        <div role="alert" className="border-b border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-[11px] text-[var(--danger)]">
          {diagnostics[0]?.message}
        </div>
      ) : null}
      <InspectorSection label="Timing" open={openSections.timing ?? false} onToggle={() => toggle("timing")}>
        <NumberField label="Start" value={selected.timing.start} onChange={(value) => patchLayer({ timing: { start: Math.max(0, value) } })} />
        <NumberField label="Duration" value={selected.timing.duration} onChange={(value) => patchLayer({ timing: { duration: Math.max(0.001, value) } })} />
        <ReadonlyField label="End" value={(selected.timing.start + selected.timing.duration).toFixed(2)} />
        <ReadonlyField label="Stack" value={`z${selected.order}`} />
      </InspectorSection>

      <InspectorSection label="Transform" open={openSections.transform ?? false} onToggle={() => toggle("transform")}>
        <NumberField label="X" value={selected.transform.translate.x} onChange={(value) => patchLayer({ transform: { translate: { x: value } } })} />
        <NumberField label="Y" value={selected.transform.translate.y} onChange={(value) => patchLayer({ transform: { translate: { y: value } } })} />
        <NumberField label="Width" value={selected.frame.width} onChange={(value) => patchLayer({ frame: { width: Math.max(0.001, value) } })} />
        <NumberField label="Height" value={selected.frame.height} onChange={(value) => patchLayer({ frame: { height: Math.max(0.001, value) } })} />
        <NumberField label="Rotation Z" value={selected.transform.rotate.z} onChange={(value) => patchLayer({ transform: { rotate: { z: value } } })} />
        <NumberField label="Opacity" step={0.01} value={selected.opacity} onChange={(value) => patchLayer({ opacity: Math.max(0, Math.min(1, value)) })} />
      </InspectorSection>

      {selected.type === "text" ? (
        <InspectorSection label="Text" open={openSections.text ?? false} onToggle={() => toggle("text")}>
          <TextField label="Content" value={selected.payload.text} onChange={(value) => patchLayer({ payload: { text: value.normalize("NFC") } })} />
          <NumberField label="Font size" value={selected.payload.fontSize} onChange={(value) => patchLayer({ payload: { fontSize: Math.max(0.001, value) } })} />
          <NumberField label="Letter spacing" value={selected.payload.letterSpacing} onChange={(value) => patchLayer({ payload: { letterSpacing: value } })} />
        </InspectorSection>
      ) : null}

      {selected.type === "shape" ? (
        <InspectorSection label="Style" open={openSections.style ?? false} onToggle={() => toggle("style")}>
          {typeof selected.style.fill === "string" ? (
            <label className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-[var(--fg-muted)]">Fill</span>
              <input type="color" className="h-7 w-12 border-0 bg-transparent" value={selected.style.fill.startsWith("#") ? selected.style.fill : "#ffffff"} onChange={(event) => patchLayer({ style: { fill: event.target.value } })} />
            </label>
          ) : null}
          <NumberField label="Corner radius" value={selected.payload.cornerRadius ?? 0} onChange={(value) => patchLayer({ payload: { cornerRadius: Math.max(0, value) } })} />
        </InspectorSection>
      ) : null}
    </div>
  ) : (
    <EmptyInspector width={document.composition.width} height={document.composition.height} fps={document.composition.fps} background={document.composition.background} />
  );

  return (
    <aside className="editor-panel overflow-hidden [grid-area:inspector]">
      <Panel bodyClassName="!p-0" className="h-full rounded-none border-0 bg-transparent shadow-none">
        <Tabs defaultValue="properties" items={[{ id: "properties", label: "Properties", content: <div className="h-full overflow-auto">{properties}</div> }]} />
      </Panel>
    </aside>
  );
}
