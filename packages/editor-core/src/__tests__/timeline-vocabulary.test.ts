/**
 * Contract test: khoá từ vựng public timeline.
 * Đảm bảo tên canonical tồn tại và tên legacy chỉ là shim deprecated cho
 * web/desktop migrate dần — không thêm thuật ngữ cũ mới.
 */
import { describe, expect, it } from "vitest";
import * as core from "..";

describe("public timeline vocabulary", () => {
  it("exports canonical lane/clip names", () => {
    const canonical = [
      "packRootLayersToTimeline",
      "stackRootLayersToTimeline",
      "groupPathToTimelineClips",
      "mergeEnvelopeLaneMembership",
      "ensureBaseLane",
      "isBaseLane",
      "resolveLaneKind",
      "clipAcceptsLane",
      "resolveBaseStartTime",
    ];
    const missing = canonical.filter((name) => {
      const value = (core as Record<string, unknown>)[name];
      return typeof value !== "function";
    });
    expect(missing).toEqual([]);
  });

  it("legacy shims vẫn import được và alias về canonical impl", () => {
    // Alias thật sự — cùng tham chiếu với canonical.
    expect(core.resolveLaneTrackKind).toBe(core.resolveLaneKind);
    expect(core.resolveMainStartTime).toBe(core.resolveBaseStartTime);

    // Wrapper deprecated — vẫn là function (chưa xóa để web/desktop migrate).
    expect(typeof core.visualTracksToTimelineClips).toBe("function");
    expect(typeof core.clipAcceptsTrack).toBe("function");
    expect(typeof core.ensureMainLane).toBe("function");
    expect(typeof core.isMainLane).toBe("function");
  });
});

describe("deterministic lane id generation", () => {
  it("generates stable ids without Math.random", () => {
    expect(core.ensureBaseLane([]).id).toBe("lane.base");
    expect(core.ensureMainLane([]).id).toBe("lane.base");
    expect(core.createOverlayLane(0).id).toBe("lane.overlay.0");
    expect(core.createAudioLane(0).id).toBe("lane.audio.0");
  });

  it("bumps the numeric suffix past existing lanes to stay collision-free", () => {
    const overlay = core.createOverlayLane(0);
    expect(core.createOverlayLane(1, undefined, [overlay]).id).toBe(
      "lane.overlay.1",
    );

    const audio = core.createAudioLane(0);
    expect(core.createAudioLane(1, undefined, [audio]).id).toBe("lane.audio.1");
  });
});
