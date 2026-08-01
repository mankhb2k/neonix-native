import { useState } from "react";
import {
  clipAcceptsLane,
  selectionClips,
  type EditorSelection,
  type TimelineClip,
  type TimelineCommand,
  type TimelineLane,
} from "@motionvideo/editor-core";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../../../ui";

type Props = {
  lanes: TimelineLane[];
  clips: TimelineClip[];
  selection: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
  onExecuteTimeline: (command: TimelineCommand, label: string) => void;
};

type LaneFamily = "base" | "overlay" | "audio";

function clipLabel(clip: TimelineClip): string {
  return clip.name || (clip.kind === "scene" ? clip.sceneId : "Audio");
}

function laneFamily(lane: TimelineLane): LaneFamily {
  if (lane.kind === "audio") return "audio";
  if (lane.role === "base") return "base";
  return "overlay";
}

export function LayersPanel({
  lanes,
  clips,
  selection,
  onSelect,
  onExecuteTimeline,
}: Props) {
  const sorted = [...lanes].sort((a, b) => a.order - b.order);
  const [editingLaneId, setEditingLaneId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const selectLaneClips = (laneId: string) => {
    const ids = clips.filter((c) => c.laneId === laneId).map((c) => c.id);
    onSelect(selectionClips(ids));
  };

  const familySiblings = (lane: TimelineLane) => {
    const family = laneFamily(lane);
    if (family === "base") return [lane];
    return sorted.filter((l) => laneFamily(l) === family);
  };

  const canMoveLane = (lane: TimelineLane, direction: -1 | 1) => {
    if (laneFamily(lane) === "base") return false;
    const siblings = familySiblings(lane);
    if (siblings.length < 2) return false;
    const index = siblings.findIndex((l) => l.id === lane.id);
    if (index < 0) return false;
    return index + direction >= 0 && index + direction < siblings.length;
  };

  const moveLane = (laneId: string, direction: -1 | 1) => {
    const lane = sorted.find((l) => l.id === laneId);
    if (!lane || !canMoveLane(lane, direction)) return;
    const siblings = familySiblings(lane);
    const index = siblings.findIndex((l) => l.id === laneId);
    const target = siblings[index + direction];
    if (!target) return;
    onExecuteTimeline(
      { type: "reorder-lane", laneId, newOrder: target.order },
      direction < 0 ? "Move lane up" : "Move lane down",
    );
  };

  const canMoveClipAcrossLane = (
    clip: TimelineClip,
    direction: -1 | 1,
  ): boolean => {
    const index = sorted.findIndex((l) => l.id === clip.laneId);
    if (index < 0) return false;
    const target = sorted[index + direction];
    if (!target) return false;
    return clipAcceptsLane(clip, target);
  };

  const moveClipAcrossLane = (
    clip: TimelineClip,
    direction: -1 | 1,
  ) => {
    if (!canMoveClipAcrossLane(clip, direction)) return;
    const index = sorted.findIndex((l) => l.id === clip.laneId);
    const target = sorted[index + direction];
    if (!target) return;
    const track =
      target.kind === "audio"
        ? "audio"
        : target.kind === "visual" && target.role === "base"
          ? "main"
          : "overlay";
    onExecuteTimeline(
      {
        type: "move-clip",
        clipId: clip.id,
        patch: {
          startTime: clip.startTime,
          laneId: target.id,
          track,
        },
      },
      "Move clip to lane",
    );
  };

  if (sorted.length === 0) {
    return (
      <p className="editor-sidebar__hint">No lanes in this project yet.</p>
    );
  }

  return (
    <ul className="editor-sidebar__layers">
      {sorted.map((lane) => {
        const laneClips = clips
          .filter((c) => c.laneId === lane.id)
          .sort((a, b) => a.startTime - b.startTime);
        const laneClipIds = laneClips.map((c) => c.id);
        const selected =
          selection.kind === "clips" &&
          laneClipIds.length > 0 &&
          laneClipIds.every((id) => selection.ids.includes(id));
        const isExpanded = expanded[lane.id] ?? true;
        const canMoveUp = canMoveLane(lane, -1);
        const canMoveDown = canMoveLane(lane, 1);

        return (
          <li key={lane.id}>
            <ContextMenu>
              <ContextMenuTrigger className="editor-sidebar__lane-ctx">
                <div
                  className={`editor-sidebar__lane-row${selected ? " is-selected" : ""}`}
                >
                  <button
                    type="button"
                    className="editor-sidebar__expand"
                    aria-label={isExpanded ? "Collapse lane" : "Expand lane"}
                    onClick={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [lane.id]: !isExpanded,
                      }))
                    }
                  >
                    {isExpanded ? "▾" : "▸"}
                  </button>

                  {editingLaneId === lane.id ? (
                    <input
                      className="editor-sidebar__lane-rename"
                      ref={(el) => el?.focus()}
                      defaultValue={lane.name}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        const name = e.currentTarget.value.trim() || lane.name;
                        if (name !== lane.name) {
                          onExecuteTimeline(
                            { type: "rename-lane", laneId: lane.id, name },
                            "Rename lane",
                          );
                        }
                        setEditingLaneId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setEditingLaneId(null);
                        e.stopPropagation();
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="editor-sidebar__lane"
                      title={lane.kind}
                      onClick={() => selectLaneClips(lane.id)}
                      onDoubleClick={() => setEditingLaneId(lane.id)}
                    >
                      <span>{lane.name}</span>
                      <span className="editor-sidebar__lane-meta">
                        {lane.kind}
                        {lane.locked ? " · locked" : ""}
                        {lane.kind === "visual" && lane.visible === false
                          ? " · hidden"
                          : ""}
                        {lane.kind === "audio" && lane.muted ? " · muted" : ""}
                        {` · ${laneClips.length}`}
                      </span>
                    </button>
                  )}

                  <div className="editor-sidebar__flags">
                    <button
                      type="button"
                      className="editor-sidebar__flag"
                      title="Move lane up"
                      disabled={!canMoveUp}
                      onClick={() => moveLane(lane.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="editor-sidebar__flag"
                      title="Move lane down"
                      disabled={!canMoveDown}
                      onClick={() => moveLane(lane.id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="editor-sidebar__flag"
                      title="Toggle lock"
                      onClick={() =>
                        onExecuteTimeline(
                          {
                            type: "update-lane-flags",
                            laneId: lane.id,
                            patch: { locked: !lane.locked },
                          },
                          lane.locked ? "Unlock lane" : "Lock lane",
                        )
                      }
                    >
                      {lane.locked ? "Unlock" : "Lock"}
                    </button>

                    {lane.kind === "visual" ? (
                      <button
                        type="button"
                        className="editor-sidebar__flag"
                        title="Toggle visibility"
                        onClick={() =>
                          onExecuteTimeline(
                            {
                              type: "update-lane-flags",
                              laneId: lane.id,
                              patch: { visible: lane.visible === false },
                            },
                            lane.visible === false ? "Show lane" : "Hide lane",
                          )
                        }
                      >
                        {lane.visible === false ? "Show" : "Hide"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="editor-sidebar__flag"
                        title="Toggle mute"
                        onClick={() =>
                          onExecuteTimeline(
                            {
                              type: "update-lane-flags",
                              laneId: lane.id,
                              patch: { muted: !lane.muted },
                            },
                            lane.muted ? "Unmute lane" : "Mute lane",
                          )
                        }
                      >
                        {lane.muted ? "Unmute" : "Mute"}
                      </button>
                    )}
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem
                  onSelect={() => setEditingLaneId(lane.id)}
                >
                  Rename
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => selectLaneClips(lane.id)}
                >
                  Select clips
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => {
                    selectLaneClips(lane.id);
                    onExecuteTimeline(
                      { type: "delete-selected-clips" },
                      "Delete lane clips",
                    );
                  }}
                >
                  Delete clips
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>

            {isExpanded ? (
              <ul className="editor-sidebar__clips">
                {laneClips.length === 0 ? (
                  <li className="editor-sidebar__hint">No clips</li>
                ) : (
                  laneClips.map((clip) => {
                    const clipSelected =
                      selection.kind === "clips" &&
                      selection.ids.includes(clip.id);
                    return (
                      <li key={clip.id}>
                        <ContextMenu>
                          <ContextMenuTrigger>
                            <button
                              type="button"
                              className={`editor-sidebar__clip${clipSelected ? " is-selected" : ""}`}
                              onClick={() => onSelect(selectionClips([clip.id]))}
                            >
                              {clipLabel(clip)}
                            </button>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem
                              onSelect={() =>
                                onSelect(selectionClips([clip.id]))
                              }
                            >
                              Select
                            </ContextMenuItem>
                            <ContextMenuItem
                              disabled={!canMoveClipAcrossLane(clip, -1)}
                              onSelect={() => moveClipAcrossLane(clip, -1)}
                            >
                              Move to lane above
                            </ContextMenuItem>
                            <ContextMenuItem
                              disabled={!canMoveClipAcrossLane(clip, 1)}
                              onSelect={() => moveClipAcrossLane(clip, 1)}
                            >
                              Move to lane below
                            </ContextMenuItem>
                            <ContextMenuItem
                              onSelect={() => {
                                onSelect(selectionClips([clip.id]));
                                onExecuteTimeline(
                                  { type: "delete-selected-clips" },
                                  "Delete clip",
                                );
                              }}
                            >
                              Delete
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      </li>
                    );
                  })
                )}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
