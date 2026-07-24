"use client";

import { useEditorStore } from "@/lib/store/editor-store";

export function Timeline() {
  const project = useEditorStore((s) => s.project);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectScene = useEditorStore((s) => s.selectScene);

  if (!project) return null;

  const total = project.scenes.reduce((sum, s) => sum + s.duration, 0);

  return (
    <>
      <div className="flex h-[36px] items-center gap-2 border-b border-[var(--line-strong)] bg-[var(--bg-panel)] px-3">
        <button className="cursor-pointer rounded bg-transparent px-2 py-1 text-[12px] font-medium text-[var(--fg)] hover:bg-[var(--bg-hover)]">▶ Play</button>
        <span className="font-mono text-[14px] text-[var(--accent)]">
          00:00:00 / 00:00:{total.toString().padStart(2, "0")}
        </span>
        <div className="flex-1"></div>
        <button className="cursor-pointer rounded bg-transparent px-2 py-1 text-[12px] font-medium text-[var(--fg)] hover:bg-[var(--bg-hover)]">Tách</button>
        <button className="cursor-pointer rounded bg-transparent px-2 py-1 text-[12px] font-medium text-[var(--fg)] hover:bg-[var(--bg-hover)]">Xóa</button>
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
    </>
  );
}
