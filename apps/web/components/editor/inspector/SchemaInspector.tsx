"use client";

import {
  isMixedValue,
  propertiesByGroup,
  resolvePropertyTargets,
  type PropertyContext,
  type PropertyDefinition,
} from "@motionvideo/editor-core";
import { motionPropertyCapability } from "@motionvideo/motion-protocol";
import type { MotionProject } from "@motionvideo/motion-protocol";
import { AskAIBar } from "@/components/editor/inspector/ai/AskAIBar";
import { Panel, Tabs } from "@/components/ui";
import {
  isPropertyLocked,
  nodeElementKey,
} from "@/lib/editor/authoring/web-project-envelope";
import { useEditorStore } from "@/lib/editor/editor-store";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import { resolvePreviewProject } from "@/lib/editor/preview/preview-project";
import { Diamond, Lock, Unlock } from "lucide-react";
import { useMemo, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Map inspector prop id → Motion track property path. */
const TRACK_PROPERTY_BY_PROP_ID: Record<string, string> = {
  "transform.x": "transform.x",
  "transform.y": "transform.y",
  "transform.rotation": "transform.rotation",
  "transform.scaleX": "transform.scaleX",
  "transform.scaleY": "transform.scaleY",
  "transform.opacity": "transform.opacity",
  "metadata.visible": "transform.visible",
  "style.fill": "style.fill",
  "style.stroke": "style.stroke",
  "style.strokeWidth": "style.strokeWidth",
  "text.content": "payload.text",
  "text.fontSize": "payload.fontSize",
  "text.align": "payload.align",
};

function trackPropertyForProp(propId: string): string | null {
  return TRACK_PROPERTY_BY_PROP_ID[propId] ?? null;
}

function isAnimatableProp(
  propId: string,
  nodeType: string | undefined,
): boolean {
  const track = trackPropertyForProp(propId);
  if (!track) return false;
  return Boolean(
    motionPropertyCapability(nodeType ?? "text", track)?.animatable,
  );
}

function findKeyframeAtTime(
  project: MotionProject,
  sceneId: string,
  nodeId: string,
  property: string,
  t: number,
): boolean {
  const scene = project.scenes.find((s) => s.id === sceneId);
  if (!scene) return false;
  for (const clip of scene.clips) {
    if (clip.targetId !== nodeId || clip.source.kind !== "tracks") continue;
    for (const track of clip.source.tracks) {
      if (track.property !== property) continue;
      if (track.keys.some((key) => Math.abs(key.t - t) < 1e-4)) return true;
    }
  }
  return false;
}

function LockToggle({
  sceneId,
  nodeId,
}: {
  sceneId: string;
  nodeId: string;
}) {
  const envelope = useEditorStore((s) => s.envelope);
  const setElementLocked = useEditorStore((s) => s.setElementLocked);
  const meta = envelope?.authoring.elementMeta[nodeElementKey(sceneId, nodeId)];
  const locked = Boolean(meta?.locked);
  return (
    <button
      type="button"
      data-testid="lock-element"
      className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-[var(--border-strong)] bg-transparent px-2 text-[11px] text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
      onClick={() => setElementLocked(sceneId, nodeId, !locked)}
      title={locked ? "Unlock element" : "Lock element"}
    >
      {locked ? <Lock size={12} /> : <Unlock size={12} />}
      {locked ? "Locked" : "Lock"}
    </button>
  );
}

function KeyframeToggle({
  active,
  disabled,
  onToggle,
}: {
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      data-testid="keyframe-toggle"
      disabled={disabled}
      title={active ? "Xóa keyframe tại playhead" : "Thêm keyframe tại playhead"}
      className={cn(
        "inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-30",
        active
          ? "text-[var(--accent)]"
          : "text-[var(--fg-disabled)] hover:text-[var(--fg-muted)]",
      )}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
    >
      <Diamond
        size={12}
        strokeWidth={active ? 0 : 2}
        fill={active ? "currentColor" : "none"}
      />
    </button>
  );
}

function PropertyControl({
  prop,
  context,
}: {
  prop: PropertyDefinition;
  context: PropertyContext;
}) {
  const dispatch = useEditorStore((s) => s.dispatchPropertyCommand);
  const envelope = useEditorStore((s) => s.envelope);
  const setPropertyLocked = useEditorStore((s) => s.setPropertyLocked);
  const currentTime = usePlaybackClock((s) => s.currentTime);
  const scrubKey = useRef<string | null>(null);
  const raw = prop.read(context);
  const mixed = isMixedValue(raw);
  const target = context.targets[0];
  const locked = target
    ? isPropertyLocked(envelope, target.sceneId, target.nodeId, prop.id)
    : false;

  const nodeType = target
    ? context.project.scenes
        .find((s) => s.id === target.sceneId)
        ?.nodes.find((n) => n.id === target.nodeId)?.type
    : undefined;

  const trackProperty = trackPropertyForProp(prop.id);
  const animatable = isAnimatableProp(prop.id, nodeType);
  const hasKeyframe =
    Boolean(target && trackProperty) &&
    findKeyframeAtTime(
      context.project,
      target!.sceneId,
      target!.nodeId,
      trackProperty!,
      currentTime,
    );

  const commit = (value: unknown, coalesce = false) => {
    if (locked) return;
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

  const toggleKeyframe = () => {
    if (!target || !trackProperty || locked || mixed) return;
    const value = raw;
    if (
      typeof value !== "number" &&
      typeof value !== "string" &&
      typeof value !== "boolean"
    ) {
      return;
    }
    if (hasKeyframe) {
      dispatch({
        type: "delete-property-keyframe",
        targets: context.targets,
        property: trackProperty,
        t: currentTime,
      });
      return;
    }
    dispatch({
      type: "set-property-keyframe",
      targets: context.targets,
      property: trackProperty,
      t: currentTime,
      v: value,
      easing: "easeOut",
    });
  };

  const keyframeBtn =
    animatable && target ? (
      <KeyframeToggle
        active={hasKeyframe}
        disabled={locked || mixed}
        onToggle={toggleKeyframe}
      />
    ) : null;

  const inputClass =
    "h-7 w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-app)] px-2 text-[12px] text-[var(--fg-primary)] outline-none focus:border-[var(--border-focus)] disabled:opacity-40";

  const lockBtn =
    target != null ? (
      <button
        type="button"
        className="cursor-pointer border-0 bg-transparent p-0 text-[var(--fg-muted)] hover:text-[var(--accent-text)]"
        title={locked ? "Unlock property" : "Lock property"}
        onClick={() =>
          setPropertyLocked(target.sceneId, target.nodeId, prop.id, !locked)
        }
      >
        {locked ? <Lock size={11} /> : <Unlock size={11} />}
      </button>
    ) : null;

  const labelRow = (
    <span className="flex shrink-0 items-center gap-1 text-[11px] text-[var(--fg-muted)]">
      {prop.label}
      {lockBtn}
    </span>
  );

  const withKeyframe = (control: ReactNode) => (
    <span className="flex items-center gap-1.5">
      {control}
      {keyframeBtn}
    </span>
  );

  if (prop.editor === "number") {
    const value = mixed ? "" : String(raw as number);
    return (
      <label className="flex items-center justify-between gap-2">
        {labelRow}
        {withKeyframe(
          <input
            type="number"
            className={`${inputClass} max-w-[7rem]`}
            value={value}
            disabled={locked}
            placeholder={mixed ? "Mixed" : undefined}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              commit(n, true);
            }}
            onBlur={() => {
              scrubKey.current = null;
            }}
          />,
        )}
      </label>
    );
  }

  if (prop.editor === "string") {
    const value = mixed ? "" : String(raw ?? "");
    return (
      <label className="flex flex-col gap-1">
        <span className="flex items-center justify-between gap-2">
          {labelRow}
          {keyframeBtn}
        </span>
        <textarea
          className={`${inputClass} min-h-[56px] py-1.5`}
          value={value}
          disabled={locked}
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
        {labelRow}
        {withKeyframe(
          <input
            type="color"
            disabled={locked}
            className="h-7 w-12 cursor-pointer border-0 bg-transparent disabled:opacity-40"
            value={value.startsWith("#") ? value.slice(0, 7) : "#ffffff"}
            onChange={(e) => commit(e.target.value, true)}
            onBlur={() => {
              scrubKey.current = null;
            }}
          />,
        )}
      </label>
    );
  }

  if (prop.editor === "boolean") {
    const checked = mixed ? false : Boolean(raw);
    return (
      <label className="flex items-center justify-between gap-2">
        {labelRow}
        {withKeyframe(
          <input
            type="checkbox"
            checked={checked}
            disabled={locked}
            onChange={(e) => commit(e.target.checked)}
          />,
        )}
      </label>
    );
  }

  if (prop.editor === "enum" && prop.options) {
    const value = mixed ? "" : String(raw ?? "");
    return (
      <label className="flex items-center justify-between gap-2">
        {labelRow}
        {withKeyframe(
          <select
            className={`${inputClass} max-w-[9rem]`}
            value={value}
            disabled={locked}
            onChange={(e) => commit(e.target.value)}
          >
            {mixed ? <option value="">Mixed</option> : null}
            {prop.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>,
        )}
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
    <aside className="min-h-0 border-l-2 border-[var(--border-subtle)] [grid-area:inspector]">
      <Panel bodyClassName="!p-0" className="h-full rounded-none border-0">
        <Tabs
          defaultValue="ai"
          items={[
            {
              id: "ai",
              label: "AI",
              content: <AskAIBar />,
            },
            {
              id: "properties",
              label: "Properties",
              content: (
                <div
                  className="space-y-4 p-3"
                  data-testid="inspector-properties"
                >
                  {selectedNode && selection.kind === "node" ? (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] font-semibold text-[var(--fg-primary)]">
                        {selectedNode.name ?? selectedNode.id}
                        <span className="ml-2 text-[10px] font-normal uppercase text-[var(--fg-muted)]">
                          {selectedNode.type}
                        </span>
                      </p>
                      <LockToggle
                        sceneId={selection.sceneId}
                        nodeId={selection.nodeId}
                      />
                    </div>
                  ) : null}

                  {!context || context.targets.length === 0 ? (
                    <div className="rounded-md border border-dashed border-[var(--border-strong)] px-3 py-4 text-[12px] text-[var(--fg-muted)]">
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
          ]}
        />
      </Panel>
    </aside>
  );
}
