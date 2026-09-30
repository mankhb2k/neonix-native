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
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import {
  completeAssetUpload,
  createAssetUpload,
  deleteAsset as deleteAssetRequest,
  getAssetUsage,
  listAssets,
  uploadAssetPreview,
  uploadAssetBytes,
  type Asset,
  type AssetUsageProject,
} from "@/lib/api/assets";
import { createFontUpload, completeFontUpload, deleteFont, listFonts, uploadFontBytes, type FontOption } from "@/lib/api/fonts";
import { createBrowserVideoPreview } from "@/lib/media/browser-preview";

type ViewMode = "list" | "grid";
type AssetTab = "assets" | "fonts";

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
  const t = useTranslations("AssetsWorkspace");
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
        ? t("meta.uploading")
        : asset.mime_type.startsWith("video/") && asset.preview_status === "pending"
          ? t("meta.preparingMedia")
          : asset.mime_type.startsWith("video/") && asset.preview_status === "failed"
            ? t("meta.previewUnavailable")
            : t("meta.ready")}
    </p>
  );
}

function AssetActions({
  asset,
  checking,
  onDelete,
}: {
  asset: Asset;
  checking: boolean;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations("AssetsWorkspace");
  return (
    <div className="flex shrink-0 items-center gap-2">
      {asset.download_url ? (
        <a
          href={asset.download_url}
          target="_blank"
          rel="noreferrer"
          className="text-caption font-medium text-[var(--hub-accent)] no-underline hover:underline"
        >
          {t("actions.download")}
        </a>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        disabled={checking}
        aria-label={t("actions.deleteAria", { name: asset.original_filename ?? t("actions.deleteAriaFallbackName") })}
        onClick={() => onDelete(asset.id)}
        className="size-9 hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] hover:text-[var(--danger)]"
      >
        {checking ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </Button>
    </div>
  );
}

function DeleteAssetDialog({
  asset,
  projects,
  deleting,
  onCancel,
  onConfirm,
}: {
  asset: Asset;
  projects: AssetUsageProject[];
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("AssetsWorkspace");
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = "delete-asset-dialog-title";
  const descriptionId = "delete-asset-dialog-description";
  const assetName = asset.original_filename ?? asset.id;

  useEffect(() => {
    cancelButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !deleting) onCancel();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [deleting, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-md rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] p-6 shadow-2xl"
      >
        <h2 id={titleId} className="m-0 text-lg font-semibold text-[var(--fg-primary)]">
          {t("deleteDialog.title")}
        </h2>
        <p id={descriptionId} className="mt-2 text-base leading-6 text-[var(--fg-muted)]">
          {t("deleteDialog.body", { name: assetName })}
        </p>
        {projects.length > 0 ? (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-base text-amber-800 dark:text-amber-200">
            <p className="font-semibold">
              {t("deleteDialog.usedByProjects", { count: projects.length })}
            </p>
            <p className="mt-1 leading-5">
              {t("deleteDialog.placeholderNote")}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {projects.slice(0, 5).map((project) => <li key={project.id}>{project.title}</li>)}
              {projects.length > 5 ? <li>{t("deleteDialog.andMore", { count: projects.length - 5 })}</li> : null}
            </ul>
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button
            ref={cancelButtonRef}
            variant="outline"
            size="lg"
            disabled={deleting}
            onClick={onCancel}
            className="px-3.5 text-base"
          >
            {t("deleteDialog.cancel")}
          </Button>
          <Button
            variant="danger"
            size="lg"
            disabled={deleting}
            onClick={onConfirm}
            className="gap-2 px-3.5 text-base font-semibold"
          >
            {deleting ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {deleting ? t("deleteDialog.deleting") : projects.length > 0 ? t("deleteDialog.deleteAndReplace") : t("deleteDialog.deleteAsset")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AssetsWorkspace() {
  const t = useTranslations("AssetsWorkspace");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [fonts, setFonts] = useState<FontOption[]>([]);
  const [activeTab, setActiveTab] = useState<AssetTab>("assets");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [pendingDelete, setPendingDelete] = useState<Asset | null>(null);
  const [deleteProjects, setDeleteProjects] = useState<AssetUsageProject[]>([]);
  const [checkingDeleteAssetId, setCheckingDeleteAssetId] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const deleteRequestIdRef = useRef(0);

  const handleDuration = useCallback((assetId: string, duration: number) => {
    setDurations((current) => (current[assetId] === duration ? current : { ...current, [assetId]: duration }));
  }, []);

  const loadAssets = useCallback(async () => {
    const [nextAssets, nextFonts] = await Promise.all([listAssets(), listFonts()]);
    setAssets(nextAssets);
    setFonts(nextFonts);
  }, []);

  useEffect(() => {
    loadAssets()
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : t("errors.loadAssets")))
      .finally(() => setLoading(false));
  }, [loadAssets, t]);

  useEffect(() => {
    function reloadAfterDemoAuth() {
      setLoading(true);
      setError(null);
      loadAssets()
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : t("errors.loadAssets")))
        .finally(() => setLoading(false));
    }

    window.addEventListener("neonix:dev-demo-authenticated", reloadAfterDemoAuth);
    return () => window.removeEventListener("neonix:dev-demo-authenticated", reloadAfterDemoAuth);
  }, [loadAssets, t]);

  useEffect(() => {
    const hasPendingMedia = assets.some((asset) => asset.mime_type.startsWith("video/") && asset.preview_status === "pending");
    if (!hasPendingMedia) return undefined;
    const timer = window.setInterval(() => {
      loadAssets().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : t("errors.refreshAssets")));
    }, 2000);
    return () => window.clearInterval(timer);
  }, [assets, loadAssets, t]);

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
      setError(reason instanceof Error ? reason.message : t("errors.uploadFailed"));
    } finally {
      setUploading(null);
    }
  }

  async function uploadFontFile(file: File) {
    setError(null);
    setUploading(file.name);
    let session: Awaited<ReturnType<typeof createFontUpload>> | null = null;
    try {
      session = await createFontUpload(file);
      await uploadFontBytes(session, file);
      await completeFontUpload(session.assetId);
      await loadAssets();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("errors.fontUploadFailed"));
    } finally {
      setUploading(null);
    }
  }

  const requestDeleteAsset = useCallback(async (assetId: string) => {
    const asset = assets.find((candidate) => candidate.id === assetId);
    if (!asset) return;
    const requestId = deleteRequestIdRef.current + 1;
    deleteRequestIdRef.current = requestId;
    setError(null);
    setCheckingDeleteAssetId(assetId);
    try {
      const projects = await getAssetUsage(assetId);
      if (deleteRequestIdRef.current !== requestId) return;
      setDeleteProjects(projects);
      setPendingDelete(asset);
    } catch (reason) {
      if (deleteRequestIdRef.current === requestId) {
        setError(reason instanceof Error ? reason.message : t("errors.checkUsage"));
      }
    } finally {
      if (deleteRequestIdRef.current === requestId) setCheckingDeleteAssetId(null);
    }
  }, [assets, t]);

  const deleteAsset = useCallback(async () => {
    if (!pendingDelete) return;
    const assetId = pendingDelete.id;
    setError(null);
    setDeletingAssetId(assetId);
    try {
      await deleteAssetRequest(assetId, { replaceReferences: true });
      setAssets((current) => current.filter((asset) => asset.id !== assetId));
      setPendingDelete(null);
      setDeleteProjects([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("errors.deleteFailed"));
      setPendingDelete(null);
      setDeleteProjects([]);
    } finally {
      setDeletingAssetId(null);
    }
  }, [pendingDelete, t]);

  const normalizedSearch = search.trim().toLowerCase();
  const visibleAssets = normalizedSearch
    ? assets.filter((asset) => (asset.original_filename ?? asset.id).toLowerCase().includes(normalizedSearch))
    : assets;
  const customFonts = fonts.filter((font) => font.source === "custom");
  const visibleFonts = normalizedSearch
    ? customFonts.filter((font) => `${font.familyName} ${font.subfamilyName} ${font.filename ?? ""}`.toLowerCase().includes(normalizedSearch))
    : customFonts;

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
            {t("eyebrow")}
          </p>
          <h1 className="m-0 text-3xl font-semibold tracking-[-0.04em] text-[var(--fg-primary)] sm:text-4xl">
            {activeTab === "assets" ? t("title.assets") : t("title.fonts")}
          </h1>
          <p className="mt-2 max-w-xl text-base leading-6 text-[var(--fg-muted)]">
            {activeTab === "assets" ? t("description.assets") : t("description.fonts")}
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--hub-accent)] px-4 py-2.5 text-body font-semibold text-[var(--hub-accent-on)] transition hover:bg-[var(--hub-accent-hover)]">
          {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
          {uploading ? t("upload.uploading") : activeTab === "assets" ? t("upload.asset") : t("upload.font")}
          <input
            type="file"
            className="sr-only"
            disabled={Boolean(uploading)}
            accept={activeTab === "assets" ? "image/*,video/*,audio/*" : ".ttf,.woff,.woff2,font/ttf,font/woff,font/woff2"}
            onChange={(event) => {
              const file = event.target.files?.[0];
              const inputElement = event.currentTarget;
              inputElement.value = "";
              if (file) void (activeTab === "assets" ? uploadFile(file) : uploadFontFile(file));
            }}
            ref={activeTab === "assets" ? inputRef : fontInputRef}
          />
        </label>
      </div>

      <div className="mt-6 flex gap-1 border-b border-[var(--hub-border)]">
        {(["assets", "fonts"] as const).map((tab) => (
          <button key={tab} type="button" onClick={() => { setActiveTab(tab); setSearch(""); }} className={`border-b-2 px-4 py-2 text-base font-medium ${activeTab === tab ? "border-[var(--hub-accent)] text-[var(--fg-primary)]" : "border-transparent text-[var(--fg-muted)]"}`}>
            {tab === "assets" ? t("title.assets") : t("title.fonts")}
          </button>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-3 border-b border-[var(--hub-border)] pb-3 sm:flex-row sm:items-center">
        <label className="relative block min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--fg-disabled)]" />
          <span className="sr-only">{t("search.label")}</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("search.label")}
            className="h-10 w-full rounded-lg border border-[var(--hub-border)] bg-[var(--hub-card-bg)] pl-9 pr-3 text-body text-[var(--fg-primary)] outline-none placeholder:text-[var(--fg-disabled)] focus:border-[var(--hub-accent)]"
          />
        </label>
        <span className="text-caption text-[var(--fg-muted)]">
          {activeTab === "assets" ? t("counts.files", { count: visibleAssets.length }) : t("counts.fonts", { count: visibleFonts.length })}
        </span>
        <div className="flex items-center gap-1 sm:ml-auto" aria-label={t("view.assetAria")}>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("view.listAria")}
            aria-pressed={viewMode === "list"}
            onClick={() => setViewMode("list")}
            className={`size-9 ${viewMode === "list" ? "bg-[var(--hub-active)] text-[var(--fg-primary)]" : ""}`}
          >
            <List className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("view.cardAria")}
            aria-pressed={viewMode === "grid"}
            onClick={() => setViewMode("grid")}
            className={`size-9 ${viewMode === "grid" ? "bg-[var(--hub-active)] text-[var(--fg-primary)]" : ""}`}
          >
            <Grid2X2 className="size-4" />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-body text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)] px-5 py-16 text-body text-[var(--fg-muted)]">
          <LoaderCircle className="size-4 animate-spin" /> {t("loading")}
        </div>
      ) : activeTab === "fonts" ? (
        visibleFonts.length === 0 ? (
          <div className="mt-6 flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--hub-border)] bg-[var(--hub-card-bg)] px-6 py-14 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--hub-accent)]"><UploadCloud className="size-5" /></span>
            <p className="mt-4 text-body font-semibold text-[var(--fg-primary)]">{normalizedSearch ? t("fontsEmpty.noMatch") : t("fontsEmpty.none")}</p>
            <p className="mt-1 max-w-sm text-caption text-[var(--fg-muted)]">{t("fontsEmpty.description")}</p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border border-[var(--hub-border)] bg-[var(--hub-card-bg)]">
            <div className="divide-y divide-[var(--hub-divider)]">
              {visibleFonts.map((font) => (
                <div key={font.id} className="flex items-center gap-4 px-5 py-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--hub-hover)] text-[var(--hub-accent)]">Aa</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-medium text-[var(--fg-primary)]">{font.familyName} · {font.subfamilyName}</p>
                    <p className="mt-1 font-mono text-caption text-[var(--fg-muted)]">{font.source === "custom" ? t("fontSource.custom") : t("fontSource.system")} · {font.format.toUpperCase()} · {font.weight}</p>
                  </div>
                  {font.source === "custom" ? (
                    <Button variant="ghost" size="icon" className="size-9 hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] hover:text-[var(--danger)]" aria-label={t("fontDeleteAria", { family: font.familyName, subfamily: font.subfamilyName })} onClick={() => {
                      if (!font.id.startsWith("custom:")) return;
                      void deleteFont(font.id.slice("custom:".length)).then(() => loadAssets()).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : t("errors.deleteFailed")));
                    }}>
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )
      ) : visibleAssets.length === 0 ? (
        <div className="mt-6 flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--hub-border)] bg-[var(--hub-card-bg)] px-6 py-14 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--hub-accent)]">
            <UploadCloud className="size-5" />
          </span>
          <p className="mt-4 text-body font-semibold text-[var(--fg-primary)]">
            {normalizedSearch ? t("assetsEmpty.noMatch") : t("assetsEmpty.none")}
          </p>
          <p className="mt-1 max-w-sm text-caption text-[var(--fg-muted)]">
            {normalizedSearch ? t("assetsEmpty.descriptionSearch") : t("assetsEmpty.descriptionEmpty")}
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
                  <AssetActions
                    asset={asset}
                    checking={checkingDeleteAssetId === asset.id}
                    onDelete={(id) => { void requestDeleteAsset(id); }}
                  />
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
                  <AssetActions
                    asset={asset}
                    checking={checkingDeleteAssetId === asset.id}
                    onDelete={(id) => { void requestDeleteAsset(id); }}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
      {pendingDelete ? (
        <DeleteAssetDialog
          asset={pendingDelete}
          projects={deleteProjects}
          deleting={deletingAssetId === pendingDelete.id}
          onCancel={() => {
            if (!deletingAssetId) setPendingDelete(null);
          }}
          onConfirm={() => void deleteAsset()}
        />
      ) : null}
    </div>
  );
}
