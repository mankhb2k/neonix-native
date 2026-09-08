"use client";

import { InspectorSection, ReadonlyField } from "../controls/InspectorSection";
import { InspectorSelect } from "../controls/InspectorSelect";
import type { InspectorCommands } from "../hooks/use-inspector-commands";
import type { InspectorModel } from "../hooks/use-inspector-model";

export function ImageProperties({ model, commands, open, onToggle }: { model: InspectorModel; commands: InspectorCommands; open: boolean; onToggle: () => void }) {
  const selected = model.selected?.type === "image" ? model.selected : undefined;
  if (!selected) return null;
  const asset = model.document.assets.find((candidate) => candidate.id === selected.payload.assetId);
  return (
    <InspectorSection label="Media" open={open} onToggle={onToggle}>
      <ReadonlyField label="Asset" value={asset?.uri ?? selected.payload.assetId} />
      <InspectorSelect label="Alignment" value={selected.payload.preserveAspectRatio?.align ?? "xMidYMid"} options={[{ value: "none", label: "None" }, { value: "xMinYMin", label: "Top left" }, { value: "xMidYMid", label: "Center" }, { value: "xMaxYMax", label: "Bottom right" }]} onChange={(value) => commands.patchLayer({ payload: { preserveAspectRatio: { ...selected.payload.preserveAspectRatio, align: value as "none" | "xMinYMin" | "xMidYMid" | "xMaxYMax" } } })} />
      <InspectorSelect label="Aspect mode" value={selected.payload.preserveAspectRatio?.meetOrSlice ?? "meet"} options={[{ value: "meet", label: "Meet" }, { value: "slice", label: "Slice" }]} onChange={(value) => commands.patchLayer({ payload: { preserveAspectRatio: { ...selected.payload.preserveAspectRatio, meetOrSlice: value as "meet" | "slice" } } })} />
    </InspectorSection>
  );
}
