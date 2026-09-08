"use client";

import { InspectorSection, ReadonlyField } from "../controls/InspectorSection";
import { NumberField } from "../controls/NumberField";
import type { InspectorCommands } from "../hooks/use-inspector-commands";
import type { InspectorModel } from "../hooks/use-inspector-model";

export function Timing({ model, commands, open, onToggle }: {
  model: InspectorModel;
  commands: InspectorCommands;
  open: boolean;
  onToggle: () => void;
}) {
  const start = model.commonLayerNumber((layer) => layer.timing.start / 1000);
  const duration = model.commonLayerNumber((layer) => layer.timing.duration / 1000);
  const mixed = model.isMultiLayerSelection && (start.mixed || duration.mixed);
  return (
    <InspectorSection label="Timing" className="order-4" open={open} onToggle={onToggle}>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <NumberField label="Start" value={start.value} mixed={model.isMultiLayerSelection && start.mixed} onChange={(value) => commands.patchSelectedLayers({ timing: { start: Math.max(0, value) * 1000 } })} />
        <NumberField label="Duration" value={duration.value} mixed={model.isMultiLayerSelection && duration.mixed} onChange={(value) => commands.patchSelectedLayers({ timing: { duration: Math.max(0.001, value) * 1000 } })} />
      </div>
      <ReadonlyField label="End" value={mixed ? "Mixed" : (start.value + duration.value).toFixed(2)} />
    </InspectorSection>
  );
}
