import { useEffect, useMemo, useRef, useState } from "react";
import type { AssetRepository } from "../../infrastructure/repositories/asset-repository";
import {
  appendAssetsToDocumentJson,
  listEnvelopeAssets,
  updateAssetUriInDocumentJson,
  type DocumentAssetEntry,
} from "./document-assets";
import { DesktopIpcError, DesktopIpcErrorCode } from "../../../../src/shared/ipc/errors";
import "./asset-panel.css";

type Props = {
  projectPath: string | null;
  documentJson: string;
  assetsApi: AssetRepository;
  disabled?: boolean;
  onDocumentChange: (json: string) => void;
};

function assetManifestKey(assets: DocumentAssetEntry[]): string {
  return assets
    .map((a) => `${a.id}\0${a.uri}\0${a.assetType}`)
    .sort()
    .join("|");
}

export function AssetPanel({
  projectPath,
  documentJson,
  assetsApi,
  disabled,
  onDocumentChange,
}: Props) {
  const assets = useMemo(() => listEnvelopeAssets(documentJson), [documentJson]);
  const manifestKey = useMemo(() => assetManifestKey(assets), [assets]);
  // Recompute assets only when manifest (id+uri+type) changes — not every timeline edit.
  const stableAssets = useMemo(() => assets, [manifestKey]);
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
  }, [assetsApi, manifestKey, projectPath, stableAssets]);

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
          {stableAssets.map((asset) => {
            const missing = missingIds.has(asset.id);
            const preview = previews[asset.id];
            return (
              <li key={asset.id} className="asset-panel__item">
                <div className="asset-panel__thumb">
                  {preview ? (
                    <img src={preview} alt="" />
                  ) : (
                    <span className="asset-panel__thumb-fallback">
                      {String(asset.assetType).slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="asset-panel__meta">
                  <div className="asset-panel__name" title={asset.uri}>
                    {asset.uri.split("/").pop() ?? asset.uri}
                  </div>
                  <div className="asset-panel__sub">
                    {asset.assetType}
                    {missing ? (
                      <span className="asset-panel__badge">Missing</span>
                    ) : null}
                  </div>
                </div>
                {missing && canEdit ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void handleRelink(asset.id)}
                  >
                    Relink…
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
