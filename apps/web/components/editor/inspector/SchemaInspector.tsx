"use client";

import {
  isMixedValue,
  propertiesByGroup,
  resolvePropertyTargets,
  type PropertyContext,
  type PropertyDefinition,
} from "@motionvideo/editor-core";
import { Panel, Tabs } from "@/components/ui";
import { useEditorStore } from "@/lib/editor/editor-store";
import { resolvePreviewProject } from "@/lib/editor/preview/preview-project";
import { useMemo, useRef } from "react";

function PropertyControl({
  prop,
  context,
}: {
  prop: PropertyDefinition;
  context: PropertyContext;
}) {
  const dispatch = useEditorStore((s) => s.dispatchPropertyCommand);
  const scrubKey = useRef<string | null>(null);
  const raw = prop.read(context);
  const mixed = isMixedValue(raw);

  const commit = (value: unknown, coalesce = false) => {
    const validated = prop.validate
      ? prop.validate(value as never, context)
      : { ok: true as const, value };
    if (!validated.ok) return;
    if (!coalesce) scrubKey.current = null;
    else if (!scrubKey.current) {
      scrubKey.current = `${prop.id}:${Date.now()}`;
    }
    const command = prop.createCommand(validated.value as never, context);
    dispatch(command, {
      coalesceKey: coalesce ? scrubKey.current ?? undefined : undefined,
    });
  };

  const inputClass =
    "h-7 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-app)] px-2 text-[12px] text-[var(--fg-primary)] outline-none focus:border-[var(--border-focus)]";

  if (prop.editor === "number") {
    const value = mixed ? "" : String(raw as number);
    return (
      <label className="flex items-center justify-between gap-2">
        <span className="shrink-0 text-[11px] text-[var(--fg-muted)]">
          {prop.label}
        </span>
        <input
          type="number"
          className={`${inputClass} max-w-[7rem]`}
          value={value}
          placeholder={mixed ? "Mixed" : undefined}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            commit(n, true);
          }}
          onBlur={() => {
            scrubKey.current = null;
          }}
        />
      </label>
    );
  }

  if (prop.editor === "string") {
    const value = mixed ? "" : String(raw ?? "");
    return (
      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-[var(--fg-muted)]">{prop.label}</span>
        <textarea
          className={`${inputClass} min-h-[56px] py-1.5`}
          value={value}
          placeholder={mixed ? "Mixed" : undefined}
          onChange={(e) => commit(e.target.value, true)}
          onBlur={() => {
            scrubKey.current = null;
          }}
        />
      </label>
    );
  }

  if (prop.editor === "color") {
    const value = mixed ? "#888888" : String(raw ?? "#ffffff");
    return (
      <label className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-[var(--fg-muted)]">{prop.label}</span>
        <input
          type="color"
          className="h-7 w-12 cursor-pointer border-0 bg-transparent"
          value={value.startsWith("#") ? value.slice(0, 7) : "#ffffff"}
          onChange={(e) => commit(e.target.value, true)}
          onBlur={() => {
            scrubKey.current = null;
          }}
        />
      </label>
    );
  }

  if (prop.editor === "boolean") {
    const checked = mixed ? false : Boolean(raw);
    return (
      <label className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-[var(--fg-muted)]">{prop.label}</span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => commit(e.target.checked)}
        />
      </label>
    );
  }

  if (prop.editor === "enum" && prop.options) {
    const value = mixed ? "" : String(raw ?? "");
    return (
      <label className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-[var(--fg-muted)]">{prop.label}</span>
        <select
          className={`${inputClass} max-w-[9rem]`}
          value={value}
          onChange={(e) => commit(e.target.value)}
        >
          {mixed ? <option value="">Mixed</option> : null}
          {prop.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <p className="text-[11px] text-[var(--fg-muted)]">
      {prop.label}: unsupported editor ({prop.editor})
    </p>
  );
}

export function SchemaInspector() {
  const project = useEditorStore((s) => s.project);
  const selection = useEditorStore((s) => s.selection);
  const clips = useEditorStore((s) => s.timelineClips);
  const lanes = useEditorStore((s) => s.timelineLanes);

  const preview = useMemo(
    () => (project ? resolvePreviewProject(project) : null),
    [project],
  );
  const activeProject = preview?.project ?? null;

  const context: PropertyContext | null = useMemo(() => {
    if (!activeProject) return null;
    const targets = resolvePropertyTargets(
      selection,
      activeProject,
      clips,
      lanes,
    );
    return {
      project: activeProject,
      clips,
      lanes,
      selection,
      targets,
    };
  }, [activeProject, selection, clips, lanes]);

  const groups = useMemo(() => {
    if (!context || context.targets.length === 0) return [];
    return [...propertiesByGroup(context).entries()];
  }, [context]);

  const selectedNode = useMemo(() => {
    if (!activeProject || selection.kind !== "node") return null;
    const scene = activeProject.scenes.find((s) => s.id === selection.sceneId);
    return scene?.nodes.find((n) => n.id === selection.nodeId) ?? null;
  }, [activeProject, selection]);

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
                <div
                  className="space-y-4 p-3"
                  data-testid="inspector-properties"
                >
                  {selectedNode ? (
                    <p className="text-[12px] font-semibold text-[var(--fg-primary)]">
                      {selectedNode.name ?? selectedNode.id}
                      <span className="ml-2 text-[10px] font-normal uppercase text-[var(--fg-muted)]">
                        {selectedNode.type}
                      </span>
                    </p>
                  ) : null}

                  {!context || context.targets.length === 0 ? (
                    <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border-strong)] px-3 py-4 text-[12px] text-[var(--fg-muted)]">
                      Chưa có selection — click stage hoặc Layer tree.
                    </div>
                  ) : (
                    groups.map(([group, props]) => (
                      <section key={group} className="space-y-2">
                        <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-muted)]">
                          {group}
                        </h3>
                        <div className="space-y-2">
                          {props.map((prop) => (
                            <PropertyControl
                              key={prop.id}
                              prop={prop}
                              context={context}
                            />
                          ))}
                        </div>
                      </section>
                    ))
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
                    Motion presets / keyframes — mở rộng registry sau.
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
                    Refine scoped theo selection (PR7).
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
