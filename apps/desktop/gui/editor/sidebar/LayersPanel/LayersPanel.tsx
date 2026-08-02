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
      <p className="m-3 text-[11px] text-[var(--fg-muted)]">No lanes in this project yet.</p>
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-2">
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
              <ContextMenuTrigger className="block">
                <div
                  className={`flex items-stretch gap-1${selected ? " [&_.lane-btn]:border-[var(--accent,#4a90d9)] [&_.lane-btn]:bg-[var(--bg-hover)]" : ""}`}
                >
                  <button
                    type="button"
                    className="w-[22px] shrink-0 cursor-pointer border-0 bg-transparent text-[var(--fg-muted)]"
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
                      className="min-w-0 flex-1 rounded-md border border-[var(--accent,#4a90d9)] bg-[var(--bg-elevated)] px-2.5 py-2 font-inherit text-[var(--fg-primary)]"
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
                      className="lane-btn flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-0.5 rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2.5 py-2 text-left text-[var(--fg-primary)] hover:bg-[var(--bg-hover)]"
                      title={lane.kind}
                      onClick={() => selectLaneClips(lane.id)}
                      onDoubleClick={() => setEditingLaneId(lane.id)}
                    >
                      <span>{lane.name}</span>
                      <span className="text-[11px] text-[var(--fg-muted)]">
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

                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      className="cursor-pointer rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[10px] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] disabled:cursor-not-allowed disabled:opacity-35"
                      title="Move lane up"
                      disabled={!canMoveUp}
                      onClick={() => moveLane(lane.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="cursor-pointer rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[10px] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] disabled:cursor-not-allowed disabled:opacity-35"
                      title="Move lane down"
                      disabled={!canMoveDown}
                      onClick={() => moveLane(lane.id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="cursor-pointer rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[10px] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] disabled:cursor-not-allowed disabled:opacity-35"
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
                        className="cursor-pointer rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[10px] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] disabled:cursor-not-allowed disabled:opacity-35"
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
                        className="cursor-pointer rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[10px] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] disabled:cursor-not-allowed disabled:opacity-35"
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
              <ul className="mb-1 ml-[26px] flex list-none flex-col gap-0.5 p-0">
                {laneClips.length === 0 ? (
                  <li className="text-[11px] text-[var(--fg-muted)]">No clips</li>
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
                              className={`w-full cursor-pointer rounded border border-transparent bg-transparent px-2 py-1 text-left text-[11px] text-[var(--fg-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]${clipSelected ? " border-[var(--border-strong)] bg-[var(--bg-hover)]" : ""}`}
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
