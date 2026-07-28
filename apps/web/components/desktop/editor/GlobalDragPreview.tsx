"use client";

import React, { useLayoutEffect, useRef } from "react";
import { Film, Music } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor-store";
import {
  bindDragPreviewElement,
} from "@/lib/editor-drag-cursor";
import { TIMELINE_ZOOM_DEFAULT, zoomToPixelsPerSecond } from "@/components/desktop/editor/timeline/timeline-scale";

export function GlobalDragPreview() {
  const activeDragItem = useEditorStore((s) => s.activeDragItem);
  const isOverTimeline = useEditorStore((s) => s.isOverTimeline);
  const elRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!activeDragItem) {
      bindDragPreviewElement(null);
      return;
    }
    bindDragPreviewElement(elRef.current);
    return () => {
      bindDragPreviewElement(null);
    };
  }, [activeDragItem]);

  if (!activeDragItem) {
    return null;
  }

  const pixelsPerSecond = zoomToPixelsPerSecond(TIMELINE_ZOOM_DEFAULT);
  const blockWidth = Math.max(activeDragItem.duration * pixelsPerSecond, 60);

  return (
    <div
      ref={elRef}
      className={`pointer-events-none fixed top-0 left-0 transition-none will-change-transform ${
        isOverTimeline ? "z-35" : "z-[9999]"
      }`}
    >
      {!isOverTimeline ? (
        /* Thẻ thu nhỏ preview màu đen mờ khi rê ở Sidebar & bên ngoài Timeline */
        <div className="flex flex-col justify-between w-32 h-20 rounded-lg bg-[#18181b] border border-[#3f3f46] p-2.5 text-white shadow-2xl overflow-hidden opacity-95 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 min-w-0">
            {activeDragItem.type === "audio" ? (
              <Music size={14} className="text-teal-400 shrink-0" />
            ) : (
              <Film size={14} className="text-cyan-400 shrink-0" />
            )}
            <span className="text-[11px] font-semibold truncate text-zinc-100">
              {activeDragItem.name}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-mono">
              {activeDragItem.type}
            </span>
            <span className="text-[10px] text-zinc-200 font-mono font-medium bg-black/70 px-1.5 py-0.5 rounded border border-white/10">
              {activeDragItem.duration}s
            </span>
          </div>
        </div>
      ) : (
        /* Khối Cyan Đục hình thanh khối khi rê xuống hạ cánh ở Timeline */
        <div
          className="flex h-7 items-center rounded bg-[#0D7476] px-2.5 text-[11px] font-semibold text-white shadow-2xl overflow-hidden opacity-95 border border-[#14B8A6]/40"
          style={{ width: blockWidth }}
        >
          <span className="truncate">{activeDragItem.name}</span>
        </div>
      )}
    </div>
  );
}
