export type LaneLayoutRect = {
  laneId: string;
  top: number;
  height: number;
  order: number;
  kind: "visual" | "audio";
  role: "base" | "overlay" | "audio";
};

export type TimelineGeometryConfig = {
  pixelsPerSecond: number;
  scrollLeft: number;
  scrollTop: number;
  containerWidth: number;
  containerHeight: number;
  laneRects: LaneLayoutRect[];
  /** Tùy chọn: client X của gốc content tracks (cho clientPointToTime). */
  contentOriginClientX?: number;
  /** Extra px ngoài viewport cho visibleTimeRange. */
  overscanPx?: number;
};

export class TimelineGeometry {
  private config: TimelineGeometryConfig;

  constructor(config: TimelineGeometryConfig) {
    this.config = config;
  }

  public get pixelsPerSecond(): number {
    return this.config.pixelsPerSecond;
  }

  public get scrollLeft(): number {
    return this.config.scrollLeft;
  }

  public updateConfig(patch: Partial<TimelineGeometryConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  public timeToPixel(time: number): number {
    return (
      Math.max(0, time) * this.config.pixelsPerSecond - this.config.scrollLeft
    );
  }

  public pixelToTime(pixelX: number): number {
    const rawTime =
      (pixelX + this.config.scrollLeft) / this.config.pixelsPerSecond;
    return Math.max(0, rawTime);
  }

  /** Ánh xạ viewport client X → giây timeline (cần contentOriginClientX). */
  public clientPointToTime(clientX: number): number {
    const origin = this.config.contentOriginClientX ?? 0;
    return this.pixelToTime(clientX - origin);
  }

  public visibleTimeRange(): { start: number; end: number } {
    const pps = Math.max(this.config.pixelsPerSecond, 0.001);
    const overscan = this.config.overscanPx ?? 120;
    const start = Math.max(0, (this.config.scrollLeft - overscan) / pps);
    const end =
      (this.config.scrollLeft + this.config.containerWidth + overscan) / pps;
    return { start, end };
  }

  public hitTestLane(
    pixelY: number,
    family?: "visual" | "audio",
  ): LaneLayoutRect | null {
    const adjustedY = pixelY + this.config.scrollTop;
    return (
      this.config.laneRects.find((rect) => {
        if (family && rect.kind !== family) return false;
        return adjustedY >= rect.top && adjustedY < rect.top + rect.height;
      }) ?? null
    );
  }

  public findNearestSnapTime(
    targetTime: number,
    snapPoints: number[],
    thresholdPixels = 10,
  ): { time: number; snapped: boolean } {
    const thresholdTime = thresholdPixels / this.config.pixelsPerSecond;
    let closestTime = targetTime;
    let minDiff = Infinity;

    for (const snap of snapPoints) {
      const diff = Math.abs(snap - targetTime);
      if (diff <= thresholdTime && diff < minDiff) {
        minDiff = diff;
        closestTime = snap;
      }
    }

    return {
      time: closestTime,
      snapped: closestTime !== targetTime,
    };
  }
}
