"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor-store";

function formatClock(totalSeconds: number, fps = 30): string {
  const safeFps = Math.max(1, Math.round(fps));
  const totalFrames = Math.max(0, Math.round(totalSeconds * safeFps));
  const frames = totalFrames % safeFps;
  const totalSecs = Math.floor(totalFrames / safeFps);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;
  return [hours, minutes, seconds, frames]
    .map((part) => part.toString().padStart(2, "0"))
    .join(":");
}

export function Timeline() {
  const project = useEditorStore((s) => s.project);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectScene = useEditorStore((s) => s.selectScene);
  const [playing, setPlaying] = useState(false);

  if (!project) return null;

  const total = project.scenes.reduce((sum, s) => sum + s.duration, 0);
  const fps = project.metadata.fps ?? 30;

  return (
    <div className="col-span-full flex flex-col overflow-hidden border-t border-[var(--line)] bg-[var(--bg-panel)] [grid-area:timeline]">
      <div className="grid h-[36px] grid-cols-3 items-center border-b border-[var(--line-strong)] bg-[var(--bg-panel)] px-3">
        <div />
        <div className="flex items-center justify-center gap-3">
          <span className="font-mono text-[13px] tabular-nums text-[var(--fg-muted)]">
            {formatClock(0, fps)}
          </span>
          <button
            type="button"
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => setPlaying((value) => !value)}
            className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-[var(--fg-muted)]"
          >
            {playing ? (
              <Pause size={14} strokeWidth={0} fill="currentColor" />
            ) : (
              <Play size={14} strokeWidth={0} fill="currentColor" className="ml-0.5" />
            )}
          </button>
          <span className="font-mono text-[13px] tabular-nums text-[var(--fg-muted)]">
            {formatClock(total, fps)}
          </span>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button className="cursor-pointer rounded bg-transparent px-2 py-1 text-[12px] font-medium text-[var(--fg)] hover:bg-[var(--bg-hover)]">Tách</button>
          <button className="cursor-pointer rounded bg-transparent px-2 py-1 text-[12px] font-medium text-[var(--fg)] hover:bg-[var(--bg-hover)]">Xóa</button>
        </div>
      </div>

      <div className="relative flex-1 overflow-auto bg-[var(--bg-panel)] p-2">
        <div className="absolute bottom-0 left-[240px] top-0 z-10 w-[2px] bg-red-500 after:absolute after:-top-1 after:-ml-1.5 after:border-[6px] after:border-transparent after:border-t-red-500"></div>

        {/* Video Track */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "8px", alignItems: "center" }}>
          <div style={{ width: "40px", fontSize: "12px", color: "var(--fg-muted)" }}>Video</div>
          <div style={{ display: "flex", gap: "4px", overflowX: "auto" }}>
            {project.scenes.map((scene, index) => (
              <button
                key={scene.id}
                type="button"
                className={`mv-timeline-block${selectedSceneId === scene.id ? " is-active" : ""}`}
                style={{
                  width: `${Math.max(88, scene.duration * 28)}px`,
                  flexShrink: 0,
                  height: "40px",
                  background: selectedSceneId === scene.id ? "var(--bg-hover)" : "#27272A",
                  border: `1px solid ${selectedSceneId === scene.id ? "var(--accent)" : "#3f3f46"}`,
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: "8px",
                  fontSize: "12px",
                  color: selectedSceneId === scene.id ? "var(--accent)" : "var(--fg-muted)",
                  cursor: "pointer",
                }}
                onClick={() => selectScene(scene.id)}
              >
                <strong>
                  {index + 1}. {scene.semantic?.role ?? scene.name ?? scene.id} ({scene.duration}s)
                </strong>
              </button>
            ))}
          </div>
        </div>

        {/* Audio Track */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "8px", alignItems: "center" }}>
          <div style={{ width: "40px", fontSize: "12px", color: "var(--fg-muted)" }}>Audio</div>
          {project.timeline.audioTracks.length === 0 ? <span className="text-[10px] text-[var(--fg-muted)]">Chưa có audio</span> : project.timeline.audioTracks.map((track) => (
            <div key={track.id} style={{ height: "24px", background: "#164E63", border: "1px solid #0E7490", borderRadius: "4px", width: `${Math.max(80, total * 28)}px`, display: "flex", alignItems: "center", paddingLeft: "8px", fontSize: "10px", color: "white" }}>
              {track.role} · {track.assetId}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
