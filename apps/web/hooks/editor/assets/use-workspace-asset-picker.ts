"use client";

import { useCallback, useState } from "react";
import { useEditorActions } from "@/hooks/editor/use-editor-actions";
import { useEditorDocument } from "@/hooks/editor/use-editor-store";
import {
  listAssets,
  type Asset as WorkspaceAsset,
} from "@/lib/api/assets";
import { attachProjectAsset } from "@/lib/api/projects";
import { workspaceAssetToProtocolAsset } from "@/lib/editor/assets/workspace-asset-adapter";

type UseWorkspaceAssetPickerOptions = {
  projectRef?: string;
};

export function useWorkspaceAssetPicker({
  projectRef,
}: UseWorkspaceAssetPickerOptions = {}) {
  const { applyCommands } = useEditorActions();
  const document = useEditorDocument();
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [workspaceAssets, setWorkspaceAssets] = useState<WorkspaceAsset[]>([]);
  const [assetPickerLoading, setAssetPickerLoading] = useState(false);
  const [assetPickerError, setAssetPickerError] = useState<string | null>(null);

  const addWorkspaceAsset = useCallback((asset: WorkspaceAsset) => {
    setWorkspaceAssets((current) => [
      asset,
      ...current.filter((candidate) => candidate.id !== asset.id),
    ]);
  }, []);

  const onChooseAsset = useCallback(async () => {
    setAssetPickerOpen((open) => !open);
    if (workspaceAssets.length > 0 || assetPickerLoading) return;
    setAssetPickerLoading(true);
    setAssetPickerError(null);
    try {
      setWorkspaceAssets(await listAssets());
    } catch (error) {
      setAssetPickerError(
        error instanceof Error ? error.message : "Unable to load workspace assets",
      );
    } finally {
      setAssetPickerLoading(false);
    }
  }, [assetPickerLoading, workspaceAssets.length]);

  const onSelectWorkspaceAsset = useCallback(
    async (asset: WorkspaceAsset) => {
      const protocolAsset = workspaceAssetToProtocolAsset(asset);
      if (!protocolAsset) return;
      if (!document.assets.some((candidate) => candidate.id === protocolAsset.id)) {
        const applied = applyCommands([
          { type: "add-asset", asset: protocolAsset },
        ]);
        if (!applied) {
          setAssetPickerError(
            "The asset could not be imported into the current project",
          );
          return;
        }
      }
      if (projectRef) {
        try {
          await attachProjectAsset({ projectRef, assetId: asset.id });
        } catch (error) {
          setAssetPickerError(
            error instanceof Error
              ? error.message
              : "Unable to attach asset to project",
          );
          return;
        }
      }
      setAssetPickerOpen(false);
    },
    [applyCommands, document, projectRef],
  );

  return {
    assetPickerOpen,
    workspaceAssets,
    assetPickerLoading,
    assetPickerError,
    addWorkspaceAsset,
    onChooseAsset,
    onSelectWorkspaceAsset,
  };
}
