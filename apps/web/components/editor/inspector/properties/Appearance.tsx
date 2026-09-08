"use client";

import { InspectorSection } from "../controls/InspectorSection";
import { RangeField } from "../controls/NumberField";
import type { InspectorCommands } from "../hooks/use-inspector-commands";
import type { InspectorModel } from "../hooks/use-inspector-model";

export function Appearance({ model, commands, open, onToggle }: { model: InspectorModel; commands: InspectorCommands; open: boolean; onToggle: () => void }) {
  const opacity = model.commonLayerNumber((layer) => layer.opacity);
  return (
    <InspectorSection label="Appearance" className="order-5" open={open} onToggle={onToggle}>
      <RangeField label="Opacity" value={opacity.value} mixed={model.isMultiLayerSelection && opacity.mixed} keyframed={commands.isKeyframedAtCurrentTime("opacity")} keyframeDisabled={!model.isPlayheadInsideLayer} onKeyframe={!model.isMultiLayerSelection ? () => commands.setKeyframeAtCurrentTime("opacity", { type: "number", value: opacity.value }) : undefined} onChange={(value, gestureId) => commands.patchLayerCoalesced("opacity", gestureId, { opacity: Math.max(0, Math.min(1, value)) })} />
    </InspectorSection>
  );
}
