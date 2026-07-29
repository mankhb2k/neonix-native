"use client";

import {
  useState,
  type ReactNode,
  type RefObject,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Copy,
  ClipboardPaste,
  Scissors,
  Trash2,
  SplitSquareHorizontal,
  CopyPlus,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui";
import { useEditorStore } from "@/lib/editor/editor-store";
import { playheadSplitsClip } from "@/lib/editor/clip-clipboard";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";
import { playbackFrameIndex } from "@/lib/editor/playback/time-frame";

type WorkspaceMenuProps = {
  children: ReactNode;
  className?: string;
  workspaceRef: RefObject<HTMLDivElement | null>;
  onWorkspacePointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

/**
 * One context menu for the whole tracks workspace (clip vs empty runway).
 * Avoids per-clip menus stacking open at once.
 */
export function TimelineWorkspaceContextMenu({
  children,
  className,
  workspaceRef,
  onWorkspacePointerDown,
}: WorkspaceMenuProps) {
  const [target, setTarget] = useState<"clip" | "empty">("empty");

  const selectedClipIds = useEditorStore((s) => s.selectedClipIds);
  const timelineClipboard = useEditorStore((s) => s.timelineClipboard);
  const timelineClips = useEditorStore((s) => s.timelineClips);
  const fps = useEditorStore((s) => s.project?.metadata.fps ?? 30);
  // PERF-05: subscribe frame index thay vì raw currentTime.
  const displayFrame = usePlaybackClock((s) =>
    playbackFrameIndex(s.currentTime, fps),
  );
  const currentTime = displayFrame / Math.max(1, fps);

  const canPaste = (timelineClipboard?.length ?? 0) > 0;
  const canSplit = selectedClipIds.some((id) => {
    const clip = timelineClips.find((c) => c.id === id);
    return clip ? playheadSplitsClip(clip, currentTime) : false;
  });
  const hasSelection = selectedClipIds.length > 0;

  function handleOpen(event: MouseEvent): boolean {
    const el = event.target;
    if (!(el instanceof Element)) return false;
    if (el.closest("button")) return false;

    const clipId = el.closest("[data-clip-id]")?.getAttribute("data-clip-id");
    if (clipId) {
      const store = useEditorStore.getState();
      if (!store.selectedClipIds.includes(clipId)) {
        store.selectClip(clipId);
      }
      setTarget("clip");
      return true;
    }

    setTarget("empty");
    return true;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger
        ref={workspaceRef}
        className={className}
        onOpen={handleOpen}
        onPointerDown={onWorkspacePointerDown}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-[220px]">
        {target === "empty" ? (
          <ContextMenuItem
            leftIcon={<ClipboardPaste size={14} />}
            shortcut="Ctrl+V"
            disabled={!canPaste}
            onSelect={() =>
              useEditorStore.getState().pasteClips(usePlaybackClock.getState().currentTime)
            }
          >
            Dán
          </ContextMenuItem>
        ) : (
          <>
            <ContextMenuItem
              leftIcon={<Copy size={14} />}
              shortcut="Ctrl+C"
              disabled={!hasSelection}
              onSelect={() => useEditorStore.getState().copySelectedClips()}
            >
              Sao chép
            </ContextMenuItem>
            <ContextMenuItem
              leftIcon={<Scissors size={14} />}
              shortcut="Ctrl+X"
              disabled={!hasSelection}
              onSelect={() => useEditorStore.getState().cutSelectedClips()}
            >
              Cắt
            </ContextMenuItem>
            <ContextMenuItem
              leftIcon={<ClipboardPaste size={14} />}
              shortcut="Ctrl+V"
              disabled={!canPaste}
              onSelect={() =>
                useEditorStore.getState().pasteClips(usePlaybackClock.getState().currentTime)
              }
            >
              Dán
            </ContextMenuItem>
            <ContextMenuItem
              leftIcon={<Trash2 size={14} />}
              shortcut="Del"
              destructive
              disabled={!hasSelection}
              onSelect={() => useEditorStore.getState().deleteSelectedClips()}
            >
              Xóa
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              leftIcon={<SplitSquareHorizontal size={14} />}
              shortcut="Ctrl+B"
              disabled={!canSplit}
              onSelect={() =>
                useEditorStore.getState().splitSelectedClipsAt(usePlaybackClock.getState().currentTime)
              }
            >
              Tách tại playhead
            </ContextMenuItem>
            <ContextMenuItem
              leftIcon={<CopyPlus size={14} />}
              shortcut="Ctrl+D"
              disabled={!hasSelection}
              onSelect={() =>
                useEditorStore.getState().duplicateSelectedClips()
              }
            >
              Nhân bản
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
