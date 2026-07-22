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
      <div className="timeline-toolbar">
        <button className="mv-btn-ghost mv-btn-sm" style={{ padding: "4px 8px" }}>▶ Play</button>
        <span style={{ fontFamily: "monospace", fontSize: "14px", color: "var(--accent)" }}>
          00:00:00 / 00:00:{total.toString().padStart(2, "0")}
        </span>
        <div style={{ flex: 1 }}></div>
        <button className="mv-btn-ghost mv-btn-sm" style={{ padding: "4px 8px" }}>Tách</button>
        <button className="mv-btn-ghost mv-btn-sm" style={{ padding: "4px 8px" }}>Xóa</button>
      </div>

      <div className="timeline-tracks">
        <div className="playhead-mock"></div>

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
                  {index + 1}. {scene.role ?? scene.id} ({scene.duration}s)
                </strong>
              </button>
            ))}
          </div>
        </div>

        {/* Audio Track */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "8px", alignItems: "center" }}>
          <div style={{ width: "40px", fontSize: "12px", color: "var(--fg-muted)" }}>Audio</div>
          <div
            style={{
              height: "24px",
              background: "#164E63",
              border: "1px solid #0E7490",
              borderRadius: "4px",
              width: "600px",
              display: "flex",
              alignItems: "center",
              paddingLeft: "8px",
              fontSize: "10px",
              color: "white"
            }}
          >
            Nhạc nền Lofi Chill.mp3
          </div>
        </div>
      </div>
    </>
  );
}
