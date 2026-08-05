"use client";

import { Panel, Tabs } from "@/components/ui";
import { resolvePreviewProject } from "@/lib/editor/preview/preview-project";
import { useEditorStore } from "@/lib/editor/editor-store";
import { useMemo } from "react";

export function SchemaInspector() {
  const project = useEditorStore((s) => s.project);
  const selection = useEditorStore((s) => s.selection);
  const preview = useMemo(
    () => (project ? resolvePreviewProject(project) : null),
    [project],
  );

  const selectedNode = useMemo(() => {
    if (!preview || selection.kind !== "node") return null;
    const scene = preview.project.scenes.find(
      (s) => s.id === selection.sceneId,
    );
    return scene?.nodes.find((n) => n.id === selection.nodeId) ?? null;
  }, [preview, selection]);

  return (
    <aside className="editor-area-right border-l border-[var(--border-subtle)]">
      <Panel
        title="Inspector"
        bodyClassName="!p-0"
        className="h-full rounded-none border-0"
      >
        <Tabs
          defaultValue="properties"
          items={[
            {
              id: "properties",
              label: "Properties",
              content: (
                <div className="space-y-3 p-3" data-testid="inspector-properties">
                  {selectedNode ? (
                    <>
                      <p className="text-[12px] font-semibold text-[var(--fg-primary)]">
                        {selectedNode.name ?? selectedNode.id}
                      </p>
                      <dl className="space-y-2 text-[12px] text-[var(--fg-muted)]">
                        <div className="flex justify-between gap-2">
                          <dt>Type</dt>
                          <dd className="text-[var(--fg-secondary)]">
                            {selectedNode.type}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt>Node ID</dt>
                          <dd className="truncate text-[var(--fg-secondary)]">
                            {selectedNode.id}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt>Scene</dt>
                          <dd className="truncate text-[var(--fg-secondary)]">
                            {selection.kind === "node" ? selection.sceneId : "—"}
                          </dd>
                        </div>
                      </dl>
                      <p className="editor-placeholder text-[11px]">
                        Schema-driven controls ở PR5.
                      </p>
                    </>
                  ) : (
                    <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border-strong)] px-3 py-4 text-[12px] text-[var(--fg-muted)]">
                      Chưa có selection — click stage hoặc Layer tree.
                    </div>
                  )}
                </div>
              ),
            },
            {
              id: "motion",
              label: "Motion",
              content: (
                <div className="p-3">
                  <p className="editor-placeholder">
                    Preset, keyframes, easing — sau typed motion commands.
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
