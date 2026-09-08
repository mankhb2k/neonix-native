"use client";

import { ColorField } from "../controls/ColorField";
import { ActionButton, InspectorSection } from "../controls/InspectorSection";
import { NumberField } from "../controls/NumberField";
import type { InspectorCommands } from "../hooks/use-inspector-commands";
import type { InspectorModel } from "../hooks/use-inspector-model";

function numeric(value: unknown, fallback: number) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "value" in value && typeof value.value === "number") return value.value;
  return fallback;
}

export function ShapeProperties({ model, commands, open, onToggle }: { model: InspectorModel; commands: InspectorCommands; open: boolean; onToggle: () => void }) {
  const selected = model.selected?.type === "shape" ? model.selected : undefined;
  if (!selected) return null;
  return (
    <InspectorSection label="Style" open={open} onToggle={onToggle}>
      {typeof selected.style.fill === "string" ? <ColorField label="Fill" value={selected.style.fill} onChange={(value) => commands.patchLayer({ style: { fill: value } })} /> : null}
      {typeof selected.style.stroke === "string" ? <ColorField label="Stroke" value={selected.style.stroke} onChange={(value) => commands.patchLayer({ style: { stroke: value } })} /> : null}
      {selected.style.stroke ? <NumberField label="Stroke width" step={1} integer suffix="px" value={numeric(selected.style.strokeWidth, 1)} onChange={(value) => commands.patchLayer({ style: { strokeWidth: Math.max(0.001, value) } })} /> : null}
      {!selected.style.stroke ? <ActionButton label="Add stroke" onClick={() => commands.patchLayer({ style: { stroke: "#ffffff", strokeWidth: 1 } })} /> : null}
      <NumberField label="Corner radius" step={1} integer suffix="px" value={numeric(selected.payload.cornerRadius, 0)} onChange={(value) => commands.patchLayer({ payload: { cornerRadius: Math.max(0, value) } })} />
    </InspectorSection>
  );
}
