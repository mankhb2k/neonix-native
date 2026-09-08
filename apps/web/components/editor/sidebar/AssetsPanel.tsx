"use client";

import { FolderOpen, Upload } from "lucide-react";
import { Button } from "@/components/ui";
import { useAssetUpload } from "@/hooks/editor/assets/use-asset-upload";
import { useWorkspaceAssetPicker } from "@/hooks/editor/assets/use-workspace-asset-picker";
import { useEditorDocument } from "@/hooks/editor/use-editor-store";
import { workspaceAssetToProtocolAsset } from "@/lib/editor/assets/workspace-asset-adapter";
import { AssetIcon, AssetItem } from "./AssetItem";

export function AssetsPanel({ projectRef }: { projectRef?: string }) {
  const document = useEditorDocument();
  const picker = useWorkspaceAssetPicker({ projectRef });
  const upload = useAssetUpload({
    projectRef,
    onUploaded: picker.addWorkspaceAsset,
  });

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-auto p-3"
      data-testid="assets-panel"
    >
      <input
        ref={upload.uploadRef}
        type="file"
        accept="image/*,video/*,audio/*"
        multiple
        className="hidden"
        onChange={upload.onUpload}
      />
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-[12px] text-[var(--fg-secondary)]"
          onClick={() => void picker.onChooseAsset()}
          disabled={Boolean(upload.uploadingAssetName)}
          aria-expanded={picker.assetPickerOpen}
          data-testid="asset-choose-button"
        >
          <FolderOpen size={14} strokeWidth={1.8} /> Choose asset
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-[12px] text-[var(--fg-secondary)]"
          onClick={() => upload.uploadRef.current?.click()}
          disabled={Boolean(upload.uploadingAssetName)}
          aria-busy={Boolean(upload.uploadingAssetName)}
          data-testid="asset-upload-button"
        >
          <Upload size={14} strokeWidth={1.8} />{" "}
          {upload.uploadingAssetName ? "Uploading…" : "Upload"}
        </Button>
      </div>
      {upload.uploadError ? (
        <div
          className="mb-3 rounded-md border border-red-400/30 bg-red-400/10 px-2.5 py-2 text-[12px] text-red-200"
          role="alert"
        >
          {upload.uploadError}
        </div>
      ) : null}
      {picker.assetPickerOpen ? (
        <div className="mb-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2">
          <div className="mb-2 flex items-center justify-between px-1 text-[10px] uppercase tracking-[0.08em] text-[var(--fg-muted)]">
            <span>Workspace assets</span>
            {picker.workspaceAssets.length > 0 ? (
              <span>{picker.workspaceAssets.length}</span>
            ) : null}
          </div>
          {picker.assetPickerLoading ? (
            <div className="px-1 py-3 text-[12px] text-[var(--fg-muted)]">
              Loading assets…
            </div>
          ) : picker.assetPickerError ? (
            <div className="px-1 py-3 text-[12px] text-red-300">
              {picker.assetPickerError}
            </div>
          ) : picker.workspaceAssets.length === 0 ? (
            <div className="px-1 py-3 text-[12px] text-[var(--fg-muted)]">
              No workspace assets.
            </div>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-auto">
              {picker.workspaceAssets.map((asset) => {
                const protocolAsset = workspaceAssetToProtocolAsset(asset);
                if (!protocolAsset) return null;
                const alreadyAdded = document.assets.some(
                  (candidate) => candidate.id === protocolAsset.id,
                );
                return (
                  <li key={asset.id}>
                    <button
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => void picker.onSelectWorkspaceAsset(asset)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-[var(--fg-primary)] hover:bg-[var(--bg-hover)] disabled:cursor-default disabled:opacity-45"
                    >
                      <AssetIcon asset={protocolAsset} />
                      <span className="min-w-0 flex-1 truncate">
                        {asset.original_filename ?? asset.id}
                      </span>
                      {alreadyAdded ? (
                        <span className="text-[10px] text-[var(--fg-muted)]">
                          Added
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
      {document.assets.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--border-subtle)] px-3 py-6 text-center text-[12px] text-[var(--fg-muted)]">
          No assets yet.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {document.assets.map((asset) => (
            <AssetItem key={asset.id} asset={asset} />
          ))}
        </ul>
      )}
    </div>
  );
}
