"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useEditorActions } from "@/hooks/editor/use-editor-actions";
import {
  useEditorDocument,
  useEditorLocks,
  useEditorSelection,
  useEditorStore,
} from "@/hooks/editor/use-editor-store";
import { usePlaybackController } from "@/hooks/editor/use-playback-controller";
import { useTransportStore } from "@/hooks/editor/use-transport-store";
import { listAssets, type Asset } from "@/lib/api/assets";
import {
  selectionClips as protocolSelectionClips,
  selectedClipIds as protocolSelectedClipIds,
} from "@motionvideo/editor-core";
import {
  projectLayersToTimeline,
} from "@motionvideo/editor-core/timeline";
import {
  selectedClipIdsFrom,
  selectionClips,
  selectionNone,
  resolveFitAnchorSeconds,
  type EditorSelection,
  type TimelineEdit,
  type TimelineAssetPreview,
  timelineEditToDocumentCommand,
} from "@motionvideo/editor-core/timeline";
import { TransportBar } from "./Header/TransportBar";
import { TIMELINE_ZOOM_DEFAULT } from "./timeline-scale";
import { TimelineViewport } from "./viewport/TimelineViewport";
import type { EditorCommand } from "@motionvideo/editor-core";

function previewKeysForAsset(assetId: string): string[] {
  return assetId.startsWith("asset-")
    ? [assetId]
    : [assetId, `asset-${assetId}`];
}

