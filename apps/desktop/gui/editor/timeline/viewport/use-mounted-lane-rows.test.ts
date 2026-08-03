import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMountedLaneRows } from "./use-mounted-lane-rows";
import { LANE_GAP_PX } from "../lanes/timeline-lane-rows";

describe("useMountedLaneRows", () => {
  const lanes = [
    { id: "audio", lane: { id: "audio" } as any, height: 200 },
    { id: "base", lane: { id: "base" } as any, height: 200 },
    { id: "ov1", lane: { id: "ov1" } as any, height: 200 },
    { id: "ov2", lane: { id: "ov2" } as any, height: 200 },
  ] as any[];

  it("always mounts pin lanes even outside scroll window", () => {
    const { result } = renderHook(() =>
      useMountedLaneRows({
        laneRows: lanes,
        contentHeight: 1000,
        scrollTop: 300, // viewTop = 300 - 96 = 204 >= 202 (skips audio)
        trackViewHeight: 200, // viewBottom = 300 + 200 + 96 = 596 <= 606 (skips ov2)
        movePinKey: "audio", // Pin the first lane which is outside the scroll window
        topPadding: 0,
      })
    );

    const { mountedRows } = result.current;
    
    // We expect the pin lane (audio at index 0) to be mounted, followed by base (index 1), ov1 (index 2) without gap spacer because they are contiguous
    expect(mountedRows).toHaveLength(3);
    expect(mountedRows[0]!.kind).toBe("lane");
    expect((mountedRows[0] as any).row.lane.id).toBe("audio");
    expect(mountedRows[1]!.kind).toBe("lane");
    expect((mountedRows[1] as any).row.lane.id).toBe("base");
    expect(mountedRows[2]!.kind).toBe("lane");
    expect((mountedRows[2] as any).row.lane.id).toBe("ov1");
  });

  it("inserts gap spacer between mounted window and pin lane correctly", () => {
    const { result } = renderHook(() =>
      useMountedLaneRows({
        laneRows: lanes,
        contentHeight: 1000,
        scrollTop: 0,
        trackViewHeight: 200, // Covers audio and base
        movePinKey: "ov2", // Pin the last lane which is outside the scroll window
        topPadding: 0,
      })
    );

    const { mountedRows } = result.current;
    
    // audio (0), base (1), gap, ov2 (3)
    expect(mountedRows).toHaveLength(4);
    expect(mountedRows[0]!.kind).toBe("lane");
    expect(mountedRows[1]!.kind).toBe("lane");
    expect(mountedRows[2]!.kind).toBe("gap");
    
    const gap = mountedRows[2] as any;
    // Gap height should be the space between base (index 1) and ov2 (index 3). 
    // Which is the height of ov1 (200) + LANE_GAP_PX.
    expect(gap.height).toBe(200 + LANE_GAP_PX);
    
    expect(mountedRows[3]!.kind).toBe("lane");
    expect((mountedRows[3] as any).row.lane.id).toBe("ov2");
  });

  it("computes bottomSpacer from contentHeight minus mounted block", () => {
    const { result } = renderHook(() =>
      useMountedLaneRows({
        laneRows: lanes, // Total content height = 4*200 + 3*2 = 806
        contentHeight: 806,
        scrollTop: 0,
        trackViewHeight: 200, // Covers audio and base
        movePinKey: "",
        topPadding: 0,
      })
    );

    const { bottomSpacer, mountedRows } = result.current;
    
    // Mounted: audio (200), gap (2), base (200), trailing gap (2)
    // Total block: 200 + 2 + 200 + 2 = 404
    // bottomSpacer: 806 - 0 - 404 = 402
    expect(mountedRows).toHaveLength(2);
    expect(bottomSpacer).toBe(402); 
  });
});
