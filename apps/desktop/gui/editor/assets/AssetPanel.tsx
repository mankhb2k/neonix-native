import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_FRAME_DURATION,
  type TimelineCommand,
} from "@motionvideo/editor-core";
import { DesktopIpcError, DesktopIpcErrorCode } from "../../../shared/ipc/errors";
import { commitLibraryPayload } from "../library/adapters/commit-library-payload";
import { useLibraryPointerGesture } from "../sidebar/shared/use-library-pointer-gesture";
import {
  appendAssetsToDocumentJson,
  listEnvelopeAssets,
  updateAssetUriInDocumentJson,
  type DocumentAssetEntry,
} from "./document-assets";
import type { AssetRepository } from "../../infrastructure/repositories/asset-repository";
import type { LibraryCommitPoint } from "../library/adapters/commit-library-payload";
import type { LibraryPayload } from "../library/model/library-payload";
import "./asset-panel.css";

type Props = {
  projectPath: string | null;
  documentJson: string;
  /** Prefer session-provided assets to avoid reparsing full JSON on every mutation. */
  assets?: DocumentAssetEntry[];
  assetsApi: AssetRepository;
  disabled?: boolean;
  onDocumentChange: (json: string) => void;
  /** Commit image/video library drops onto the timeline. */
  onExecuteTimeline?: (command: TimelineCommand, label: string) => void;
};

function mediaPayload(
  asset: DocumentAssetEntry,
): Extract<LibraryPayload, { kind: "image" | "video" }> | null {
  if (asset.assetType !== "image" && asset.assetType !== "video") return null;
  const label = asset.uri.split("/").pop() ?? asset.id;
  const duration =
    typeof asset.duration === "number" && asset.duration > 0
      ? asset.duration
      : DEFAULT_FRAME_DURATION;
  if (asset.assetType === "image") {
    return {
      kind: "image",
      id: asset.id,
      label,
      assetId: asset.id,
      uri: asset.uri,
      duration,
    };
  }
  return {
    kind: "video",
    id: asset.id,
    label,
    assetId: asset.id,
    uri: asset.uri,
    duration,
  };
}

function MediaAssetRow({
  asset,
  missing,
  preview,
  canEdit,
  onRelink,
  onCommit,
}: {
  asset: DocumentAssetEntry;
  missing: boolean;
  preview?: string;
  canEdit: boolean;
  onRelink: (assetId: string) => void;
  onCommit?: (payload: LibraryPayload, point: LibraryCommitPoint) => void;
}) {
  const payload = mediaPayload(asset);
  const draggable = Boolean(payload && onCommit && !missing);

  return (
    <li className="asset-panel__item">
      {draggable && payload && onCommit ? (
        <MediaDragHit payload={payload} preview={preview} onCommit={onCommit} />
      ) : (
        <div className="asset-panel__drag-hit">
          <AssetThumb preview={preview} assetType={asset.assetType} />
          <AssetMeta asset={asset} missing={missing} />
        </div>
      )}
      {missing && canEdit ? (
        <button
          type="button"
          className="btn"
          onClick={() => void onRelink(asset.id)}
        >
          Relink…
        </button>
      ) : null}
    </li>
  );
}

function MediaDragHit({
  payload,
  preview,
  onCommit,
}: {
  payload: Extract<LibraryPayload, { kind: "image" | "video" }>;
  preview?: string;
  onCommit: (payload: LibraryPayload, point: LibraryCommitPoint) => void;
}) {
  const { onPointerDown, onKeyDown } = useLibraryPointerGesture(payload, onCommit);
  return (
    <button
      type="button"
      className="asset-panel__drag-hit"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      title="Drag to timeline or click to add"
    >
      <AssetThumb preview={preview} assetType={payload.kind} />
      <div className="asset-panel__meta">
        <div className="asset-panel__name" title={payload.label}>
          {payload.label}
        </div>
        <div className="asset-panel__sub">{payload.kind}</div>
      </div>
    </button>
  );
}

