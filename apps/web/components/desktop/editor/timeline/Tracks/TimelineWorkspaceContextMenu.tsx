"use client";

import {
  Copy,
  ClipboardPaste,
  Scissors,
  Trash2,
  SplitSquareHorizontal,
  CopyPlus,
} from "lucide-react";
import {
  useState,
  type ReactNode,
  type RefObject,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui";
import { playheadSplitsClip } from "@/lib/editor/clip-clipboard";
import { useEditorStore } from "@/lib/editor/editor-store";
import { selectedClipIdsFrom } from "@/lib/editor/model/editor-selection";
import { usePlaybackClock } from "@/lib/editor/playback/playback-clock-store";

type WorkspaceMenuProps = {
  children: ReactNode;
  className?: string;
  workspaceRef: RefObject<HTMLDivElement | null>;
  onWorkspacePointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel?: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

/**
 * One context menu for the whole tracks workspace (clip vs empty runway).
 * Không subscribe playback clock khi đóng — canSplit tính lúc open.
 */
export function TimelineWorkspaceContextMenu({
  children,
  className,
  workspaceRef,
  onWorkspacePointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: WorkspaceMenuProps) {
  const [target, setTarget] = useState<"clip" | "empty">("empty");
  const [canSplit, setCanSplit] = useState(false);

  const selectedClipIds = useEditorStore((s) =>
    selectedClipIdsFrom(s.selection),
  );
  const timelineClipboard = useEditorStore((s) => s.timelineClipboard);

  const canPaste = (timelineClipboard?.length ?? 0) > 0;
  const hasSelection = selectedClipIds.length > 0;

  function handleOpen(event: MouseEvent): boolean {
    const el = event.target;
    if (!(el instanceof Element)) return false;
    if (el.closest("button")) return false;

    const store = useEditorStore.getState();
    const clipId = el.closest("[data-clip-id]")?.getAttribute("data-clip-id");
    if (clipId) {
      if (!selectedClipIdsFrom(store.selection).includes(clipId)) {
        store.selectClip(clipId);
      }
      setTarget("clip");
    } else {
      setTarget("empty");
    }

    const time = usePlaybackClock.getState().currentTime;
    const ids = selectedClipIdsFrom(useEditorStore.getState().selection);
    const clips = useEditorStore.getState().timelineClips;
    setCanSplit(
      ids.some((id) => {
        const clip = clips.find((c) => c.id === id);
        return clip ? playheadSplitsClip(clip, time) : false;
      }),
    );
    return true;
  }

  return (
    <ContextMenu>
      <div
        className={className}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <ContextMenuTrigger
          ref={workspaceRef}
          className="flex flex-1 flex-col h-full w-full"
          onOpen={handleOpen}
          onPointerDown={onWorkspacePointerDown}
        >
          {children}
        </ContextMenuTrigger>
      </div>
      <ContextMenuContent className="min-w-[220px]">
        {target === "empty" ? (
          <ContextMenuItem
            leftIcon={<ClipboardPaste size={14} />}
            shortcut="Ctrl+V"
            disabled={!canPaste}
            onSelect={() =>
              useEditorStore
                .getState()
                .pasteClips(usePlaybackClock.getState().currentTime)
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
                useEditorStore
                  .getState()
                  .pasteClips(usePlaybackClock.getState().currentTime)
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
                useEditorStore
                  .getState()
                  .splitSelectedClipsAt(
                    usePlaybackClock.getState().currentTime,
                  )
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
