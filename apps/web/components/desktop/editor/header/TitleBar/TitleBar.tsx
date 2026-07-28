"use client";

import { useRef, useState, type CSSProperties } from "react";
import { AppLink } from "@/components/AppLink";
import { NewProjectModal } from "@/components/hub/NewProjectModal";
import { DesktopMenuBar, DesktopWindowControls } from "@/components/desktop/editor";

import { Button, Tooltip } from "@/components/ui";
import { downloadBlob, exportMotionProject } from "@/lib/api/export";
import { useIsDesktop } from "@/lib/desktop";
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
  const brandName = useEditorStore((s) => s.project?.metadata.brand.name);
  const overlayScenes = useEditorStore((s) => s.overlayScenes);
  const isExporting = useEditorStore((s) => s.isExporting);
  const setExporting = useEditorStore((s) => s.setExporting);
  const updateBrand = useEditorStore((s) => s.updateBrand);
  const loadProject = useEditorStore((s) => s.loadProject);
  const isDesktop = useIsDesktop();

  const [modalOpen, setModalOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isPro] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    if (!project || isExporting) return;
    setExportError(null);
    setExporting(true);
    try {
      saveProject(project, overlayScenes);
      const blob = await exportMotionProject(project);
      const name = `${project.metadata.brand.name.replace(/[^\w-]+/g, "_") || "motion"}.mp4`;
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
      `${project.metadata.id}.mt`,
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
      saveProject(parsed, []);
      loadProject(parsed, []);
      setExportError(null);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Import .mt thất bại");
    }
  }

  const noDrag = isDesktop
    ? ({ WebkitAppRegion: "no-drag" } as CSSProperties)
    : undefined;

  return (
    <>
      <div
        className="desktop-titlebar flex h-[38px] items-center justify-between gap-3 border-b border-[var(--border-subtle)] pl-3 pr-0"
        style={isDesktop ? ({ WebkitAppRegion: "drag" } as CSSProperties) : { paddingRight: 12 }}
      >
        <div className="flex min-w-0 items-center gap-2" style={noDrag}>
          <AppLink href="/" className="flex items-center no-underline" title="Trang chủ">
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[4px] bg-[#d9381e] text-[12px] font-bold text-white">
              M
            </span>
          </AppLink>

          {isDesktop ? <DesktopMenuBar /> : null}

          <input
            className="w-[160px] rounded-[4px] border border-transparent bg-transparent px-1.5 py-0.5 text-[13px] font-medium text-[var(--fg-primary)] outline-none hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] focus:border-[var(--border-strong)] focus:bg-[var(--bg-hover)]"
            value={brandName ?? "Presentation 2"}
            onChange={(e) => updateBrand({ name: e.target.value })}
            aria-label="Tên dự án"
            placeholder="Dự án không tên"
          />

          <Tooltip content="Đã lưu tự động vào đám mây" side="bottom">
            <span className="mv-ppt-saved-icon">
              <CloudCheck size={15} strokeWidth={1.2} color="#22c55e" />
            </span>
          </Tooltip>

          {!isDesktop ? (
            <>
              <Tooltip content="Tải file dự án (.mt)" side="bottom">
                <Button variant="ghost" size="sm" onClick={handleDownloadMt}>
                  Tệp
                </Button>
              </Tooltip>
              <Tooltip content="Trung tâm trợ giúp & Hướng dẫn" side="bottom">
                <Button variant="ghost" size="sm">
                  Trợ giúp
                </Button>
              </Tooltip>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-2" style={noDrag}>
          <div className="flex w-[220px] items-center gap-1.5 rounded-md bg-[var(--bg-surface)] px-2.5 py-1 text-[var(--fg-muted)]">
            <Search size={14} strokeWidth={1.2} />
            <input
              type="text"
              placeholder="Tìm kiếm"
              className="w-full border-none bg-transparent text-[12px] text-[var(--fg-secondary)] outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2" style={noDrag}>
          <input
            ref={fileRef}
            type="file"
            accept=".mt,application/json"
            hidden
            onChange={(e) => {
              const input = e.currentTarget;
              void handleImportFile(input.files?.[0]);
              input.value = "";
            }}
          />

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

          {isDesktop ? <DesktopWindowControls /> : null}
        </div>
      </div>

      {exportError ? (
        <div
          className="flex items-center justify-center gap-2 bg-red-500/10 px-4 py-2 text-sm text-red-500"
          role="alert"
        >
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
