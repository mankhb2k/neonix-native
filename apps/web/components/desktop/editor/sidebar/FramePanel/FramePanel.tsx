"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor-store";
import {
  addFrame,
  FRAME_LIBRARY_MIME,
  listFrames,
  removeFrame,
  type FrameDraft,
} from "@/lib/frame-library";
import { MediaItem } from "../MediaItem/MediaItem";
import {
  SidebarPanel,
  SidebarPanelHeader,
  SidebarPanelContent,
} from "../SidebarPanel/SidebarPanel";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui";

export function FramePanel() {
  const project = useEditorStore((s) => s.project);
  const projectId = project?.metadata.id;
  const [frames, setFrames] = useState<FrameDraft[]>([]);

  const refresh = useCallback(() => {
    if (!projectId) {
      setFrames([]);
      return;
    }
    setFrames(listFrames(projectId));
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleAdd() {
    if (!projectId) return;
    addFrame(projectId);
    refresh();
  }

  function handleRemove(frameId: string) {
    if (!projectId) return;
    removeFrame(projectId, frameId);
    refresh();
  }

  return (
    <SidebarPanel>
      <SidebarPanelHeader>Khung hình</SidebarPanelHeader>
      <SidebarPanelContent>
        <div className="grid grid-cols-[repeat(auto-fill,128px)] gap-3 justify-start min-w-0">
          {frames.map((frame) => (
            <ContextMenu key={frame.id}>
              <ContextMenuTrigger className="w-[128px]">
                <div
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(FRAME_LIBRARY_MIME, frame.id);
                    event.dataTransfer.setData(
                      "application/json",
                      JSON.stringify({
                        id: frame.id,
                        type: "frame",
                        name: frame.name,
                        duration: frame.duration ?? 5,
                      }),
                    );
                    event.dataTransfer.setData("text/plain", frame.id);
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <MediaItem
                    title={frame.name}
                    duration={`${frame.duration}s`}
                  />
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem
                  leftIcon={<Trash2 size={14} />}
                  destructive
                  onSelect={() => handleRemove(frame.id)}
                >
                  Xóa khỏi thư viện
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem disabled>
                  Kéo vào timeline để dùng
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}

          <button
            type="button"
            onClick={handleAdd}
            className="flex flex-col gap-1 w-[128px] shrink-0 cursor-pointer border-0 bg-transparent p-0 text-left select-none"
          >
            <div className="relative w-[128px] h-[84px] rounded-lg border-2 border-dashed border-[var(--border-strong)] flex flex-col items-center justify-center gap-1.5 text-[var(--fg-muted)] hover:border-[var(--fg-muted)] hover:text-[var(--fg-primary)] transition-colors">
              <Plus size={22} strokeWidth={1.5} />
              <span className="text-[11px] font-medium">Thêm khung hình</span>
            </div>
            <div className="text-[11.5px] font-medium text-transparent">.</div>
          </button>
        </div>
      </SidebarPanelContent>
    </SidebarPanel>
  );
}
