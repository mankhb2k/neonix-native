"use client";

import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical } from "lucide-react";
import { IconActionButton, InspectorSection } from "../controls/InspectorSection";
import type { InspectorCommands } from "../hooks/use-inspector-commands";
import type { InspectorModel } from "../hooks/use-inspector-model";

export function LayerOrder({ model, commands, open, onToggle }: { model: InspectorModel; commands: InspectorCommands; open: boolean; onToggle: () => void }) {
  if (!model.isMultiLayerSelection) return null;
  return (
    <InspectorSection label="Alignment" className="order-1" open={open} onToggle={onToggle}>
      <div className="grid grid-cols-3 gap-1">
        <IconActionButton label="Align left" icon={<AlignStartVertical size={14} />} onClick={() => commands.alignHorizontal("left")} />
        <IconActionButton label="Align center" icon={<AlignCenterVertical size={14} />} onClick={() => commands.alignHorizontal("center")} />
        <IconActionButton label="Align right" icon={<AlignEndVertical size={14} />} onClick={() => commands.alignHorizontal("right")} />
        <IconActionButton label="Align top" icon={<AlignStartHorizontal size={14} />} onClick={() => commands.alignVertical("top")} />
        <IconActionButton label="Align middle" icon={<AlignCenterHorizontal size={14} />} onClick={() => commands.alignVertical("middle")} />
        <IconActionButton label="Align bottom" icon={<AlignEndHorizontal size={14} />} onClick={() => commands.alignVertical("bottom")} />
      </div>
    </InspectorSection>
  );
}
