"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Layers, Plus } from "lucide-react";
import { useEditorStore } from "@/lib/editor/editor-store";
import { DEFAULT_FRAME_DURATION } from "@/lib/editor/frame-library";
import {
  SidebarPanel,
  SidebarPanelContent,
  SidebarPanelHeader,
} from "../SidebarPanel/SidebarPanel";

export function LayersPanel() {
  const timelineClips = useEditorStore((state) => state.timelineClips);
  const timelineLanes = useEditorStore((state) => state.timelineLanes);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const selectClip = useEditorStore((state) => state.selectClip);
  const renameLane = useEditorStore((state) => state.renameLane);
  const reorderLane = useEditorStore((state) => state.reorderLane);
  const addClipFromDraft = useEditorStore((state) => state.addClipFromDraft);
  const [expandedLaneIds, setExpandedLaneIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [editingLaneId, setEditingLaneId] = useState<string | null>(null);

  const mainLane = timelineLanes.find(
    (lane) => lane.kind === "visual" && lane.role === "base",
  );
  const overlayLanes = [...timelineLanes]
    .filter((lane) => lane.kind === "visual" && lane.role === "overlay")
    .sort((a, b) => b.order - a.order);
  const orderedLanes = [
    ...overlayLanes,
    ...(mainLane ? [mainLane] : []),
  ];

  const clipsByLane = new Map<string, typeof timelineClips>();
  for (const clip of timelineClips) {
    const list = clipsByLane.get(clip.laneId) ?? [];
    list.push(clip);
    clipsByLane.set(clip.laneId, list);
  }
  for (const list of clipsByLane.values()) {
    list.sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));
  }

  const selectedLaneId = selectedClipId
    ? timelineClips.find((clip) => clip.id === selectedClipId)?.laneId ?? null
    : null;

  function toggleExpand(laneId: string) {
    setExpandedLaneIds((prev) => {
      const next = new Set(prev);
      if (next.has(laneId)) next.delete(laneId);
      else next.add(laneId);
      return next;
    });
  }

  function selectLaneRow(laneId: string) {
    const clips = clipsByLane.get(laneId) ?? [];
    if (clips.length === 0) return;
    const preferred =
      (selectedClipId && clips.find((clip) => clip.id === selectedClipId)) ||
      clips[0];
    selectClip(preferred.id);
  }

  const mainClipCount = mainLane
    ? (clipsByLane.get(mainLane.id)?.length ?? 0)
    : 0;

  return (
    <SidebarPanel>
      <SidebarPanelHeader>
        <div className="flex min-h-[32px] w-full items-center justify-between gap-2">
          <h3 className="text-title font-semibold text-[var(--fg)]">Lớp</h3>
          <button
            type="button"
            title="Thêm clip main"
            onClick={() => {
              const n = mainClipCount + 1;
              addClipFromDraft(
                {
                  id: `draft_${Date.now()}`,
                  name: `Khung ${n}`,
                  duration: DEFAULT_FRAME_DURATION,
                  text: `Khung ${n}`,
                },
                { track: "main" },
              );
            }}
            className="rounded p-1 text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]"
          >
            <Plus size={16} />
          </button>
        </div>
      </SidebarPanelHeader>
      <SidebarPanelContent>
        <div className="flex flex-col gap-1">
          {orderedLanes.length === 0 || timelineClips.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-[var(--fg-muted)]">
              Chưa có clip trong timeline.
            </p>
          ) : (
            orderedLanes.map((lane) => {
              const clips = clipsByLane.get(lane.id) ?? [];
              if (
                clips.length === 0 &&
                lane.kind === "visual" &&
                lane.role === "overlay"
              )
                return null;
              const expandable = clips.length >= 2;
              const expanded = expandable && expandedLaneIds.has(lane.id);
              const laneSelected = selectedLaneId === lane.id;
              const isMain = lane.kind === "visual" && lane.role === "base";

              return (
                <div key={lane.id} className="flex flex-col gap-0.5">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => selectLaneRow(lane.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        selectLaneRow(lane.id);
                      }
                    }}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-2 text-left ${
                      laneSelected
                        ? "bg-[var(--accent-soft)] ring-1 ring-white"
                        : "hover:bg-[var(--bg-hover)]"
                    }`}
                  >
                    {expandable ? (
                      <button
                        type="button"
                        aria-label={expanded ? "Thu gọn" : "Mở rộng"}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleExpand(lane.id);
                        }}
                        className="shrink-0 text-[var(--fg-muted)] hover:text-[var(--fg)]"
                      >
                        {expanded ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                      </button>
                    ) : (
                      <Layers
                        size={14}
                        className="shrink-0 text-[var(--fg-muted)]"
                      />
                    )}

                    {editingLaneId === lane.id ? (
                      <input
                        autoFocus
                        className="min-w-0 flex-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-sm text-[var(--fg)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
                        defaultValue={lane.name}
                        onClick={(event) => event.stopPropagation()}
                        onBlur={(event) => {
                          renameLane(lane.id, event.currentTarget.value.trim() || lane.name);
                          setEditingLaneId(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                          }
                          if (event.key === "Escape") {
                            setEditingLaneId(null);
                          }
                          event.stopPropagation();
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        title="Đổi tên lớp"
                        className="min-w-0 flex-1 truncate text-left text-sm text-[var(--fg)]"
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          setEditingLaneId(lane.id);
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          selectLaneRow(lane.id);
                        }}
                      >
                        {lane.name}
                      </button>
                    )}

                    {clips.length > 1 && (
                      <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--fg-muted)]">
                        {clips.length}
                      </span>
                    )}
                    <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--fg-muted)]">
                      {isMain ? "main" : "overlay"}
                    </span>

                    {!isMain && (
                      <span className="flex shrink-0 flex-col">
                        <button
                          type="button"
                          aria-label="Đưa lớp lên"
                          onClick={(event) => {
                            event.stopPropagation();
                            reorderLane(lane.id, lane.order + 1);
                          }}
                          className="text-[var(--fg-muted)] hover:text-[var(--fg)]"
                        >
                          <ChevronUp size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label="Đưa lớp xuống"
                          disabled={lane.order === 0}
                          onClick={(event) => {
                            event.stopPropagation();
                            reorderLane(lane.id, Math.max(0, lane.order - 1));
                          }}
                          className="text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ChevronDown size={13} />
                        </button>
                      </span>
                    )}
                  </div>

                  {expanded &&
                    clips.map((clip) => (
                      <button
                        key={clip.id}
                        type="button"
                        onClick={() => selectClip(clip.id)}
                        className={`ml-6 flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                          selectedClipId === clip.id
                            ? "bg-[var(--accent-soft)] text-[var(--fg)]"
                            : "text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg)]"
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">{clip.name}</span>
                        <span className="shrink-0 text-[10px]">{clip.duration}s</span>
                      </button>
                    ))}
                </div>
              );
            })
          )}
        </div>
      </SidebarPanelContent>
    </SidebarPanel>
  );
}
