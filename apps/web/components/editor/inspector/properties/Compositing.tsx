"use client";

import { InspectorSection, ActionButton } from "../controls/InspectorSection";
import { InspectorSelect } from "../controls/InspectorSelect";
import type { InspectorCommands } from "../hooks/use-inspector-commands";
import type { InspectorModel } from "../hooks/use-inspector-model";

const BLEND_OPTIONS = ["normal", "darken", "multiply", "color-burn", "lighten", "screen", "color-dodge", "overlay", "soft-light", "hard-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"].map((value) => ({ value, label: value.replaceAll("-", " ").replace(/^./, (letter) => letter.toUpperCase()) }));

export function Compositing({ model, commands, open, onToggle }: { model: InspectorModel; commands: InspectorCommands; open: boolean; onToggle: () => void }) {
  if (!model.selected) return null;
  const canForward = model.document.layers.some((layer) => layer.parentLayerId === model.selected!.parentLayerId && layer.order > model.selected!.order);
  return (
    <InspectorSection label="Compositing" className="order-7" open={open} onToggle={onToggle}>
      <InspectorSelect label="Blend" value={model.selected.composite?.blendMode ?? "normal"} options={BLEND_OPTIONS} onChange={(value) => commands.patchLayer({ composite: { blendMode: value as NonNullable<typeof model.selected.composite>["blendMode"] } })} />
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[11px] text-[var(--fg-muted)]">Stack</span>
        <ActionButton label="Back" onClick={() => commands.moveStack("backward")} disabled={model.selected.order === 0} />
        <ActionButton label="Forward" onClick={() => commands.moveStack("forward")} disabled={!canForward} />
      </div>
    </InspectorSection>
  );
}
