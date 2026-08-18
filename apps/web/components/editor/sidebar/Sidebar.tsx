"use client";

import { Panel, Tabs } from "@/components/ui";
import { GroupLayersPanel } from "@/components/editor/panels/GroupLayersPanel";
import { ProtocolJsonPanel } from "@/components/editor/panels/ProtocolJsonPanel";
import { useEditorStore } from "@/lib/editor/editor-store";
import { FileAudio, ImagePlus, Upload } from "lucide-react";

function AssetsPanel() {
  const project = useEditorStore((s) => s.project);
  const assets = project?.assets ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="assets-panel">
      <div className="shrink-0 space-y-2 border-b border-[var(--border-subtle)] px-3 py-2.5">
        <button
          type="button"
          className="flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] text-[12px] font-medium text-[var(--fg-muted)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)]"
          disabled
          title="Upload sẽ nối asset ingest API"
        >
          <Upload size={14} />
          Upload media
        </button>
        <p className="text-[10px] leading-snug text-[var(--fg-muted)]">
          Ảnh, SVG, audio (mp3/wav/aac). Kéo vào stage hoặc timeline sau khi
          upload.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {assets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[var(--border-subtle)] px-3 py-8 text-center">
            <div className="flex items-center gap-2 text-[var(--fg-disabled)]">
              <ImagePlus size={20} />
              <FileAudio size={20} />
            </div>
            <p className="text-[12px] text-[var(--fg-muted)]">
              Chưa có file. Upload ảnh, SVG hoặc audio để dùng trong video.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {assets.map((asset) => (
              <li
                key={asset.id}
                className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-2"
              >
                <p className="truncate text-[12px] font-medium text-[var(--fg-primary)]">
                  {asset.id}
                </p>
                <p className="truncate text-[10px] text-[var(--fg-muted)]">
                  {asset.assetType} · {asset.uri}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="editor-panel overflow-hidden [grid-area:sidebar]">
      <Panel
        bodyClassName="!p-0"
        className="h-full rounded-none border-0 bg-transparent shadow-none"
      >
        <Tabs
          defaultValue="layers"
          items={[
            {
              id: "layers",
              label: "Layers",
              content: <GroupLayersPanel />,
            },
            {
              id: "assets",
              label: "Assets",
              content: <AssetsPanel />,
            },
            {
              id: "json",
              label: "JSON",
              content: <ProtocolJsonPanel />,
            },
          ]}
        />
      </Panel>
    </aside>
  );
}
