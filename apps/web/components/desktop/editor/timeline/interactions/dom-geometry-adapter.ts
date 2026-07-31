/**
 * DOM-backed geometry + lane-rect cache for timeline interactions.
 * Pure drop math stays in drop-target-policy; this adapter owns measurement.
 */

import {
  TIMELINE_PLAYHEAD_GUTTER_PX,
  TIMELINE_TRACKS_ORIGIN_X,
} from "../timeline-scale";
import {
  absoluteAudioLanes,
  absoluteSceneLanes,
  audioDropPolicy,
  audioHitToLane,
  cacheAudioLanesRelative,
  cacheSceneLanesRelative,
  collectAudioZoneLanes,
  collectSceneLanes,
  resolveLaneDropTarget,
  videoHitToLane,
  visualDropPolicy,
  type RelativeAudioLaneHit,
  type RelativeLaneHit,
  type TimelineDropTarget,
} from "../Tracks/lane-drop-target";
import {
  TimelineGeometry,
  type LaneLayoutRect,
  type TimelineGeometryConfig,
} from "@/lib/editor/timeline/geometry/timeline-geometry";

export type GeometryCacheRevision = {
  scroll: number;
  resize: number;
  laneLayout: number;
  zoom: number;
};

export type DomGeometryAdapterOptions = {
  pixelsPerSecond: number;
  tracksOriginX?: number;
  playheadGutterPx?: number;
  overscanPx?: number;
};

export class DomGeometryAdapter {
  private workspace: HTMLElement | null = null;
  private scrollContainer: HTMLElement | null = null;
  private options: DomGeometryAdapterOptions;
  private revision: GeometryCacheRevision = {
    scroll: 0,
    resize: 0,
    laneLayout: 0,
    zoom: 0,
  };
  private sceneCache: RelativeLaneHit[] | null = null;
  private audioCache: RelativeAudioLaneHit[] | null = null;
  private sceneRevisionKey = "";
  private audioRevisionKey = "";
  private measureCount = 0;

  constructor(options: DomGeometryAdapterOptions) {
    this.options = options;
  }

  public bind(
    workspace: HTMLElement | null,
    scrollContainer: HTMLElement | null,
  ): void {
    this.workspace = workspace;
    this.scrollContainer = scrollContainer;
    this.invalidateAll();
  }

  public setPixelsPerSecond(pps: number): void {
    if (this.options.pixelsPerSecond === pps) return;
    this.options.pixelsPerSecond = pps;
    this.bump("zoom");
  }

  public bump(kind: keyof GeometryCacheRevision = "laneLayout"): void {
    this.revision[kind] += 1;
    this.sceneCache = null;
    this.audioCache = null;
  }

  public invalidateAll(): void {
    this.revision.scroll += 1;
    this.revision.resize += 1;
    this.revision.laneLayout += 1;
    this.sceneCache = null;
    this.audioCache = null;
  }

  public getRevision(): GeometryCacheRevision {
    return { ...this.revision };
  }

  /** Test/perf: how many DOM lane collects ran since construct. */
  public getMeasureCount(): number {
    return this.measureCount;
  }

  public resetMeasureCount(): void {
    this.measureCount = 0;
  }

  private revisionKey(): string {
    const r = this.revision;
    return `${r.scroll}:${r.resize}:${r.laneLayout}:${r.zoom}`;
  }

  private ensureSceneCache(wsTop: number): RelativeLaneHit[] {
    const key = this.revisionKey();
    if (this.sceneCache && this.sceneRevisionKey === key) {
      return this.sceneCache;
    }
    if (!this.workspace) return [];
    this.measureCount += 1;
    this.sceneCache = cacheSceneLanesRelative(this.workspace, wsTop);
    this.sceneRevisionKey = key;
    return this.sceneCache;
  }

  private ensureAudioCache(wsTop: number): RelativeAudioLaneHit[] {
    const key = this.revisionKey();
    if (this.audioCache && this.audioRevisionKey === key) {
      return this.audioCache;
    }
    if (!this.workspace) return [];
    this.measureCount += 1;
    this.audioCache = cacheAudioLanesRelative(this.workspace, wsTop);
    this.audioRevisionKey = key;
    return this.audioCache;
  }

  public workspaceTop(): number {
    return this.workspace?.getBoundingClientRect().top ?? 0;
  }

  public clientPointToTime(clientX: number): number {
    const root = this.scrollContainer;
    if (!root) return 0;
    const rect = root.getBoundingClientRect();
    const originX = this.options.tracksOriginX ?? TIMELINE_TRACKS_ORIGIN_X;
    const gutter =
      this.options.playheadGutterPx ?? TIMELINE_PLAYHEAD_GUTTER_PX;
    const xInTracks =
      clientX - rect.left - originX + root.scrollLeft + gutter;
    const pps = Math.max(this.options.pixelsPerSecond, 0.001);
    return Math.max(0, xInTracks / pps);
  }