/** Timeline chrome backed by the Protocol V2 document adapter. */
export function TimelineShell() {
  const {
    registerPlaybackTimeSink,
    playbackPreviewSeek,
    playbackToggle,
  } = usePlaybackController();
  const {
    setSelectedLayerIds,
    undo,
    redo,
    deleteSelectedLayers,
    applyCommand,
  } = useEditorActions();
  const canUndo = useEditorStore((state) => state.undoStack.length > 0);
  const canRedo = useEditorStore((state) => state.redoStack.length > 0);
  const document = useEditorDocument();
  const selectedLayerIds = useEditorSelection();
  const lockedLayerIds = useEditorLocks();
  const canDelete = selectedLayerIds.some((id) =>
    document.layers.some((layer) => layer.id === id) && !lockedLayerIds.includes(id),
  );
  const currentTime = useTransportStore((state) => state.currentTime);
  const isPlaying = useTransportStore((state) => state.playing);
  const [zoom, setZoom] = useState(TIMELINE_ZOOM_DEFAULT);
  const [snapOn, setSnapOn] = useState(true);
  const [assetPreviews, setAssetPreviews] = useState<ReadonlyMap<string, TimelineAssetPreview>>(
    () => new Map(),
  );

  useEffect(() => {
    let cancelled = false;
    void listAssets()
      .then((assets: Asset[]) => {
        if (cancelled) return;
        const previewEntries = assets.flatMap((asset) => {
          const isImage = asset.mime_type.startsWith("image/");
          const preview = {
            // Raster images can use their signed source directly. They are
            // cropped into a consistent thumbnail by the timeline/card UI;
            // only videos need a generated poster derivative.
            url: asset.preview_url ?? (isImage ? asset.download_url : null),
            status: asset.preview_url || (isImage && asset.download_url)
              ? "ready" as const
              : asset.preview_status,
          };
          // Project documents created by the MCP/seed path use the stable
          // `asset-{uuid}` identifier while the DB uses the raw UUID. Keep
          // both aliases in the view map; persistence still uses asset.id.
          return previewKeysForAsset(asset.id).map((key) => [key, preview] as const);
        });
        setAssetPreviews(
          new Map(previewEntries),
        );
      })
      .catch(() => {
        // Demo documents and unauthenticated preview sessions have no asset API.
        // The projection still provides image URI fallbacks and a neutral video state.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const projection = useMemo(
    () => projectLayersToTimeline(document, { assetPreviews }),
    [assetPreviews, document],
  );
  // Fit is a session decision, not a side effect of projecting each layer.
  // New clips therefore map into the existing ruler without changing its scale.
  const [fitAnchorSeconds, setFitAnchorSeconds] = useState<number | null>(
    () => resolveFitAnchorSeconds(projection.clips),
  );
  const [fitRevision, setFitRevision] = useState(0);
  const fps = document.composition.fps;
  const duration = Math.max(projection.duration, 0.001);
  const selection = useMemo<EditorSelection>(
    () =>
      selectedLayerIds.length > 0
        ? selectionClips(selectedLayerIds)
        : selectionNone(),
    [selectedLayerIds],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;

      const commandKey = event.metaKey || event.ctrlKey;
      if (commandKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (commandKey && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (!canDelete) return;
        event.preventDefault();
        deleteSelectedLayers();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canDelete, deleteSelectedLayers, redo, undo]);

  const onSelect = useCallback(
    (next: EditorSelection) => {
      setSelectedLayerIds(
        selectedClipIdsFrom(next).filter((id) => !lockedLayerIds.includes(id)),
      );
    },
    [lockedLayerIds, setSelectedLayerIds],
  );

  const onExecute = useCallback(
    (command: TimelineEdit, label: string) => {
      void label;
      const affectedClipIds =
        command.type === "move-clip" || command.type === "clip/trim"
          ? [command.clipId]
          : command.type === "move-clips"
            ? command.clipIds
            : command.type === "reorder-lane"
              ? projection.clips
                  .filter((clip) => clip.laneId === command.laneId)
                  .map((clip) => clip.id)
              : [];
      const affectedLayerIds = projection.clips
        .filter((clip) => affectedClipIds.includes(clip.id))
        .map((clip) => (clip.kind === "scene" ? clip.sceneId : null))
        .filter((id): id is string => Boolean(id));
      if (affectedLayerIds.some((id) => lockedLayerIds.includes(id))) return;
      const documentCommand: EditorCommand | null = timelineEditToDocumentCommand(
        document,
        projection,
        command,
      );
      if (documentCommand) applyCommand(documentCommand);
    },
    [applyCommand, document, lockedLayerIds, projection],
  );

  const fitTimeline = useCallback(() => {
    setFitAnchorSeconds(resolveFitAnchorSeconds(projection.clips));
    setZoom(TIMELINE_ZOOM_DEFAULT);
    setFitRevision((revision) => revision + 1);
  }, [projection.clips]);

  const toggleAudioTrackMuted = useCallback(
    (trackId: string) => {
      const track = document.audio.tracks.find((candidate) => candidate.id === trackId);
      if (!track) return;
      applyCommand({
        type: "patch-audio-track",
        trackId,
        patch: { muted: !track.muted },
      });
    },
    [applyCommand, document.audio.tracks],
  );

  const toggleVideoMuted = useCallback(
    (layerId: string) => {
      const layer = document.layers.find((candidate) => candidate.id === layerId);
      if (!layer || layer.type !== "video") return;
      const audio = layer.payload.audio;
      applyCommand({
        type: "patch-layer",
        layerId,
        patch: {
          payload: {
            audio: {
              enabled: !(audio?.enabled ?? false),
              gainDb: audio?.gainDb ?? 0,
              pan: audio?.pan ?? 0,
              ...(audio?.fadeIn ? { fadeIn: audio.fadeIn } : {}),
              ...(audio?.fadeOut ? { fadeOut: audio.fadeOut } : {}),
            },
          },
        },
      });
    },
    [applyCommand, document.layers],
  );

  const detachVideoAudio = useCallback(
    (layerId: string) => applyCommand({ type: "detach-video-audio", layerId }),
    [applyCommand],
  );

  const selectedClipIds = useMemo(
    () => protocolSelectedClipIds(
      protocolSelectionClips(
        selection.kind === "clips" ? selection.ids : [],
        selection.kind === "clips" ? selection.primaryId : undefined,
      ),
    ),
    [selection],
  );

  return (
    <section
      className="editor-panel flex h-full min-h-0 flex-col overflow-hidden [grid-area:timeline]"
      data-testid="editor-timeline"
      data-timeline-source="v1-viewport-v2-document"
      data-selected-clip-count={selectedClipIds.length}
    >
      <TransportBar
        mode="track"
        onModeChange={() => undefined}
        currentTime={currentTime}
        duration={duration}
        fps={fps}
        isPlaying={isPlaying}
        onTogglePlay={playbackToggle}
        zoom={zoom}
        onZoomChange={setZoom}
        onFit={fitTimeline}
        snapOn={snapOn}
        onToggleSnap={() => setSnapOn((value) => !value)}
        canUndo={canUndo}
        canRedo={canRedo}
        canDelete={canDelete}
        onUndo={undo}
        onRedo={redo}
        onDelete={deleteSelectedLayers}
      />
      <TimelineViewport
        mode="track"
        clips={projection.clips}
        lanes={projection.lanes}
        duration={duration}
        fps={fps}
        zoom={zoom}
        timelineFitAnchorSeconds={fitAnchorSeconds}
        fitRevision={fitRevision}
        registerPlaybackTimeSink={registerPlaybackTimeSink}
        selection={selection}
        onSelect={onSelect}
        onSeek={playbackPreviewSeek}
        onScrubSeek={playbackPreviewSeek}
        onExecute={onExecute}
        onToggleAudioTrackMuted={toggleAudioTrackMuted}
        onToggleVideoMuted={toggleVideoMuted}
        onDetachVideoAudio={detachVideoAudio}
        exclusiveRows
        autoSnapping={snapOn}
      />
    </section>
  );
}
