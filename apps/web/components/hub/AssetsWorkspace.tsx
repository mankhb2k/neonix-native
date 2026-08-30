"use client";

import {
  FileAudio,
  FileImage,
  FileVideo,
  File as FileIcon,
  Grid2X2,
  List,
  LoaderCircle,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  completeAssetUpload,
  createAssetUpload,
  deleteAsset as deleteAssetRequest,
  listAssets,
  uploadAssetPreview,
  uploadAssetBytes,
  type Asset,
} from "@/lib/api/assets";
import { createBrowserVideoPreview } from "@/lib/media/browser-preview";

type ViewMode = "list" | "grid";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (mimeType.startsWith("audio/")) return FileAudio;
  return FileIcon;
}

function AssetPreview({
  asset,
  variant,
  onDuration,
}: {
  asset: Asset;
  variant: "list" | "card";
  onDuration?: (duration: number) => void;
}) {
  const [failed, setFailed] = useState(false);
  const Icon = fileIcon(asset.mime_type);
  const canPreview = asset.status === "ready" && Boolean(asset.download_url);
  const isImage = asset.mime_type.startsWith("image/");
  const isVideo = asset.mime_type.startsWith("video/");

  if (!canPreview || failed || (!isImage && !isVideo)) {
    return <Icon className={variant === "card" ? "size-9" : "size-5"} />;
  }

  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={asset.download_url ?? undefined}
        alt={asset.original_filename ?? "Asset preview"}
        onError={() => setFailed(true)}
        className={variant === "card" ? "h-full w-full object-cover" : "size-10 rounded-lg object-cover"}
      />
    );
  }

  return (
    <video
      src={asset.download_url ?? undefined}
      controls
      preload="metadata"
      onError={() => setFailed(true)}
      onLoadedMetadata={(event) => {
        const duration = event.currentTarget.duration;
        if (Number.isFinite(duration)) onDuration?.(duration);
      }}
      className={variant === "card" ? "h-full w-full object-contain" : "h-10 w-16 rounded-lg object-cover"}
    />
  );
}

function MediaDurationProbe({
  asset,
  onDuration,
}: {
  asset: Asset;
  onDuration: (assetId: string, duration: number) => void;
}) {
  const mediaRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !asset.download_url) return undefined;
    const element = media;

    function handleLoadedMetadata() {
      if (Number.isFinite(element.duration)) onDuration(asset.id, element.duration);
    }

    element.addEventListener("loadedmetadata", handleLoadedMetadata);
    element.load();
    return () => element.removeEventListener("loadedmetadata", handleLoadedMetadata);
  }, [asset.download_url, asset.id, onDuration]);

  return <audio ref={mediaRef} src={asset.download_url ?? undefined} preload="metadata" className="sr-only" aria-hidden="true" />;
}

function formatDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  const paddedSeconds = String(remainingSeconds).padStart(2, "0");

  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}` : `${minutes}:${paddedSeconds}`;
}

function AssetMeta({ asset, duration }: { asset: Asset; duration?: number }) {
  return (
    <p className="mt-1 font-mono text-caption text-[var(--fg-muted)]">
      {formatBytes(asset.byte_size)}
      <span aria-hidden="true"> · </span>
      {asset.mime_type.startsWith("video/") || asset.mime_type.startsWith("audio/") ? (
        <>
          {duration !== undefined ? formatDuration(duration) : "—"}
          <span aria-hidden="true"> · </span>
        </>
      ) : null}
      {asset.status !== "ready"
        ? "Uploading"
        : asset.mime_type.startsWith("video/") && asset.preview_status === "pending"
          ? "Preparing media"
          : asset.mime_type.startsWith("video/") && asset.preview_status === "failed"
            ? "Preview unavailable"
            : "Ready"}
    </p>
  );
}

function AssetActions({ asset, onDelete }: { asset: Asset; onDelete: (id: string) => void }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {asset.download_url ? (
        <a
          href={asset.download_url}
          target="_blank"
          rel="noreferrer"
          className="text-caption font-medium text-[var(--hub-accent)] no-underline hover:underline"
        >
          Download
        </a>
      ) : null}
      <button
        type="button"
        aria-label={`Delete ${asset.original_filename ?? "asset"}`}
        onClick={() => onDelete(asset.id)}
        className="rounded-md p-2 text-[var(--fg-muted)] transition hover:bg-red-500/10 hover:text-red-600"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

export function AssetsWorkspace() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [durations, setDurations] = useState<Record<string, number>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDuration = useCallback((assetId: string, duration: number) => {
    setDurations((current) => (current[assetId] === duration ? current : { ...current, [assetId]: duration }));
  }, []);

  const loadAssets = useCallback(async () => {
    setAssets(await listAssets());
  }, []);

  useEffect(() => {
    loadAssets()
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load assets"))
      .finally(() => setLoading(false));
  }, [loadAssets]);

  useEffect(() => {
    function reloadAfterDemoAuth() {
      setLoading(true);
      setError(null);
      loadAssets()
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load assets"))
        .finally(() => setLoading(false));
    }

    window.addEventListener("neonix:dev-demo-authenticated", reloadAfterDemoAuth);
    return () => window.removeEventListener("neonix:dev-demo-authenticated", reloadAfterDemoAuth);
  }, [loadAssets]);

  useEffect(() => {
    const hasPendingMedia = assets.some((asset) => asset.mime_type.startsWith("video/") && asset.preview_status === "pending");
    if (!hasPendingMedia) return undefined;
    const timer = window.setInterval(() => {
      loadAssets().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to refresh assets"));
    }, 2000);
    return () => window.clearInterval(timer);
  }, [assets, loadAssets]);

  async function uploadFile(file: File) {
    setError(null);
    setUploading(file.name);
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
      if (browserPreview?.poster) await uploadAssetPreview(session, browserPreview.poster);
      await completeAssetUpload(session.assetId);
      completed = true;
      await loadAssets();
    } catch (reason) {
      if (session && !completed) {
        try {
          await deleteAssetRequest(session.assetId);
        } catch {
          // Keep the original upload error visible if cleanup also fails.
        }
      }
      setError(reason instanceof Error ? reason.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  async function deleteAsset(assetId: string) {
    setError(null);
    try {
      await deleteAssetRequest(assetId);
      setAssets((current) => current.filter((asset) => asset.id !== assetId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Delete failed");
    }
  }

  const normalizedSearch = search.trim().toLowerCase();
  const visibleAssets = normalizedSearch
    ? assets.filter((asset) => (asset.original_filename ?? asset.id).toLowerCase().includes(normalizedSearch))
    : assets;

  return (
    <div>
      {assets
        .filter((asset) => asset.mime_type.startsWith("audio/") && asset.status === "ready" && asset.download_url)
        .map((asset) => (
          <MediaDurationProbe
            key={asset.id}
            asset={asset}
            onDuration={handleDuration}
          />
        ))}
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-caption font-semibold tracking-[0.16em] text-[var(--hub-accent)] uppercase">
            Workspace library
          </p>
          <h1 className="m-0 text-3xl font-semibold tracking-[-0.04em] text-[var(--fg-primary)] sm:text-4xl">
            Assets
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--fg-muted)]">
            Upload media to R2 and reuse it across your Neonix projects.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--hub-accent)] px-4 py-2.5 text-body font-semibold text-[var(--hub-accent-on)] transition hover:bg-[var(--hub-accent-hover)]">
          {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
          {uploading ? "Uploading..." : "Upload asset"}
          <input
            type="file"
            className="sr-only"
            disabled={Boolean(uploading)}
            accept="image/*,video/*,audio/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (inputRef.current) inputRef.current.value = "";
              if (file) void uploadFile(file);
            }}
            ref={inputRef}
          />
        </label>
      </div>

      <div className="mt-8 flex flex-col gap-3 border-b border-[var(--hub-border)] pb-3 sm:flex-row sm:items-center">
        <label className="relative block min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--fg-disabled)]" />
          <span className="sr-only">Search assets</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search assets"
            className="h-10 w-full rounded-lg border border-[var(--hub-border)] bg-[var(--hub-card-bg)] pl-9 pr-3 text-body text-[var(--fg-primary)] outline-none placeholder:text-[var(--fg-disabled)] focus:border-[var(--hub-accent)]"
          />
        </label>
        <span className="text-caption text-[var(--fg-muted)]">
          {visibleAssets.length} {visibleAssets.length === 1 ? "file" : "files"}
        </span>
        <div className="flex items-center gap-1 sm:ml-auto" aria-label="Asset view">
          <button
            type="button"
            aria-label="List view"
            aria-pressed={viewMode === "list"}
            onClick={() => setViewMode("list")}
            className={`rounded-md p-2 transition ${viewMode === "list" ? "bg-[var(--hub-active)] text-[var(--fg-primary)]" : "text-[var(--fg-muted)] hover:bg-[var(--hub-hover)] hover:text-[var(--fg-primary)]"}`}
          >
            <List className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Card view"
            aria-pressed={viewMode === "grid"}
            onClick={() => setViewMode("grid")}
            className={`rounded-md p-2 transition ${viewMode === "grid" ? "bg-[var(--hub-active)] text-[var(--fg-primary)]" : "text-[var(--fg-muted)] hover:bg-[var(--hub-hover)] hover:text-[var(--fg-primary)]"}`}
          >
            <Grid2X2 className="size-4" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-body text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] px-5 py-16 text-body text-[var(--fg-muted)]">
          <LoaderCircle className="size-4 animate-spin" /> Loading assets...
        </div>
      ) : visibleAssets.length === 0 ? (
        <div className="mt-6 flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--hub-border)] bg-[var(--hub-card-bg)] px-6 py-14 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--hub-accent)]">
            <UploadCloud className="size-5" />
          </span>
          <p className="mt-4 text-body font-semibold text-[var(--fg-primary)]">
            {normalizedSearch ? "No matching assets" : "No assets yet"}
          </p>
          <p className="mt-1 max-w-sm text-caption text-[var(--fg-muted)]">
            {normalizedSearch ? "Try a different search term." : "Upload an image, video, or audio file to get started."}
          </p>
        </div>
      ) : viewMode === "list" ? (
        <div className="mt-6 overflow-hidden rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)]">
          <div className="divide-y divide-[var(--hub-divider)]">
            {visibleAssets.map((asset) => {
              return (
                <div key={asset.id} className="flex items-center gap-4 px-5 py-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--hub-hover)] text-[var(--hub-accent)]">
                    <AssetPreview
                      asset={asset}
                      variant="list"
                      onDuration={(duration) => handleDuration(asset.id, duration)}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-medium text-[var(--fg-primary)]">{asset.original_filename ?? asset.id}</p>
                    <AssetMeta asset={asset} duration={durations[asset.id]} />
                  </div>
                  <AssetActions asset={asset} onDelete={(id) => void deleteAsset(id)} />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visibleAssets.map((asset) => {
            return (
              <article key={asset.id} className="overflow-hidden rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] transition hover:border-[color-mix(in_srgb,var(--hub-accent)_40%,transparent)]">
                <div className="flex aspect-square items-center justify-center overflow-hidden bg-[var(--hub-hover)] text-[var(--hub-accent)]">
                  <AssetPreview
                    asset={asset}
                    variant="card"
                    onDuration={(duration) => handleDuration(asset.id, duration)}
                  />
                </div>
                <div className="space-y-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-body font-medium text-[var(--fg-primary)]">{asset.original_filename ?? asset.id}</p>
                    <AssetMeta asset={asset} duration={durations[asset.id]} />
                  </div>
                  <AssetActions asset={asset} onDelete={(id) => void deleteAsset(id)} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
