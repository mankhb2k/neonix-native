"use client";

import {
  Eye,
  EyeOff,
  File as FileIcon,
  FileAudio,
  FileVideo,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Lock,
  Unlock,
  Shapes,
  Spline,
  Type,
  Upload,
} from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent, type SyntheticEvent } from "react";
import { Button, Panel, Tabs } from "@/components/ui";
import { useEditorActions } from "@/hooks/editor/use-editor-actions";
import {
  useEditorDocument,
  useEditorLocks,
  useEditorSelection,
  useEditorVisibility,
} from "@/hooks/editor/use-editor-store";
import { useLibraryPointerGesture } from "@/hooks/editor/use-library-pointer-gesture";
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
import { updateKeyboardSelection } from "@/lib/editor/selection/keyboard-selection";
import { createBrowserVideoPreview } from "@/lib/media/browser-preview";
import type {
  MotionProtocolV2,
  V2Asset,
} from "@motionvideo/motion-protocol/v2";

type V2Layer = MotionProtocolV2["layers"][number];
type DisplayLayer = { layer: V2Layer; depth: number };

function buildLayerTree(layers: readonly V2Layer[]): DisplayLayer[] {
  const children = new Map<string | null, V2Layer[]>();
  for (const layer of layers) {
    const list = children.get(layer.parentLayerId) ?? [];
    list.push(layer);
    children.set(layer.parentLayerId, list);
  }
  for (const list of children.values())
    list.sort((left, right) => right.order - left.order);
  const result: DisplayLayer[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const layer of children.get(parentId) ?? []) {
      result.push({ layer, depth });
      if (layer.type === "group") visit(layer.id, depth + 1);
    }
  };
  visit(null, 0);
  return result;
}

function assetLabel(asset: V2Asset): string {
  return asset.id;
}

function AssetIcon({ asset }: { asset: V2Asset }) {
  if (asset.kind === "audio") return <FileAudio size={16} strokeWidth={1.7} />;
  if (asset.kind === "video") return <FileVideo size={16} strokeWidth={1.7} />;
  if (asset.kind === "image") return <ImageIcon size={16} strokeWidth={1.7} />;
  return <FileIcon size={16} strokeWidth={1.7} />;
}

function workspaceAssetToProtocolAsset(asset: WorkspaceAsset): V2Asset | null {
  if (!asset.download_url) return null;
  const id = `asset-${asset.id}`;
  const common = {
    id,
    uri: asset.download_url,
    mimeType: asset.mime_type,
  };
  if (asset.mime_type.startsWith("image/")) {
    return {
      ...common,
      kind: "image",
      ...(asset.source_width ? { width: asset.source_width } : {}),
      ...(asset.source_height ? { height: asset.source_height } : {}),
    };
  }
  if (asset.mime_type.startsWith("video/")) {
    return {
      ...common,
      kind: "video",
      ...(asset.source_width ? { width: asset.source_width } : {}),
      ...(asset.source_height ? { height: asset.source_height } : {}),
      ...(asset.source_duration_ms != null ? { duration: asset.source_duration_ms } : {}),
    };
  }
  if (asset.mime_type.startsWith("audio/")) {
    return {
      ...common,
      kind: "audio",
      mimeType: asset.mime_type,
      ...(asset.source_duration_ms != null ? { duration: asset.source_duration_ms } : {}),
    };
  }
  return null;
}

function LayerIcon({ layer }: { layer: V2Layer }) {
  if (layer.type === "text") return <Type size={14} strokeWidth={1.8} />;
  if (layer.type === "shape") return <Shapes size={14} strokeWidth={1.8} />;
  if (layer.type === "image") return <ImageIcon size={14} strokeWidth={1.8} />;
  if (layer.type === "video") return <FileVideo size={14} strokeWidth={1.8} />;
  if (layer.type === "path") return <Spline size={14} strokeWidth={1.8} />;
  if (layer.type === "group") return <Folder size={14} strokeWidth={1.8} />;
  return <FileIcon size={14} strokeWidth={1.8} />;
}

