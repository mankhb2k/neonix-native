import {
  propertiesByGroup,
  resolvePropertyTargets,
  selectionClips,
  selectionNode,
  selectionNone,
  type DocumentPropertyCommand,
  type EditorSelection,
  type PropertyDefinition,
  type TimelineClip,
  type TimelineLane,
  type Vector2,
} from "@motionvideo/editor-core";
import { BooleanPropertyEditor } from "./property-editors/BooleanPropertyEditor";
import { ColorPropertyEditor } from "./property-editors/ColorPropertyEditor";
import { EnumPropertyEditor } from "./property-editors/EnumPropertyEditor";
import { NumberPropertyEditor } from "./property-editors/NumberPropertyEditor";
import { StringPropertyEditor } from "./property-editors/StringPropertyEditor";
import { VectorPropertyEditor } from "./property-editors/VectorPropertyEditor";
import type { MotionProject } from "@motionvideo/motion-protocol";
import "./inspector.css";

type Props = {
  project: MotionProject | null;
  clips: TimelineClip[];
  lanes: TimelineLane[];
  selection: EditorSelection;
  disabled?: boolean;
  onSelect: (selection: EditorSelection) => void;
  onExecute: (input: {
    command: DocumentPropertyCommand;
    label: string;
    coalesceKey?: string;
    entryId?: string;
  }) => void;
};

function selectionFingerprint(selection: EditorSelection): string {
  if (selection.kind === "none") return "none";
  if (selection.kind === "node") {
    return `node:${selection.sceneId}:${selection.layerId}`;
  }
  return `clips:${selection.ids.slice().sort().join(",")}`;
}

export function InspectorPanel({
  project,
  clips,
  lanes,
  selection,
  disabled,
  onSelect,
  onExecute,
}: Props) {
  const sceneClips = clips.filter((c) => c.kind === "scene");
  const targets = project
    ? resolvePropertyTargets(selection, project, clips, lanes)
    : [];
  const context =
    project && targets.length > 0
      ? { project, clips, lanes, selection, targets }
      : null;
  const groups: Map<string, PropertyDefinition[]> = context
    ? propertiesByGroup(context)
    : new Map();

  const selectedSceneId =
    selection.kind === "node"
      ? selection.sceneId
      : selection.kind === "clips"
        ? sceneClips.find((c) => c.id === selection.primaryId)?.sceneId ?? null
        : null;
  const sceneLayers =
    project && selectedSceneId
      ? (project.scenes.find((s) => s.id === selectedSceneId)?.layers ?? [])
      : [];

  function toggleClip(clipId: string, additive: boolean) {
    if (!additive) {
      onSelect(selectionClips([clipId]));
      return;
    }
    if (selection.kind !== "clips") {
      onSelect(selectionClips([clipId]));
      return;
    }
    const set = new Set(selection.ids);
    if (set.has(clipId)) set.delete(clipId);
    else set.add(clipId);
    onSelect(selectionClips([...set], clipId));
  }

  function commitProperty(
    prop: PropertyDefinition,
    raw: unknown,
    coalesce?: boolean,
    entryId?: string,
  ) {
    if (!context) return;
    const validated = prop.validate
      ? prop.validate(raw as never, context)
      : { ok: true as const, value: raw };
    if (!validated.ok) return;
    const command = prop.createCommand(validated.value as never, context);
    onExecute({
      command,
      label: prop.id,
      coalesceKey: coalesce
        ? `scrub:${prop.id}:${selectionFingerprint(selection)}`
        : undefined,
      entryId,
    });
  }

  return (
    <aside className="inspector-panel" aria-label="Inspector">
      <div className="inspector-panel__header">
        <h2 className="inspector-panel__title">Inspector</h2>
        {selection.kind !== "none" ? (
          <button
            type="button"
            className="btn"
            disabled={disabled}
            onClick={() => onSelect(selectionNone())}
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="inspector-panel__section">
        <h3 className="inspector-panel__group">Clips</h3>
        {sceneClips.length === 0 ? (
          <p className="inspector-panel__hint">No scene clips.</p>
        ) : (
          <ul className="inspector-panel__list">
            {sceneClips.map((clip) => {
              const active =
                selection.kind === "clips" && selection.ids.includes(clip.id);
              return (
                <li key={clip.id}>
                  <button
                    type="button"
                    className={`inspector-panel__chip${active ? " is-active" : ""}`}
                    disabled={disabled}
                    onClick={(e) =>
                      toggleClip(clip.id, e.metaKey || e.ctrlKey)
                    }
                  >
                    {clip.name || clip.id}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {sceneLayers.length > 0 ? (
        <div className="inspector-panel__section">
          <h3 className="inspector-panel__group">Nodes</h3>
          <ul className="inspector-panel__list">
            {sceneLayers.map((node) => {
              const active =
                selection.kind === "node" && selection.layerId === node.id;
              return (
                <li key={node.id}>
                  <button
                    type="button"
                    className={`inspector-panel__chip${active ? " is-active" : ""}`}
                    disabled={disabled || !selectedSceneId}
                    onClick={() =>
                      selectedSceneId &&
                      onSelect(selectionNode(selectedSceneId, node.id))
                    }
                  >
                    {node.name || node.id}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {!context ? (
        <p className="inspector-panel__hint">
          Select a scene clip to edit transform and metadata.
        </p>
      ) : (
        [...groups.entries()].map(([group, props]) => (
          <div key={group} className="inspector-panel__section">
            <h3 className="inspector-panel__group">{group}</h3>
            <div className="inspector-panel__fields">
              {props.map((prop) => {
                const value = prop.read(context);
                if (prop.editor === "number") {
                  return (
                    <NumberPropertyEditor
                      key={prop.id}
                      label={prop.label}
                      value={value as number}
                      disabled={disabled}
                      step={prop.id.includes("opacity") ? 0.01 : 1}
                      onPreview={(n, gestureId) =>
                        commitProperty(prop, n, true, gestureId)
                      }
                      onCommit={(n, gestureId) =>
                        commitProperty(prop, n, true, gestureId)
                      }
                    />
                  );
                }
                if (prop.editor === "boolean") {
                  return (
                    <BooleanPropertyEditor
                      key={prop.id}
                      label={prop.label}
                      value={value as boolean}
                      disabled={disabled}
                      onCommit={(v) => commitProperty(prop, v, false)}
                    />
                  );
                }
                if (prop.editor === "color") {
                  return (
                    <ColorPropertyEditor
                      key={prop.id}
                      label={prop.label}
                      value={value as string}
                      disabled={disabled}
                      onCommit={(v) => commitProperty(prop, v, false)}
                    />
                  );
                }
                if (prop.editor === "enum") {
                  return (
                    <EnumPropertyEditor
                      key={prop.id}
                      label={prop.label}
                      value={value as string}
                      options={prop.options ?? []}
                      disabled={disabled}
                      onCommit={(v) => commitProperty(prop, v, false)}
                    />
                  );
                }
                if (prop.editor === "vector") {
                  return (
                    <VectorPropertyEditor
                      key={prop.id}
                      label={prop.label}
                      value={value as Vector2}
                      disabled={disabled}
                      onCommit={(v) => commitProperty(prop, v, false)}
                    />
                  );
                }
                return (
                  <StringPropertyEditor
                    key={prop.id}
                    label={prop.label}
                    value={value as string}
                    disabled={disabled}
                    onCommit={(v) => commitProperty(prop, v, false)}
                  />
                );
              })}
            </div>
          </div>
        ))
      )}
    </aside>
  );
}
