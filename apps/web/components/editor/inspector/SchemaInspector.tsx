"use client";

import { useEditorSurface } from "@/components/editor/EditorSurfaceProvider";
import { Panel, Tabs } from "@/components/ui";
import type { V2LayerPatch } from "@motionvideo/editor-core/v2";
import { useMemo, type ReactNode } from "react";

const inputClass =
  "h-7 w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-site)] px-2 text-[12px] text-[var(--fg-primary)] outline-none focus:border-[var(--border-focus)]";

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-muted)]">
        {label}
      </h3>
      <div className="space-y-2">{children}</div>
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
      <input
        type="text"
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function EmptyInspector() {
  return (
    <div className="rounded-md border border-dashed border-[var(--border-strong)] px-3 py-4 text-[12px] text-[var(--fg-muted)]">
      Chọn một layer trên sidebar hoặc timeline để xem thuộc tính.
    </div>
  );
}

/** Existing V1 inspector shell, migrated in-place to Protocol V2 commands. */
export function SchemaInspector() {
  const {
    document,
    selectedLayerIds,
    applyCommand,
  } = useEditorSurface();
  const selected = useMemo(
    () => document.layers.find((layer) => layer.id === selectedLayerIds[0]),
    [document.layers, selectedLayerIds],
  );

  const patchLayer = (patch: V2LayerPatch) => {
    if (!selected) return;
    applyCommand({ type: "patch-layer", layerId: selected.id, patch });
  };

  const properties = selected ? (
    <div className="space-y-4 p-3" data-testid="inspector-properties">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-[var(--fg-primary)]">
            {selected.id}
          </p>
          <p className="mt-0.5 text-[10px] uppercase text-[var(--fg-muted)]">
            {selected.type} · order {selected.order}
          </p>
        </div>
        <span className="rounded border border-[var(--border-subtle)] px-1.5 py-1 text-[10px] text-[var(--fg-muted)]">
          V2
        </span>
      </div>

      <Group label="Timing">
        <NumberField
          label="Start"
          value={selected.timing.start}
          onChange={(value) => patchLayer({ timing: { start: value } })}
        />
        <NumberField
          label="Duration"
          value={selected.timing.duration}
          onChange={(value) =>
            patchLayer({ timing: { duration: Math.max(0.001, value) } })
          }
        />
        <NumberField
          label="Order"
          step={1}
          value={selected.order}
          onChange={(value) =>
            patchLayer({ order: Math.max(0, Math.round(value)) })
          }
        />
      </Group>

      <Group label="Transform">
        <NumberField
          label="X"
          value={selected.transform.translate.x}
          onChange={(value) =>
            patchLayer({ transform: { translate: { x: value } } })
          }
        />
        <NumberField
          label="Y"
          value={selected.transform.translate.y}
          onChange={(value) =>
            patchLayer({ transform: { translate: { y: value } } })
          }
        />
        <NumberField
          label="Rotation Z"
          value={selected.transform.rotate.z}
          onChange={(value) =>
            patchLayer({ transform: { rotate: { z: value } } })
          }
        />
        <NumberField
          label="Opacity"
          value={selected.opacity}
          step={0.01}
          onChange={(value) =>
            patchLayer({ opacity: Math.max(0, Math.min(1, value)) })
          }
        />
      </Group>

      {selected.type === "text" ? (
        <Group label="Text">
          <TextField
            label="Content"
            value={selected.payload.text}
            onChange={(value) => patchLayer({ payload: { text: value } })}
          />
          <NumberField
            label="Font size"
            value={selected.payload.fontSize}
            onChange={(value) =>
              patchLayer({ payload: { fontSize: Math.max(0.001, value) } })
            }
          />
          <NumberField
            label="Letter spacing"
            value={selected.payload.letterSpacing}
            onChange={(value) => patchLayer({ payload: { letterSpacing: value } })}
          />
        </Group>
      ) : null}

      {selected.type === "shape" ? (
        <Group label="Style">
          {typeof selected.style.fill === "string" ? (
            <label className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-[var(--fg-muted)]">Fill</span>
              <input
                type="color"
                className="h-7 w-12 cursor-pointer border-0 bg-transparent"
                value={selected.style.fill.startsWith("#") ? selected.style.fill : "#ffffff"}
                onChange={(event) =>
                  patchLayer({ style: { fill: event.target.value } })
                }
              />
            </label>
          ) : null}
          <NumberField
            label="Corner radius"
            value={selected.payload.cornerRadius ?? 0}
            onChange={(value) =>
              patchLayer({ payload: { cornerRadius: Math.max(0, value) } })
            }
          />
        </Group>
      ) : null}
    </div>
  ) : (
    <div className="space-y-4 p-3">
      <EmptyInspector />
    </div>
  );

  return (
    <aside className="editor-panel overflow-hidden [grid-area:inspector]">
      <Panel
        bodyClassName="!p-0"
        className="h-full rounded-none border-0 bg-transparent shadow-none"
      >
        <Tabs
          defaultValue="properties"
          items={[
            {
              id: "properties",
              label: "Properties",
              content: properties,
            },
          ]}
        />
      </Panel>
    </aside>
  );
}