function AssetThumb({
  preview,
  assetType,
}: {
  preview?: string;
  assetType: string;
}) {
  return (
    <div className="asset-panel__thumb">
      {preview ? (
        <img src={preview} alt="" />
      ) : (
        <span className="asset-panel__thumb-fallback">
          {String(assetType).slice(0, 1).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function AssetMeta({
  asset,
  missing,
}: {
  asset: DocumentAssetEntry;
  missing: boolean;
}) {
  return (
    <div className="asset-panel__meta">
      <div className="asset-panel__name" title={asset.uri}>
        {asset.uri.split("/").pop() ?? asset.uri}
      </div>
      <div className="asset-panel__sub">
        {asset.assetType}
        {missing ? <span className="asset-panel__badge">Missing</span> : null}
      </div>
    </div>
  );
}

function assetManifestKey(assets: DocumentAssetEntry[]): string {
  return assets
    .map((a) => `${a.id}\0${a.uri}\0${a.assetType}`)
    .sort()
    .join("|");
}

export function AssetPanel({
  projectPath,
  documentJson,
  assets: assetsProp,
  assetsApi,
  disabled,
  onDocumentChange,
  onExecuteTimeline,
}: Props) {
  const assetsFromJson = useMemo(
    () => (assetsProp ? null : listEnvelopeAssets(documentJson)),
    [assetsProp, documentJson],
  );
  const assets = useMemo(
    () => assetsProp ?? assetsFromJson ?? [],
    [assetsProp, assetsFromJson],
  );
  const manifestKey = useMemo(() => assetManifestKey(assets), [assets]);
  const stableAssetsRef = useRef(assets);
  const prevManifestKeyRef = useRef(manifestKey);
  if (prevManifestKeyRef.current !== manifestKey) {
    prevManifestKeyRef.current = manifestKey;
    stableAssetsRef.current = assets;
  }
  const stableAssets = stableAssetsRef.current;
  const documentJsonRef = useRef(documentJson);
  documentJsonRef.current = documentJson;

  const [missingIds, setMissingIds] = useState<Set<string>>(new Set());
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewCacheRef = useRef<Record<string, string>>({});

  const saved = Boolean(projectPath);
  const canEdit = saved && !disabled && !busy;

  useEffect(() => {
    let cancelled = false;
    async function refreshMissingAndPreviews() {
      if (!projectPath) {
        setMissingIds(new Set());
        setPreviews({});
        previewCacheRef.current = {};
        return;
      }
      const entries = stableAssets.map((a) => ({
        id: a.id,
        uri: a.uri,
        assetType: a.assetType,
      }));
      if (entries.length === 0) {
        setMissingIds(new Set());
        setPreviews({});
        previewCacheRef.current = {};
        return;
      }
      try {
        const { missing } = await assetsApi.listMissing({
          assets: entries.map(({ id, uri }) => ({ id, uri })),
        });
        if (cancelled) return;
        const missingSet = new Set(missing.map((m) => m.id));
        setMissingIds(missingSet);

        const nextPreviews: Record<string, string> = {};
        await Promise.all(
          entries.map(async (entry) => {
            if (missingSet.has(entry.id)) return;
            if (entry.assetType !== "image") return;
            const cacheKey = `${entry.id}:${entry.uri}`;
            const cached = previewCacheRef.current[cacheKey];
            if (cached) {
              nextPreviews[entry.id] = cached;
              return;
            }
            try {
              const resolved = await assetsApi.resolveUrl({
                assetId: entry.id,
                uri: entry.uri,
              });
              previewCacheRef.current[cacheKey] = resolved.url;
              nextPreviews[entry.id] = resolved.url;
            } catch {
              /* ignore preview failures */
            }
          }),
        );
        if (!cancelled) setPreviews(nextPreviews);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }
    void refreshMissingAndPreviews();
    return () => {
      cancelled = true;
    };
  }, [assetsApi, manifestKey, projectPath]);

  async function handleImport() {
    if (!projectPath) return;
    setBusy(true);
    setError(null);
    try {
      const imported = await assetsApi.importFiles();
      if (imported.length === 0) return;
      onDocumentChange(
        appendAssetsToDocumentJson(documentJsonRef.current, imported),
      );
    } catch (err) {
      if (
        err instanceof DesktopIpcError &&
        err.code === DesktopIpcErrorCode.CANCELLED
      ) {
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRelink(assetId: string) {
    if (!projectPath) return;
    setBusy(true);
    setError(null);
    try {
      const result = await assetsApi.relink({ assetId });
      onDocumentChange(
        updateAssetUriInDocumentJson(documentJsonRef.current, assetId, {
          uri: result.uri,
          assetType: result.assetType,
          mimeType: result.mimeType,
          width: result.width,
          height: result.height,
          duration: result.duration,
        }),
      );
    } catch (err) {
      if (
        err instanceof DesktopIpcError &&
        err.code === DesktopIpcErrorCode.CANCELLED
      ) {
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="asset-panel" aria-label="Project assets">
      <div className="asset-panel__header">
        <h2 className="asset-panel__title">Assets</h2>
        <button
          type="button"
          className="btn"
          disabled={!canEdit}
          onClick={() => void handleImport()}
          title={
            saved ? "Import media into project/assets" : "Save project first"
          }
        >
          Import…
        </button>
      </div>

      {!saved ? (
        <p className="asset-panel__hint">Save the project before importing media.</p>
      ) : null}

      {error ? (
        <p className="asset-panel__error" role="alert">
          {error}
        </p>
      ) : null}

      {stableAssets.length === 0 ? (
        <p className="asset-panel__empty">No assets yet.</p>
      ) : (
        <ul className="asset-panel__list">
          {stableAssets.map((asset) => (
            <MediaAssetRow
              key={asset.id}
              asset={asset}
              missing={missingIds.has(asset.id)}
              preview={previews[asset.id]}
              canEdit={canEdit}
              onRelink={(id) => void handleRelink(id)}
              onCommit={
                onExecuteTimeline
                  ? (payload, point) => {
                      commitLibraryPayload(payload, point, onExecuteTimeline);
                    }
                  : undefined
              }
            />
          ))}
        </ul>
      )}
    </aside>
  );
}
