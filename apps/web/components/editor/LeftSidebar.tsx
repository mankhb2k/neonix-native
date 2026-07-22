"use client";

import { useState } from "react";
import { useEditorStore } from "@/lib/store/editor-store";
import { Plus } from "lucide-react";

export function LeftSidebar() {
  const project = useEditorStore((s) => s.project);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectScene = useEditorStore((s) => s.selectScene);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("text");

  return (
    <aside className="sidebar-left">
      <button
        className="add-resource-btn"
        onClick={() => setPopoverOpen(!popoverOpen)}
        title="Thêm tài nguyên"
      >
        <Plus size={20} strokeWidth={1.2} style={{ marginBottom: 4 }} />
        Thêm
      </button>

      {/* Popover */}
      <div className={`resource-popover ${popoverOpen ? "is-active" : ""}`}>
        <div className="popover-header">
          <div
            className={`popover-tab ${activeTab === "text" ? "is-active" : ""}`}
            onClick={() => setActiveTab("text")}
          >
            Văn bản
          </div>
          <div
            className={`popover-tab ${activeTab === "lottie" ? "is-active" : ""}`}
            onClick={() => setActiveTab("lottie")}
          >
            Lottie
          </div>
          <div
            className={`popover-tab ${activeTab === "image" ? "is-active" : ""}`}
            onClick={() => setActiveTab("image")}
          >
            Hình ảnh
          </div>
        </div>
        <div className="popover-body">
          {activeTab === "text" && (
            <>
              <div className="resource-item">Tiêu đề lớn</div>
              <div className="resource-item">Chữ phụ</div>
              <div className="resource-item">Preset Pop</div>
            </>
          )}
          {activeTab === "lottie" && (
            <>
              <div className="resource-item">Icon Vui nhộn</div>
              <div className="resource-item">Mũi tên</div>
            </>
          )}
          {activeTab === "image" && (
            <>
              <div className="resource-item">Tải lên</div>
              <div className="resource-item">Thư viện</div>
            </>
          )}
        </div>
      </div>

      {/* Scene Thumbnails */}
      {(project?.scenes ?? []).map((s, index) => (
        <div
          key={s.id}
          className={`scene-thumbnail ${selectedSceneId === s.id ? "active" : ""}`}
          onClick={() => selectScene(s.id)}
          data-index={index + 1}
          style={{
            borderColor: selectedSceneId === s.id ? "var(--accent)" : "transparent",
            color: selectedSceneId === s.id ? "var(--fg)" : "var(--fg-muted)"
          }}
        >
          {s.role ?? `Scene ${index + 1}`}
        </div>
      ))}
    </aside>
  );
}
