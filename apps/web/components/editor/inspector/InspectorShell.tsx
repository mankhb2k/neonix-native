"use client";

import { useState } from "react";
import { Panel, Tabs } from "@/components/ui";
import { InspectorSection, ReadonlyField } from "./controls/InspectorSection";
import { useInspectorCommands } from "./hooks/use-inspector-commands";
import { useInspectorModel } from "./hooks/use-inspector-model";
import { PropertiesPanel } from "./PropertiesPanel";

function EmptyInspector({ width, height, fps, background }: { width: number; height: number; fps: number; background: string }) {
  return (
    <div className="space-y-3" data-testid="inspector-empty">
      <div className="rounded-md border border-dashed border-[var(--border-strong)] px-3 py-4 text-[12px] text-[var(--fg-muted)]">Select a layer in the sidebar or timeline to view its properties.</div>
      <InspectorSection label="Composition" open onToggle={() => undefined}>
        <ReadonlyField label="Size" value={`${width} × ${height}`} />
        <ReadonlyField label="FPS" value={`${fps}`} />
        <ReadonlyField label="Background" value={background} />
      </InspectorSection>
    </div>
  );
}

export function InspectorShell() {
  const model = useInspectorModel();
  const commands = useInspectorCommands(model);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    timing: true,
    transform: true,
    alignment: true,
    appearance: true,
    compositing: true,
    text: true,
    textLayout: true,
    typography: true,
    decoration: true,
    advanced: false,
    style: true,
    media: true,
    group: true,
    effects: true,
  });
  const toggle = (id: string) => setOpenSections((state) => ({ ...state, [id]: !(state[id] ?? false) }));
  const properties = model.selected || model.selectedAudio ? (
    <PropertiesPanel model={model} commands={commands} openSections={openSections} toggle={toggle} />
  ) : (
    <EmptyInspector width={model.document.composition.width} height={model.document.composition.height} fps={model.document.composition.fps} background={model.document.composition.background} />
  );

  return (
    <aside className="editor-panel overflow-hidden [grid-area:inspector]">
      <Panel bodyClassName="!p-0" className="h-full rounded-none border-0 bg-transparent shadow-none">
        <Tabs
          defaultValue="properties"
          items={[{
            id: "properties",
            label: "Properties",
            content: <div className="h-full w-full overflow-auto p-3">{properties}</div>,
          }]}
        />
      </Panel>
    </aside>
  );
}