  public visibleTimeRange(): { start: number; end: number } {
    const root = this.scrollContainer;
    const pps = Math.max(this.options.pixelsPerSecond, 0.001);
    const overscan = this.options.overscanPx ?? 120;
    const scrollLeft = root?.scrollLeft ?? 0;
    const viewWidth = root?.clientWidth ?? 0;
    const trackWidth = Math.max(
      0,
      viewWidth - (this.options.tracksOriginX ?? TIMELINE_TRACKS_ORIGIN_X),
    );
    const start = Math.max(0, (scrollLeft - overscan) / pps);
    const end = (scrollLeft + trackWidth + overscan) / pps;
    return { start, end };
  }

  public resolveVisualDrop(
    clientY: number,
    wasInsert: boolean,
    maxOverlayOrder: number,
  ): TimelineDropTarget | null {
    if (!this.workspace) return null;
    const wsTop = this.workspaceTop();
    const relative = this.ensureSceneCache(wsTop);
    const lanes =
      relative.length > 0
        ? absoluteSceneLanes(relative, wsTop)
        : collectSceneLanes(this.workspace);
    return resolveLaneDropTarget(
      clientY,
      lanes.map(videoHitToLane),
      wsTop,
      wasInsert,
      maxOverlayOrder,
      visualDropPolicy,
    );
  }

  public resolveAudioDrop(
    clientY: number,
    wasInsert: boolean,
    maxAudioOrder: number,
  ): TimelineDropTarget | null {
    if (!this.workspace) return null;
    const wsTop = this.workspaceTop();
    const relative = this.ensureAudioCache(wsTop);
    const lanes =
      relative.length > 0
        ? absoluteAudioLanes(relative, wsTop)
        : collectAudioZoneLanes(this.workspace);
    return resolveLaneDropTarget(
      clientY,
      lanes.map(audioHitToLane),
      wsTop,
      wasInsert,
      maxAudioOrder,
      audioDropPolicy,
    );
  }

  public toTimelineGeometry(): TimelineGeometry {
    const root = this.scrollContainer;
    const ws = this.workspace;
    const wsTop = ws?.getBoundingClientRect().top ?? 0;
    const scene = ws ? this.ensureSceneCache(wsTop) : [];
    const audio = ws ? this.ensureAudioCache(wsTop) : [];
    const laneRects: LaneLayoutRect[] = [];

    for (const lane of absoluteSceneLanes(scene, wsTop)) {
      laneRects.push({
        laneId: lane.laneId ?? "",
        top: lane.top - wsTop,
        height: Math.max(0, lane.bottom - lane.top),
        order: lane.order ?? -1,
        kind: "visual",
        role: lane.type === "main" ? "base" : "overlay",
      });
    }
    for (const lane of absoluteAudioLanes(audio, wsTop)) {
      if (lane.type === "main") continue;
      laneRects.push({
        laneId: lane.laneId ?? "",
        top: lane.top - wsTop,
        height: Math.max(0, lane.bottom - lane.top),
        order: lane.order ?? 0,
        kind: "audio",
        role: "audio",
      });
    }

    const config: TimelineGeometryConfig = {
      pixelsPerSecond: this.options.pixelsPerSecond,
      scrollLeft: root?.scrollLeft ?? 0,
      scrollTop: root?.scrollTop ?? 0,
      containerWidth: root?.clientWidth ?? 0,
      containerHeight: root?.clientHeight ?? 0,
      laneRects,
    };
    return new TimelineGeometry(config);
  }

  /** Bind scroll/resize → bump revision (caller owns lifecycle). */
  public bindInvalidation(onInvalidated?: () => void): () => void {
    const invalidateScroll = () => {
      this.bump("scroll");
      onInvalidated?.();
    };
    const invalidateResize = () => {
      this.bump("resize");
      onInvalidated?.();
    };
    const root = this.scrollContainer;
    const ws = this.workspace;
    root?.addEventListener("scroll", invalidateScroll, { passive: true });
    ws?.addEventListener("scroll", invalidateScroll, { passive: true });
    window.addEventListener("resize", invalidateResize);
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(invalidateResize);
    if (root) resizeObserver?.observe(root);
    if (ws) resizeObserver?.observe(ws);
    return () => {
      root?.removeEventListener("scroll", invalidateScroll);
      ws?.removeEventListener("scroll", invalidateScroll);
      window.removeEventListener("resize", invalidateResize);
      resizeObserver?.disconnect();
    };
  }
}
