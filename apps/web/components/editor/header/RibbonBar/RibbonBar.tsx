"use client";

import { useRef, useState } from "react";
import { NewProjectModal } from "@/components/hub/NewProjectModal";
import { downloadBlob, exportMotionProject } from "@/lib/api/export";
import { saveProject } from "@/lib/project-storage";
import { useEditorStore } from "@/lib/store/editor-store";
import {
  parseMotionProject,
  serializeMotionProject,
} from "@motionvideo/motion-schema";
import { validateMotionProjectPresets } from "@motionvideo/template-library";
import {
  MessageSquare,
  RotateCw,
  MonitorPlay,
  Pencil,
  Share2,
  ChevronDown,
} from "lucide-react";

const RIBBON_TABS = [
  "Tệp",
  "Trang đầu",
  "Chèn",
  "Vẽ",
  "Thiết kế",
  "Chuyển tiếp",
  "Hoạt hình",
  "Trình chiếu",
  "Xem xét",
  "Xem",
  "Trợ giúp",
];

export function RibbonBar() {
  const project = useEditorStore((s) => s.project);
  const isExporting = useEditorStore((s) => s.isExporting);
  const setExporting = useEditorStore((s) => s.setExporting);
  const loadProject = useEditorStore((s) => s.loadProject);
  const [modalOpen, setModalOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("Trang đầu");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    if (!project || isExporting) return;
    setExportError(null);
    setExporting(true);
    try {
      saveProject(project);
      const blob = await exportMotionProject(project);
      const name = `${project.brand.name.replace(/[^\w\-]+/g, "_") || "motion"}.mp4`;
      downloadBlob(blob, name);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Xuất thất bại");
    } finally {
      setExporting(false);
    }
  }

  function handleDownloadMt() {
    if (!project) return;
    const text = serializeMotionProject(project);
    downloadBlob(
      new Blob([text], { type: "application/json" }),
      `${project.id}.mt`,
    );
  }

  function handleImportClick() {
    fileRef.current?.click();
  }

  async function handleImportFile(file: File | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseMotionProject(JSON.parse(text) as unknown);
      const check = validateMotionProjectPresets(parsed);
      if (!check.ok) {
        const detail = check.unknown.map((u) => u.preset).join(", ");
        setExportError(`Preset không hợp lệ: ${detail}`);
        return;
      }
      saveProject(parsed);
      loadProject(parsed);
      setExportError(null);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Import .mt thất bại");
    }
  }

  return (
    <>
      <div className="mv-ppt-bottom-row">
        {/* Menu Tabs */}
        <nav className="mv-ppt-ribbon-tabs" aria-label="Thanh công cụ ribbon">
          {RIBBON_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`mv-ppt-tab-btn ${activeTab === tab ? "is-active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>

        {/* Action Buttons Right */}
        <div className="mv-ppt-ribbon-actions">
          <input
            ref={fileRef}
            type="file"
            accept=".mt,application/json"
            hidden
            onChange={(e) => {
              void handleImportFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="mv-ppt-action-btn"
            onClick={handleImportClick}
            title="Mở file .mt"
          >
            <MessageSquare size={13} strokeWidth={1.2} />
            Chú thích
          </button>
          <button
            type="button"
            className="mv-ppt-action-btn"
            onClick={handleDownloadMt}
            disabled={!project}
            title="Tải file .mt"
          >
            <RotateCw size={13} strokeWidth={1.2} />
            Cập nhật
          </button>
          <button
            type="button"
            className="mv-ppt-action-btn"
            onClick={() => setModalOpen(true)}
          >
            <MonitorPlay size={13} strokeWidth={1.2} />
            Trình bày
            <ChevronDown size={11} strokeWidth={1.2} />
          </button>
          <button
            type="button"
            className="mv-ppt-action-btn"
            onClick={handleDownloadMt}
          >
            <Pencil size={13} strokeWidth={1.2} />
            Chỉnh sửa
            <ChevronDown size={11} strokeWidth={1.2} />
          </button>
          <button
            type="button"
            className="mv-ppt-share-btn"
            disabled={!project || isExporting}
            onClick={() => {
              void handleExport();
            }}
          >
            <Share2 size={13} strokeWidth={1.2} />
            {isExporting ? "Đang xuất…" : "Chia sẻ"}
            <ChevronDown size={11} strokeWidth={1.2} />
          </button>
        </div>
      </div>

      {exportError ? (
        <div className="mv-topbar-error" role="alert">
          {exportError}
          <button
            type="button"
            className="mv-btn mv-btn-ghost mv-btn-sm"
            onClick={() => setExportError(null)}
          >
            Đóng
          </button>
        </div>
      ) : null}
      <NewProjectModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
