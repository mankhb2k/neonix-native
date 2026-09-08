"use client";

import { InspectorSection, ReadonlyField } from "../controls/InspectorSection";
import type { InspectorModel } from "../hooks/use-inspector-model";

export function GroupProperties({ model, open, onToggle }: { model: InspectorModel; open: boolean; onToggle: () => void }) {
  const selected = model.selected?.type === "group" ? model.selected : undefined;
  if (!selected) return null;
  return (
    <InspectorSection label="Group" className="order-9" open={open} onToggle={onToggle}>
      <ReadonlyField label="Parent" value={selected.parentLayerId ?? "Root"} />
      {selected.clipPath ? <ReadonlyField label="clipPath" value={selected.clipPath} /> : null}
      {selected.mask ? <ReadonlyField label="mask" value={selected.mask} /> : null}
    </InspectorSection>
  );
}
