"use client";

import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { useEditorActions } from "@/hooks/editor/use-editor-actions";
import { useEditorDocument } from "@/hooks/editor/use-editor-store";
import {
  completeAssetUpload,
  createAssetUpload,
  deleteAsset as deleteWorkspaceAsset,
  listAssets,
  uploadAssetBytes,
  uploadAssetPreview,
  type Asset as WorkspaceAsset,
} from "@/lib/api/assets";
import { attachProjectAsset } from "@/lib/api/projects";
import { workspaceAssetToProtocolAsset } from "@/lib/editor/assets/workspace-asset-adapter";
import { createBrowserVideoPreview } from "@/lib/media/browser-preview";

type UseAssetUploadOptions = {
  projectRef?: string;
  onUploaded?: (asset: WorkspaceAsset) => void;
};

export function useAssetUpload({
  projectRef,
  onUploaded,
}: UseAssetUploadOptions = {}) {
  const { applyCommands } = useEditorActions();
  const document = useEditorDocument();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploadingAssetName, setUploadingAssetName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const onUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const files = [...(event.target.files ?? [])];
      input.value = "";
      if (files.length === 0) return;

      setUploadError(null);
      setUploadingAssetName(files[0]?.name ?? null);
      try {
        for (const file of files) {
          setUploadingAssetName(file.name);
          if (!/^(image|video|audio)\//.test(file.type)) {
            setUploadError(`Unsupported asset type: ${file.name}`);
            continue;
          }

          let session: Awaited<ReturnType<typeof createAssetUpload>> | null = null;
          let completed = false;
          try {
            const browserPreview = file.type.startsWith("video/")
              ? await createBrowserVideoPreview(file)
              : null;
            const preview = browserPreview?.poster
              ? {
                  size: browserPreview.poster.size,
                  mimeType: "image/webp" as const,
                  width: browserPreview.width ?? 1,
                  height: browserPreview.height ?? 1,
                  ...(browserPreview.durationMs !== null
                    ? { durationMs: browserPreview.durationMs }
                    : {}),
                }
              : undefined;

            session = await createAssetUpload(file, preview);
            await uploadAssetBytes(session, file);
            if (browserPreview?.poster) {
              await uploadAssetPreview(session, browserPreview.poster);
            }
            await completeAssetUpload(session.assetId);
            completed = true;

            const assets = await listAssets();
            const uploadedAsset = assets.find(
              (asset) => asset.id === session?.assetId,
            );
            const protocolAsset = uploadedAsset
              ? workspaceAssetToProtocolAsset(uploadedAsset)
              : null;
            if (!uploadedAsset || !protocolAsset) {
              throw new Error("Uploaded asset is not available in the workspace");
            }

            onUploaded?.(uploadedAsset);
            if (!document.assets.some((asset) => asset.id === protocolAsset.id)) {
              const applied = applyCommands([
                { type: "add-asset", asset: protocolAsset },
              ]);
              if (!applied) {
                throw new Error(
                  "The asset could not be imported into the current project",
                );
              }
            }
            if (projectRef) {
              await attachProjectAsset({ projectRef, assetId: uploadedAsset.id });
            }
          } catch (error) {
            if (session && !completed) {
              try {
                await deleteWorkspaceAsset(session.assetId);
              } catch {
                // Keep the original upload error visible to the user.
              }
            }
            setUploadError(
              error instanceof Error ? error.message : `Upload failed: ${file.name}`,
            );
          }
        }
      } finally {
        setUploadingAssetName(null);
      }
    },
    [applyCommands, document, onUploaded, projectRef],
  );

  return {
    uploadRef,
    uploadingAssetName,
    uploadError,
    onUpload,
  };
}