function AssetItem({ asset }: { asset: V2Asset }) {
  const { onPointerDown, onKeyDown } = useLibraryPointerGesture({
    kind: "asset",
    id: asset.id,
    label: assetLabel(asset),
    asset,
    duration:
      asset.kind === "video" || asset.kind === "audio"
        ? (asset.duration === undefined ? undefined : asset.duration / 1000)
        : undefined,
  });
  const preview = asset.kind === "image" || asset.kind === "video";
  return (
    <li>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md bg-[var(--bg-surface)] p-2 text-left transition-colors hover:bg-[var(--bg-hover)]"
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        title="Drag to the stage or timeline to add a clip"
      >
        {preview ? (
          <span className="h-10 w-14 shrink-0 overflow-hidden rounded border border-[var(--border-subtle)] bg-black/20">
            {asset.kind === "image" ? (
              // Asset URLs can be user-provided and are not known at build time.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.uri}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <video
                crossOrigin="anonymous"
                src={asset.uri}
                muted
                preload="metadata"
                className="h-full w-full object-cover"
              />
            )}
          </span>
        ) : (
          <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded border border-[var(--border-subtle)] text-[var(--fg-muted)]">
            <AssetIcon asset={asset} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block break-all text-[12px] font-medium text-[var(--fg-primary)]">
            {assetLabel(asset)}
          </span>
        </span>
      </button>
    </li>
  );
}

export function Sidebar({ projectRef }: { projectRef?: string }) {
  const { setSelectedLayerIds, applyCommands, toggleLayerVisibility, toggleLayerLock } = useEditorActions();
  const document = useEditorDocument();
  const selectedLayerIds = useEditorSelection();
  const hiddenLayerIds = useEditorVisibility();
  const lockedLayerIds = useEditorLocks();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [workspaceAssets, setWorkspaceAssets] = useState<WorkspaceAsset[]>([]);
  const [assetPickerLoading, setAssetPickerLoading] = useState(false);
  const [assetPickerError, setAssetPickerError] = useState<string | null>(null);
  const [uploadingAssetName, setUploadingAssetName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const displayLayers = useMemo(
    () => buildLayerTree(document.layers),
    [document.layers],
  );

  const onUpload = async (event: ChangeEvent<HTMLInputElement>) => {
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
          const uploadedAsset = assets.find((asset) => asset.id === session?.assetId);
          const protocolAsset = uploadedAsset
            ? workspaceAssetToProtocolAsset(uploadedAsset)
            : null;
          if (!uploadedAsset || !protocolAsset) {
            throw new Error("Uploaded asset is not available in the workspace");
          }

          setWorkspaceAssets((current) => [
            uploadedAsset,
            ...current.filter((asset) => asset.id !== uploadedAsset.id),
          ]);
          if (!document.assets.some((asset) => asset.id === protocolAsset.id)) {
            const applied = applyCommands([{ type: "add-asset", asset: protocolAsset }]);
            if (!applied) {
              throw new Error("The asset could not be imported into the current project");
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
  };

  const onChooseAsset = async () => {
    setAssetPickerOpen((open) => !open);
    if (workspaceAssets.length > 0 || assetPickerLoading) return;
    setAssetPickerLoading(true);
    setAssetPickerError(null);
    try {
      setWorkspaceAssets(await listAssets());
    } catch (error) {
      setAssetPickerError(error instanceof Error ? error.message : "Unable to load workspace assets");
    } finally {
      setAssetPickerLoading(false);
    }
  };

  const onSelectWorkspaceAsset = async (asset: WorkspaceAsset) => {
    const protocolAsset = workspaceAssetToProtocolAsset(asset);
    if (!protocolAsset) return;
    if (!document.assets.some((candidate) => candidate.id === protocolAsset.id)) {
      const applied = applyCommands([{ type: "add-asset", asset: protocolAsset }]);
      if (!applied) {
        setAssetPickerError("The asset could not be imported into the current project");
        return;
      }
    }
    if (projectRef) {
      try {
        await attachProjectAsset({ projectRef, assetId: asset.id });
      } catch (error) {
        setAssetPickerError(
          error instanceof Error ? error.message : "Unable to attach asset to project",
        );
        return;
      }
    }
    setAssetPickerOpen(false);
  };

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
              content: (
                <div
                  className="h-full overflow-auto p-2"
                  data-testid="layers-panel"
                >
                  <div className="mb-2 flex items-center justify-between px-1 text-[10px] uppercase tracking-[0.08em] text-[var(--fg-muted)]">
                    <span>Root Layers</span>
                    <span>{displayLayers.length}</span>
                  </div>
                  <ul className="space-y-1">
                    {displayLayers.map(({ layer, depth }) => {
                      const selected = selectedLayerIds.includes(layer.id);
                      const hidden = hiddenLayerIds.includes(layer.id);
                      const locked = lockedLayerIds.includes(layer.id);
                      const stopLayerSelection = (event: SyntheticEvent) => {
                        event.preventDefault();
                        event.stopPropagation();
                      };
                      return (
                        <li key={layer.id}>
                          <button
                            type="button"
                            onClick={(event) =>
                              setSelectedLayerIds((previous) =>
                                updateKeyboardSelection(
                                  displayLayers.map((entry) => entry.layer.id),
                                  previous,
                                  layer.id,
                                  {
                                    shiftKey: event.shiftKey,
                                    additiveKey: event.metaKey || event.ctrlKey,
                                  },
                                ),
                              )
                            }
                            className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors ${selected ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]" : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--fg-primary)] hover:bg-[var(--bg-hover)]"}`}
                            style={{ paddingLeft: `${10 + depth * 14}px` }}
                            data-layer-id={layer.id}
                            data-layer-order={layer.order}
                          >
                            <LayerIcon layer={layer} />
                            <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                              {layer.id}
                            </span>
                            <span className="flex shrink-0 items-center gap-4">
                              <span
                                role="button"
                                tabIndex={0}
                                aria-label={
                                  hidden
                                    ? `Show ${layer.id}`
                                    : `Hide ${layer.id}`
                                }
                                aria-pressed={hidden}
                                className="flex h-5 w-5 items-center justify-center rounded-sm text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
                                onPointerDown={(event) => {
                                  stopLayerSelection(event);
                                  toggleLayerVisibility(layer.id);
                                }}
                                onClick={stopLayerSelection}
                                onKeyDown={(event) => {
                                  if (
                                    event.key !== "Enter" &&
                                    event.key !== " "
                                  )
                                    return;
                                  stopLayerSelection(event);
                                  toggleLayerVisibility(layer.id);
                                }}
                              >
                                {hidden ? (
                                  <EyeOff size={14} strokeWidth={1.8} />
                                ) : (
                                  <Eye size={14} strokeWidth={1.8} />
                                )}
                              </span>
                              <span
                                role="button"
                                tabIndex={0}
                                aria-label={
                                  locked
                                    ? `Unlock ${layer.id}`
                                    : `Lock ${layer.id}`
                                }
                                aria-pressed={locked}
                                className="flex h-5 w-5 items-center justify-center rounded-sm text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
                                onPointerDown={(event) => {
                                  stopLayerSelection(event);
                                  toggleLayerLock(layer.id);
                                }}
                                onClick={stopLayerSelection}
                                onKeyDown={(event) => {
                                  if (
                                    event.key !== "Enter" &&
                                    event.key !== " "
                                  )
                                    return;
                                  stopLayerSelection(event);
                                  toggleLayerLock(layer.id);
                                }}
                              >
                                {locked ? (
                                  <Lock size={14} strokeWidth={1.8} />
                                ) : (
                                  <Unlock size={14} strokeWidth={1.8} />
                                )}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ),
            },
            {
              id: "assets",
              label: "Assets",
              content: (
                <div
                  className="flex h-full min-h-0 flex-col overflow-auto p-3"
                  data-testid="assets-panel"
                >
                  <input
                    ref={uploadRef}
                    type="file"
                    accept="image/*,video/*,audio/*"
                    multiple
                    className="hidden"
                    onChange={onUpload}
                  />
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-[12px] text-[var(--fg-secondary)]"
                      onClick={() => void onChooseAsset()}
                      disabled={Boolean(uploadingAssetName)}
                      aria-expanded={assetPickerOpen}
                      data-testid="asset-choose-button"
                    >
                      <FolderOpen size={14} strokeWidth={1.8} /> Choose asset
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-[12px] text-[var(--fg-secondary)]"
                      onClick={() => uploadRef.current?.click()}
                      disabled={Boolean(uploadingAssetName)}
                      aria-busy={Boolean(uploadingAssetName)}
                      data-testid="asset-upload-button"
                    >
                      <Upload size={14} strokeWidth={1.8} /> {uploadingAssetName ? "Uploading…" : "Upload"}
                    </Button>
                  </div>
                  {uploadError ? (
                    <div
                      className="mb-3 rounded-md border border-red-400/30 bg-red-400/10 px-2.5 py-2 text-[12px] text-red-200"
                      role="alert"
                    >
                      {uploadError}
                    </div>
                  ) : null}
                  {assetPickerOpen ? (
                    <div className="mb-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2">
                      <div className="mb-2 flex items-center justify-between px-1 text-[10px] uppercase tracking-[0.08em] text-[var(--fg-muted)]">
                        <span>Workspace assets</span>
                        {workspaceAssets.length > 0 ? <span>{workspaceAssets.length}</span> : null}
                      </div>
                      {assetPickerLoading ? (
                        <div className="px-1 py-3 text-[12px] text-[var(--fg-muted)]">Loading assets…</div>
                      ) : assetPickerError ? (
                        <div className="px-1 py-3 text-[12px] text-red-300">{assetPickerError}</div>
                      ) : workspaceAssets.length === 0 ? (
                        <div className="px-1 py-3 text-[12px] text-[var(--fg-muted)]">No workspace assets.</div>
                      ) : (
                        <ul className="max-h-48 space-y-1 overflow-auto">
                          {workspaceAssets.map((asset) => {
                            const protocolAsset = workspaceAssetToProtocolAsset(asset);
                            if (!protocolAsset) return null;
                            const alreadyAdded = document.assets.some((candidate) => candidate.id === protocolAsset.id);
                            return (
                              <li key={asset.id}>
                                <button
                                  type="button"
                                  disabled={alreadyAdded}
                                  onClick={() => void onSelectWorkspaceAsset(asset)}
                                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-[var(--fg-primary)] hover:bg-[var(--bg-hover)] disabled:cursor-default disabled:opacity-45"
                                >
                                  <AssetIcon asset={protocolAsset} />
                                  <span className="min-w-0 flex-1 truncate">{asset.original_filename ?? asset.id}</span>
                                  {alreadyAdded ? <span className="text-[10px] text-[var(--fg-muted)]">Added</span> : null}
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
              ),
            },
            {
              id: "json",
              label: "JSON",
              content: (
                <pre className="h-full overflow-auto p-3 text-[11px] leading-relaxed text-[var(--fg-secondary)]">
                  {JSON.stringify(document, null, 2)}
                </pre>
              ),
            },
          ]}
        />
      </Panel>
    </aside>
  );
}
