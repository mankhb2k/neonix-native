"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { TimelineClip, TimelinePosterStatus } from "@motionvideo/editor-core/timeline";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

export type ClipStripVisualKind = "shape" | "text" | "media" | "audio";

function formatClipDuration(duration: number): string {
  const totalSeconds = Math.max(0, Math.round(duration));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function posterLabel(status: TimelinePosterStatus): string {
  if (status === "failed") return "Preview unavailable";
  if (status === "unsupported") return "Preview not supported";
  if (status === "pending") return "Preparing preview…";
  return "Video poster preview";
}

function EmbeddedVideoStrip({ clip }: { clip: TimelineClip }) {
  const [posterFailed, setPosterFailed] = useState(false);
  if (clip.kind !== "scene" || clip.mediaType !== "video") return null;

  const status: TimelinePosterStatus = posterFailed
    ? "failed"
    : clip.posterStatus ?? (clip.posterUrl ? "ready" : "pending");

  return (
    <div className="flex h-full min-w-0 flex-col text-[9px] font-medium text-white">
      <div className="flex h-4 shrink-0 items-center justify-between gap-1 bg-black/35 px-1.5 leading-none">
        <span className="min-w-0 truncate">{clip.name}</span>
        <span className="shrink-0 font-mono text-[8px] text-white/80">
          {formatClipDuration(clip.duration)}
        </span>
      </div>
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {status === "ready" && clip.posterUrl ? (
          // Signed R2 URLs are runtime data and cannot use next/image optimization.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clip.posterUrl}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
            onError={() => setPosterFailed(true)}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center bg-[var(--timeline-clip-frame)] px-2 text-center text-[8px] text-white/70"
            aria-label={posterLabel(status)}
          >
            {status === "pending" ? "Preparing preview…" : posterLabel(status)}
          </div>
        )}
        <span
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/25"
          aria-hidden="true"
        />
      </div>
      <div
        className={cn(
          "h-1 shrink-0 bg-[repeating-linear-gradient(90deg,rgba(165,243,252,0.8)_0,rgba(165,243,252,0.8)_2px,transparent_2px,transparent_4px)] bg-black/30",
          clip.muted && "opacity-35",
        )}
        aria-label={clip.embeddedAudio ? "Linked audio" : undefined}
      />
    </div>
  );
}

const IMAGE_TIMELINE_TILE_PX = 27;

function EmbeddedImageStrip({
  clip,
  pixelsPerSecond,
}: {
  clip: TimelineClip;
  pixelsPerSecond: number;
}) {
  const [previewFailed, setPreviewFailed] = useState(false);
  if (clip.kind !== "scene" || clip.mediaType !== "image") return null;

  const hasPreview = Boolean(clip.posterUrl) && !previewFailed;
  const clipWidth = Math.max(8, clip.duration * pixelsPerSecond);
  // Canva-style filmstrip: repeat square crops across the complete clip
  // duration, while capping the tile count for very long timelines.
  const tileCount = Math.min(
    256,
    Math.max(1, Math.ceil(clipWidth / IMAGE_TIMELINE_TILE_PX)),
  );
  return (
    <div className="relative h-full min-w-0 overflow-hidden bg-[var(--timeline-clip-frame)] text-[9px] font-medium text-white">
      <div className="flex h-full w-full">
        {Array.from({ length: tileCount }, (_, index) => (
          <div
            // The index is stable within this immutable visual filmstrip.
            key={`${clip.id}-image-tile-${index}`}
            className="relative h-full w-[27px] shrink-0 overflow-hidden bg-black/20"
          >
            {hasPreview ? (
              // Signed R2 URLs are runtime data and cannot use next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={clip.posterUrl}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
                onError={() => setPreviewFailed(true)}
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-white/50" aria-label="Image preview unavailable">
                <span aria-hidden="true">▧</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <span className="pointer-events-none absolute inset-y-0 left-0 flex max-w-[75%] items-center truncate bg-gradient-to-r from-black/70 via-black/25 to-transparent px-1.5 pr-6 text-[9px] text-white">
        {clip.name}
      </span>
    </div>
  );
}

/** Fill/label chrome for a clip strip — reuse on the drag **float**. */
export function clipVisualClass(
  kind: ClipStripVisualKind,
  selected: boolean,
): string {
  const selectedCls = selected ? "ring-1 ring-white" : "";

  if (kind === "audio") {
    return cn(
      "flex items-start overflow-hidden rounded-sm px-2 text-left text-[10px] font-medium",
      "bg-[var(--timeline-clip-audio)] text-[var(--timeline-clip-audio-fg)]",
      selectedCls,
    );
  }
  if (kind === "text") {
    return cn(
      "flex items-start overflow-hidden rounded-sm px-2 text-left text-[10px] font-medium",
      "bg-[var(--timeline-clip-text)] text-[var(--timeline-clip-text-fg)]",
      selectedCls,
    );
  }
  if (kind === "shape") {
    return cn(
      "flex items-start overflow-hidden rounded-sm px-2 text-left text-[10px] font-medium",
      "bg-[var(--timeline-clip-overlay)] text-[var(--timeline-clip-overlay-fg)]",
      selectedCls,
    );
  }
  return cn(
    "flex flex-col justify-center overflow-hidden rounded-sm px-2 text-left text-[11px] font-medium",
    "bg-[var(--timeline-clip-frame)] text-[var(--timeline-clip-frame-fg)]",
    selectedCls,
  );
}

/** White edge handles — shared by clip strip (interactive) and move float (visual only). */
export function ClipStripTrimHandles({
  interactive = false,
  onTrimLeft,
  onTrimRight,
}: {
  interactive?: boolean;
  onTrimLeft?: (event: ReactPointerEvent<HTMLElement>) => void;
  onTrimRight?: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const edgeCls = interactive
    ? "cursor-col-resize pointer-events-auto"
    : "pointer-events-none";

  return (
    <>
      <span
        className={cn(
          "absolute top-0 bottom-0 left-0 w-1 rounded-l-sm bg-white",
          edgeCls,
        )}
        data-testid={interactive ? "timeline-clip-trim-left" : undefined}
        onPointerDown={onTrimLeft}
      />
      <span
        className={cn(
          "absolute top-0 bottom-0 right-0 w-1 rounded-r-sm bg-white",
          edgeCls,
        )}
        data-testid={interactive ? "timeline-clip-trim-right" : undefined}
        onPointerDown={onTrimRight}
      />
    </>
  );
}

type Props = {
  clip: TimelineClip;
  visualKind: ClipStripVisualKind;
  pixelsPerSecond: number;
  selected?: boolean;
  showTrimHandles?: boolean;
  /** Dimmed / hidden while this clip is being dragged (float + ghost take over). */
  isMovingSource?: boolean;

  // === Gesture callbacks (move / trim via editor-react hooks) ===

  /** Begin a move gesture on the clip body. */
  onBeginMove?: (
    event: ReactPointerEvent<HTMLElement>,
    clip: TimelineClip,
  ) => void;
  /** Begin a trim gesture on left/right edge. */
  onBeginTrim?: (
    event: ReactPointerEvent<HTMLElement>,
    clip: TimelineClip,
    edge: "left" | "right",
  ) => void;

  // === Legacy select-only (used when move/trim not wired) ===

  /** Click / ctrl-click select (desktop useClipMove entry parity). */
  onSelectPointerDown?: (
    event: ReactPointerEvent<HTMLElement>,
    clip: TimelineClip,
  ) => void;
  onDoubleClick?: (
    event: ReactMouseEvent<HTMLElement>,
    clip: TimelineClip,
  ) => void;
  onContextMenu?: (
    event: ReactMouseEvent<HTMLElement>,
    clip: TimelineClip,
  ) => void;
};

export function ClipStrip({
  clip,
  visualKind,
  pixelsPerSecond,
  selected = false,
  showTrimHandles,
  isMovingSource = false,
  onBeginMove,
  onBeginTrim,
  onSelectPointerDown,
  onDoubleClick,
  onContextMenu,
}: Props) {
  const left = clip.startTime * pixelsPerSecond;
  const width = Math.max(8, clip.duration * pixelsPerSecond);
  const interactive = Boolean(onBeginMove || onSelectPointerDown || onDoubleClick);
  const embeddedVideo = clip.kind === "scene" && clip.mediaType === "video";
  const embeddedImage = clip.kind === "scene" && clip.mediaType === "image";
  const embeddedMedia = embeddedVideo || embeddedImage;

  const handleBodyPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (event.detail >= 2 && onDoubleClick) {
      onDoubleClick(
        event,
        clip,
      );
      return;
    }
    onSelectPointerDown?.(event, clip);
    // Modifier clicks are selection gestures; do not let the move hook
    // overwrite the range/toggle selection immediately afterwards.
    if (!event.shiftKey && !event.metaKey && !event.ctrlKey) {
      onBeginMove?.(event, clip);
    }
  };

  const handleTrimPointerDown = (
    event: ReactPointerEvent<HTMLElement>,
    edge: "left" | "right",
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    onBeginTrim?.(event, clip, edge);
  };

  return (
    <div
      className={cn(
        "absolute top-0 bottom-0 my-auto h-[90%] select-none",
        interactive ? "cursor-pointer" : null,
        selected && "z-10",
        clip.muted && "opacity-35",
        isMovingSource && "invisible pointer-events-none",
        embeddedMedia
          ? cn(
              "overflow-hidden rounded-sm bg-[var(--timeline-clip-frame)]",
              selected && "ring-1 ring-white",
            )
          : clipVisualClass(visualKind, selected),
      )}
      style={{ left, width }}
      title={clip.name}
      data-clip-id={clip.id}
      data-lane-id={clip.laneId}
      data-testid={`timeline-clip-${clip.id}`}
      onPointerDown={handleBodyPointerDown}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onDoubleClick?.(event, clip);
      }}
      onContextMenu={(event) => onContextMenu?.(event, clip)}
    >
      {embeddedVideo ? (
        <EmbeddedVideoStrip clip={clip} />
      ) : embeddedImage ? (
        <EmbeddedImageStrip clip={clip} pixelsPerSecond={pixelsPerSecond} />
      ) : (
        <span className="truncate">{clip.name}</span>
      )}
      {selected && showTrimHandles ? (
        <ClipStripTrimHandles
          interactive
          onTrimLeft={(e) => handleTrimPointerDown(e, "left")}
          onTrimRight={(e) => handleTrimPointerDown(e, "right")}
        />
      ) : null}
    </div>
  );
}
