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

  public timeToPixel(time: number): number {
    return Math.max(0, time) * this.config.pixelsPerSecond - this.config.scrollLeft;
  }

  public pixelToTime(pixelX: number): number {
    const rawTime = (pixelX + this.config.scrollLeft) / this.config.pixelsPerSecond;
    return Math.max(0, rawTime);
  }

  public hitTestLane(pixelY: number): LaneLayoutRect | null {
    const adjustedY = pixelY + this.config.scrollTop;
    return (
      this.config.laneRects.find(
        (rect) => adjustedY >= rect.top && adjustedY < rect.top + rect.height,
      ) ?? null
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
