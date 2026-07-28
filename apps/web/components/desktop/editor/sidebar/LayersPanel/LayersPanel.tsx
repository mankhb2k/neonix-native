"use client";

import { ChevronDown, ChevronUp, Layers, Plus } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor-store";
import { DEFAULT_FRAME_DURATION } from "@/lib/frame-library";
import {
  SidebarPanel,
  SidebarPanelContent,
  SidebarPanelHeader,
} from "../SidebarPanel/SidebarPanel";

export function LayersPanel() {
  const timelineClips = useEditorStore((state) => state.timelineClips);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const selectClip = useEditorStore((state) => state.selectClip);
  const moveClip = useEditorStore((state) => state.moveClip);
  const addClipFromDraft = useEditorStore((state) => state.addClipFromDraft);
  const clips = [...timelineClips].sort((a, b) => {
    if (a.track !== b.track) return a.track === "overlay" ? -1 : 1;
    if (a.track === "overlay") {
      return (b.layerIndex ?? 0) - (a.layerIndex ?? 0) || a.startTime - b.startTime;
    }
    return a.startTime - b.startTime;
  });

  return (
    <SidebarPanel>
      <SidebarPanelHeader>
        <div className="flex min-h-[32px] w-full items-center justify-between gap-2">
          <h3 className="text-title font-semibold text-[var(--fg)]">Lớp</h3>
          <button
            type="button"
            title="Thêm clip main"
            onClick={() => {
              const n =
                timelineClips.filter((c) => c.track === "main").length + 1;
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
          {clips.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-[var(--fg-muted)]">
              Chưa có clip trong timeline.
            </p>
          ) : (
            clips.map((clip) => (
              <div
                key={clip.id}
                role="button"
                tabIndex={0}
                onClick={() => selectClip(clip.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    selectClip(clip.id);
                  }
                }}
                className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left ${
                  selectedClipId === clip.id
                    ? "bg-[var(--accent-soft)] ring-1 ring-white"
                    : "hover:bg-[var(--bg-hover)]"
                }`}
              >
                <Layers size={14} className="shrink-0 text-[var(--fg-muted)]" />
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--fg)]">
                  {clip.name}
                </span>
                <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--fg-muted)]">
                  {clip.track === "overlay"
                    ? `L${(clip.layerIndex ?? 0) + 1}`
                    : "main"}
                </span>
                {clip.track === "overlay" && (
                  <span className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      aria-label="Đưa lớp lên"
                      onClick={(event) => {
                        event.stopPropagation();
                        moveClip(clip.id, {
                          track: "overlay",
                          startTime: clip.startTime,
                          layerIndex: (clip.layerIndex ?? 0) + 1,
                        });
                      }}
                      className="text-[var(--fg-muted)] hover:text-[var(--fg)]"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label="Đưa lớp xuống"
                      disabled={(clip.layerIndex ?? 0) === 0}
                      onClick={(event) => {
                        event.stopPropagation();
                        moveClip(clip.id, {
                          track: "overlay",
                          startTime: clip.startTime,
                          layerIndex: Math.max(0, (clip.layerIndex ?? 0) - 1),
                        });
                      }}
                      className="text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronDown size={13} />
                    </button>
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </SidebarPanelContent>
    </SidebarPanel>
  );
}
