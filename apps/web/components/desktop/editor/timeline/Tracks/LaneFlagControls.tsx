"use client";

import type { ReactNode } from "react";
import { Eye, EyeOff, Lock, Unlock, Volume2, VolumeX } from "lucide-react";
import { useEditorStore } from "@/lib/editor/editor-store";
import type { TimelineLane } from "@/lib/editor/timeline-clips";

type Props = {
  lane: TimelineLane;
  /** Icon chính (Film / Music / tên). */
  leading: ReactNode;
};

/**
 * Control lane thật: lock (+ visible cho visual / mute cho audio).
 * Chỉ hiện sau khi behavior đã enforce trong store (Phase 6).
 */
export function LaneFlagControls({ lane, leading }: Props) {
  const updateLaneFlags = useEditorStore((s) => s.updateLaneFlags);
  const locked = Boolean(lane.locked);
  const hidden = lane.kind === "visual" && lane.visible === false;
  const muted = lane.kind === "audio" && Boolean(lane.muted);

  return (
    <div className="flex items-center gap-0.5 min-w-0">
      <span className="shrink-0 flex items-center justify-center w-5 h-5 text-[var(--fg-muted)]">
        {leading}
      </span>
      <button
        type="button"
        className="p-0.5 rounded text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
        title={locked ? "Mở khóa lane" : "Khóa lane"}
        aria-pressed={locked}
        onClick={(e) => {
          e.stopPropagation();
          updateLaneFlags(lane.id, { locked: !locked });
        }}
      >
        {locked ? <Lock size={12} /> : <Unlock size={12} />}
      </button>
      {lane.kind === "visual" ? (
        <button
          type="button"
          className="p-0.5 rounded text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
          title={hidden ? "Hiện lane" : "Ẩn lane"}
          aria-pressed={hidden}
          onClick={(e) => {
            e.stopPropagation();
            updateLaneFlags(lane.id, { visible: hidden });
          }}
        >
          {hidden ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
      ) : (
        <button
          type="button"
          className="p-0.5 rounded text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
          title={muted ? "Bật tiếng lane" : "Tắt tiếng lane"}
          aria-pressed={muted}
          onClick={(e) => {
            e.stopPropagation();
            updateLaneFlags(lane.id, { muted: !muted });
          }}
        >
          {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
        </button>
      )}
    </div>
  );
}
