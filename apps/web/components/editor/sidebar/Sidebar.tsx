"use client";

import { Panel, Tabs } from "@/components/ui";
import { useEditorDocument } from "@/hooks/editor/use-editor-store";
import { AssetsPanel } from "./AssetsPanel";
import { LayersPanel } from "./LayersPanel";

export function Sidebar({ projectRef }: { projectRef?: string }) {
  const document = useEditorDocument();

  return (
    <aside className="editor-panel overflow-hidden [grid-area:sidebar]">
      <Panel
        bodyClassName="!p-0"
        className="h-full rounded-none border-0 bg-transparent shadow-none"
      >
        <Tabs
          defaultValue="layers"
          items={[
            {
              id: "layers",
              label: "Layers",
              content: <LayersPanel />,
            },
            {
              id: "assets",
              label: "Assets",
              content: <AssetsPanel projectRef={projectRef} />,
            },
            {
              id: "json",
              label: "JSON",
              content: (
                <pre className="h-full overflow-auto p-3 text-[11px] leading-relaxed text-[var(--fg-secondary)]">
                  {JSON.stringify(document, null, 2)}
                </pre>
              ),
            },
          ]}
        />
      </Panel>
    </aside>
  );
}
