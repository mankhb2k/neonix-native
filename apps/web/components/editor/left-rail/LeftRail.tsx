"use client";

import { Panel, Tabs } from "@/components/ui";

function PlaceholderList({
  title,
  lines,
}: {
  title: string;
  lines: string[];
}) {
  return (
    <div className="space-y-3 p-3">
      <p className="editor-placeholder">
        <strong>{title}</strong>
      </p>
      <ul className="space-y-1.5 text-[12px] text-[var(--fg-muted)]">
        {lines.map((line) => (
          <li key={line} className="rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] px-2.5 py-2">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LeftRail() {
  return (
    <aside className="editor-area-left border-r border-[var(--border-subtle)]">
      <Panel title="Library" bodyClassName="!p-0" className="h-full border-0 rounded-none">
        <Tabs
          defaultValue="scenes"
          items={[
            {
              id: "scenes",
              label: "Scenes",
              content: (
                <PlaceholderList
                  title="Scene list"
                  lines={[
                    "Scene 1 — Hook (stub)",
                    "Scene 2 — Benefit (stub)",
                    "Scene 3 — CTA (stub)",
                  ]}
                />
              ),
            },
            {
              id: "layers",
              label: "Layers",
              content: (
                <PlaceholderList
                  title="Layer tree"
                  lines={[
                    "Chọn element trên stage hoặc tại đây (PR3).",
                    "Selection đồng bộ EditorSelection.",
                  ]}
                />
              ),
            },
            {
              id: "assets",
              label: "Assets",
              content: (
                <PlaceholderList
                  title="Assets"
                  lines={["Upload / library sẽ nối asset pipeline (PR8)."]}
                />
              ),
            },
          ]}
        />
      </Panel>
    </aside>
  );
}
