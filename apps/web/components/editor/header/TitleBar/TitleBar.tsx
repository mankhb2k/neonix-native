"use client";

import { useRef, useState } from "react";
import { AppLink } from "@/components/AppLink";
import { NewProjectModal } from "@/components/hub/NewProjectModal";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { downloadBlob, exportMotionProject } from "@/lib/api/export";
import { saveProject } from "@/lib/project-storage";
import { useEditorStore } from "@/lib/store/editor-store";
import {
  parseMotionProject,
  serializeMotionProject,
} from "@motionvideo/motion-schema";
import { validateMotionProjectPresets } from "@motionvideo/template-library";
import {
  CloudCheck,
  Search,
  Gem,
  Upload,
} from "lucide-react";

export function TitleBar() {
  const project = useEditorStore((s) => s.project);
  const isExporting = useEditorStore((s) => s.isExporting);
  const setExporting = useEditorStore((s) => s.setExporting);
  const updateBrand = useEditorStore((s) => s.updateBrand);
  const loadProject = useEditorStore((s) => s.loadProject);

  const [modalOpen, setModalOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(true); // Mặc định là Pro
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
      <div className="flex h-[38px] items-center justify-between gap-3 border-b border-[var(--line)] px-3">
        <div className="flex items-center gap-2">
          {/* App Logo */}
          <AppLink href="/" className="flex items-center no-underline" title="Trang chủ">
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[4px] bg-[#d9381e] text-[12px] font-bold text-white">M</span>
          </AppLink>

          {/* Project Name Input */}
          <input
            className="w-[160px] rounded-[4px] border border-transparent bg-transparent px-1.5 py-0.5 text-[13px] font-medium text-[var(--fg)] outline-none hover:border-[var(--line-strong)] hover:bg-[var(--bg-hover)] focus:border-[var(--line-strong)] focus:bg-[var(--bg-hover)]"
            value={project?.brand.name ?? "Presentation 2"}
            onChange={(e) => updateBrand({ name: e.target.value })}
            aria-label="Tên dự án"
            placeholder="Dự án không tên"
          />

          {/* Cloud Saved Icon */}
          <Tooltip content="Đã lưu tự động vào đám mây" side="bottom">
            <span className="mv-ppt-saved-icon">
              <CloudCheck size={15} strokeWidth={1.2} color="#22c55e" />
            </span>
          </Tooltip>

          {/* Nút Tệp và Trợ giúp ngay bên phải icon đám mây */}
          <Tooltip content="Tải file dự án (.mt)" side="bottom">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownloadMt}
            >
              Tệp
            </Button>
          </Tooltip>

          <Tooltip content="Trung tâm trợ giúp & Hướng dẫn" side="bottom">
            <Button
              variant="ghost"
              size="sm"
            >
              Trợ giúp
            </Button>
          </Tooltip>
        </div>

        {/* Search Box in Middle */}
        <div className="flex items-center gap-2">
          <div className="flex w-[220px] items-center gap-1.5 rounded-md bg-[var(--bg-hover)] px-2.5 py-1 text-[var(--fg-muted)]">
            <Search size={14} strokeWidth={1.2} />
            <input type="text" placeholder="Tìm kiếm" className="w-full border-none bg-transparent text-[12px] text-[var(--fg)] outline-none" />
          </div>
        </div>

        {/* Action Buttons & Avatar Right */}
        <div className="flex items-center gap-2">
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

          {/* Nút Pro / Nâng cấp */}
          <Tooltip content="Gói Pro cao cấp" side="bottom">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Gem size={13} strokeWidth={1.2} color="#eab308" />}
              onClick={() => setModalOpen(true)}
            >
              {isPro ? "Pro" : "Nâng cấp"}
            </Button>
          </Tooltip>

          {/* Nút Xuất */}
          <Tooltip content="Xuất video MP4 chất lượng cao" side="bottom">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Upload size={13} strokeWidth={1.2} />}
              disabled={!project || isExporting}
              onClick={() => {
                void handleExport();
              }}
            >
              {isExporting ? "Đang xuất…" : "Xuất"}
            </Button>
          </Tooltip>

          <Tooltip content="Tài khoản cá nhân" side="bottom">
            <div className="h-[26px] w-[26px] overflow-hidden rounded-full border border-[var(--line-strong)]">
              <img
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin"
                alt="User Avatar"
                width="24"
                height="24"
              />
            </div>
          </Tooltip>
        </div>
      </div>

      {exportError ? (
        <div className="flex items-center justify-center gap-2 bg-red-500/10 px-4 py-2 text-sm text-red-500" role="alert">
          {exportError}
          <Button variant="ghost" size="sm" onClick={() => setExportError(null)}>
            Đóng
          </Button>
        </div>
      ) : null}
      <NewProjectModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
