import { useEffect, useState } from "react";
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

export function AssetPanel({
  projectPath,
  documentJson,
  assetsApi,
  disabled,
  onDocumentChange,
}: Props) {
  const [assets, setAssets] = useState<DocumentAssetEntry[]>([]);
  const [missingIds, setMissingIds] = useState<Set<string>>(new Set());
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saved = Boolean(projectPath);
  const canEdit = saved && !disabled && !busy;

  useEffect(() => {
    setAssets(listEnvelopeAssets(documentJson));
  }, [documentJson]);

  useEffect(() => {
    let cancelled = false;
    async function refreshMissingAndPreviews() {
      if (!projectPath) {
        setMissingIds(new Set());
        setPreviews({});
        return;
      }
      const entries = listEnvelopeAssets(documentJson).map((a) => ({
        id: a.id,
        uri: a.uri,
      }));
      if (entries.length === 0) {
        setMissingIds(new Set());
        setPreviews({});
        return;
      }
      try {
        const { missing } = await assetsApi.listMissing({
          projectPath,
          assets: entries,
        });
        if (cancelled) return;
        const missingSet = new Set(missing.map((m) => m.id));
        setMissingIds(missingSet);

        const nextPreviews: Record<string, string> = {};
        await Promise.all(
          entries.map(async (entry) => {
            if (missingSet.has(entry.id)) return;
            const row = listEnvelopeAssets(documentJson).find(
              (a) => a.id === entry.id,
            );
            if (!row || row.assetType !== "image") return;
            try {
              const resolved = await assetsApi.resolveUrl({
                projectPath,
                assetId: entry.id,
                uri: entry.uri,
              });
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
  }, [assetsApi, documentJson, projectPath]);

  async function handleImport() {
    if (!projectPath) return;
    setBusy(true);
    setError(null);
    try {
      const imported = await assetsApi.importFiles({ projectPath });
      if (imported.length === 0) return;
      onDocumentChange(appendAssetsToDocumentJson(documentJson, imported));
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
      const result = await assetsApi.relink({ projectPath, assetId });
      onDocumentChange(
        updateAssetUriInDocumentJson(documentJson, assetId, {
          uri: result.uri,
          assetType: result.assetType,
          mimeType: result.mimeType,
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

      {assets.length === 0 ? (
        <p className="asset-panel__empty">No assets yet.</p>
      ) : (
        <ul className="asset-panel__list">
          {assets.map((asset) => {
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
