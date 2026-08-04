import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_FRAME_DURATION,
  type TimelineCommand,
} from "@motionvideo/editor-core";
import { DesktopIpcError, DesktopIpcErrorCode } from "../../../../shared/ipc/errors";
import { commitLibraryPayload } from "../../library/adapters/commit-library-payload";
import { useLibraryPointerGesture } from "../../library/hooks/use-library-pointer-gesture";
import {
  appendAssetsToDocumentJson,
  listEnvelopeAssets,
  updateAssetUriInDocumentJson,
  type DocumentAssetEntry,
} from "../../assets/document-assets";
import type { AssetRepository } from "../../../infrastructure/repositories/asset-repository";
import type { LibraryCommitPoint } from "../../library/adapters/commit-library-payload";
import type { LibraryPayload } from "../../library/model/library-payload";
import { PresetTile } from "../../../ui";

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
): LibraryPayload | null {
  const label = asset.uri.split("/").pop() ?? asset.id;
  const duration =
    typeof asset.duration === "number" && asset.duration > 0
      ? asset.duration
      : DEFAULT_FRAME_DURATION;
  if (asset.assetType === "audio") {
    return {
      kind: "audio",
      id: asset.id,
      label,
      assetId: asset.id,
      uri: asset.uri,
      duration,
    };
  }
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

  return (
    <div className="flex flex-col w-[118px]">
      {payload && onCommit && !missing ? (
        <MediaDragHit payload={payload} preview={preview} onCommit={onCommit} />
      ) : (
        <MediaFallbackCard asset={asset} missing={missing} preview={preview} />
      )}
      {missing && canEdit ? (
        <button
          type="button"
          className="mt-1 text-[10px] text-cyan-400 hover:underline text-left font-medium"
          onClick={() => void onRelink(asset.id)}
        >
          Relink…
        </button>
      ) : null}
    </div>
  );
}

function MediaDragHit({
  payload,
  preview,
  onCommit,
}: {
  payload: LibraryPayload;
  preview?: string;
  onCommit: (payload: LibraryPayload, point: LibraryCommitPoint) => void;
}) {
  const { onPointerDown, onKeyDown } = useLibraryPointerGesture(payload, onCommit);

  const duration =
    "duration" in payload && typeof payload.duration === "number"
      ? payload.duration
      : 0;
  const formattedTime =
    duration >= 60
      ? `${Math.floor(duration / 60).toString().padStart(2, "0")}:${Math.floor(duration % 60)
          .toString()
          .padStart(2, "0")}`
      : `00:${Math.floor(duration).toString().padStart(2, "0")}`;

  const isAudio = payload.kind === "audio";

  return (
    <div className="flex flex-col w-[118px]">
      <PresetTile
        aspect="landscape"
        title={payload.label}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
      >
        {isAudio ? (
          <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-b from-[#1b3a58] to-[#0d2238] px-2">
            <div className="flex h-full w-full items-center justify-between gap-[2px] py-3 opacity-85">
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[2px] rounded-full bg-cyan-400"
                  style={{
                    height: `${20 + Math.sin(i * 0.8) * 60}%`,
                  }}
                />
              ))}
            </div>
          </div>
        ) : preview || ("uri" in payload && payload.uri) ? (
          <img
            src={preview || ("uri" in payload ? payload.uri : "")}
            alt={payload.label}
            className="h-full w-full object-cover rounded-xl pointer-events-none select-none"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#27272a] text-[10px] text-zinc-400">
            {payload.kind.toUpperCase()}
          </div>
        )}

        {/* Top-Left Badge */}
        {!isAudio && (
          <span className="absolute top-1 left-1 rounded bg-black/60 px-1 py-0.5 font-sans text-[9px] font-semibold text-zinc-100 backdrop-blur-sm">
            Added
          </span>
        )}

        {/* Top-Right Duration Timestamp */}
        <span className="absolute top-1 right-1 font-mono text-[10px] font-semibold text-zinc-100 drop-shadow">
          {formattedTime}
        </span>
      </PresetTile>

      {/* Subtitle Filename */}
      <span
        className="truncate text-[11px] font-medium text-zinc-400 hover:text-zinc-200 select-none px-0.5 mt-1"
        title={payload.label}
      >
        {payload.label}
      </span>
    </div>
  );
}

function MediaFallbackCard({
  asset,
  missing,
  preview,
}: {
  asset: DocumentAssetEntry;
  missing: boolean;
  preview?: string;
}) {
  const fileName = asset.uri.split("/").pop() ?? asset.id;
  const isAudio = asset.assetType === "audio";

  return (
    <div className="flex flex-col w-[118px]">
      <PresetTile aspect="landscape" title={fileName} disabled>
        {isAudio ? (
          <div className="relative flex h-full w-full items-center justify-center bg-gradient-to-b from-[#1b3a58] to-[#0d2238] px-2 opacity-60">
            <div className="flex h-full w-full items-center justify-between gap-[2px] py-3">
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[2px] rounded-full bg-cyan-400"
                  style={{
                    height: `${20 + Math.sin(i * 0.8) * 60}%`,
                  }}
                />
              ))}
            </div>
          </div>
        ) : preview ? (
          <img
            src={preview}
            alt={fileName}
            className="h-full w-full object-cover rounded-xl opacity-60"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#27272a] text-[10px] text-zinc-500">
            {asset.assetType.toUpperCase()}
          </div>
        )}

        {missing && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] font-semibold text-red-400">
            Missing
          </span>
        )}
      </PresetTile>

      <span
        className="truncate text-[11px] font-medium text-zinc-400 select-none px-0.5 mt-1"
        title={fileName}
      >
        {fileName}
      </span>
    </div>
  );
}

function assetManifestKey(assets: DocumentAssetEntry[]): string {
  return assets
    .map((a) => `${a.id}\0${a.uri}\0${a.assetType}`)
    .sort()
    .join("|");
}

export function MediaPanel({
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
    <aside
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-panel)] p-3 gap-3"
      aria-label="Project assets"
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-full bg-[#27272a] px-3.5 py-1.5 text-[12px] font-semibold text-zinc-100 hover:bg-[#323236] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!canEdit}
          onClick={() => void handleImport()}
          title={
            saved ? "Import media into project/assets" : "Save project first"
          }
        >
          <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-cyan-400 text-[11px] font-extrabold text-zinc-950 leading-none pb-[1px]">
            +
          </div>
          <span>Import</span>
        </button>

        {error ? (
          <span className="text-[11px] font-medium text-red-400 truncate max-w-[200px]" role="alert">
            {error}
          </span>
        ) : !saved ? (
          <span className="text-[11px] font-medium text-zinc-400 truncate max-w-[200px]">
            Save project first
          </span>
        ) : null}
      </div>

      {stableAssets.length === 0 ? (
        <p className="text-[11px] text-zinc-500">No assets yet.</p>
      ) : (
        <div className="flex-1 overflow-y-auto flex flex-wrap gap-3 p-1 content-start">
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
        </div>
      )}
    </aside>
  );
}
