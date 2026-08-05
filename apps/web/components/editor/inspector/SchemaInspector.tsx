"use client";

import { Panel, Tabs } from "@/components/ui";

export function SchemaInspector() {
  return (
    <aside className="editor-area-right border-l border-[var(--border-subtle)]">
      <Panel title="Inspector" bodyClassName="!p-0" className="h-full border-0 rounded-none">
        <Tabs
          defaultValue="properties"
          items={[
            {
              id: "properties",
              label: "Properties",
              content: (
                <div className="space-y-3 p-3">
                  <p className="editor-placeholder">
                    Schema-driven controls theo capability metadata (PR5).
                  </p>
                  <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border-strong)] px-3 py-4 text-[12px] text-[var(--fg-muted)]">
                    Chưa có selection — click stage hoặc Layer tree.
                  </div>
                </div>
              ),
            },
            {
              id: "motion",
              label: "Motion",
              content: (
                <div className="p-3">
                  <p className="editor-placeholder">
                    Preset, keyframes, easing — sau khi có typed motion commands.
                  </p>
                </div>
              ),
            },
            {
              id: "ai",
              label: "AI",
              content: (
                <div className="p-3">
                  <p className="editor-placeholder">
                    Refine scoped theo selection; tôn trọng locks (PR6–PR7).
                  </p>
                </div>
              ),
            },
          ]}
        />
      </Panel>
    </aside>
  );
}
