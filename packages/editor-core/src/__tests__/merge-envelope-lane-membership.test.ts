/**
 * Contract test cho mergeEnvelopeLaneMembership — re-apply lane membership
 * (clip id / laneId) từ pack trước đó khi các layer tương tự vẫn tồn tại.
 */
import { describe, expect, it } from "vitest";
import {
  mergeEnvelopeLaneMembership,
  type TimelineProjection,
} from "../timeline/selectors/scene-order-clips";
import {
  DEFAULT_VISUAL_POLICY,
  type TimelineClip,
  type TimelineLane,
} from "../timeline/model/timeline-types";

function lane(
  id: string,
  role: "base" | "overlay",
  order: number,
): TimelineLane {
  return {
    id,
    kind: "visual",
    role,
    name: id,
    order,
    policy: { ...DEFAULT_VISUAL_POLICY },
  };
}

function sceneClip(
  id: string,
  sceneId: string,
  laneId: string,
  startTime: number,
  duration: number,
): TimelineClip {
  return { kind: "scene", id, sceneId, laneId, startTime, duration, name: id };
}

const base = () => lane("lane.main", "base", -1);
const overlay = () => lane("lane.overlay.0", "overlay", 0);

function packed(): TimelineProjection {
  return {
    lanes: [base(), overlay()],
    clips: [
      sceneClip("clip.a", "layer.a", "lane.main", 0, 2),
      sceneClip("clip.b", "layer.b", "lane.overlay.0", 2, 2),
    ],
  };
}

describe("mergeEnvelopeLaneMembership", () => {
  it("trả nguyên packed khi envelope rỗng", () => {
    const p = packed();
    const out = mergeEnvelopeLaneMembership(p, [], []);
    expect(out).toBe(p);
  });

  it("re-apply lane nhớ được khi lane còn trống", () => {
    // Envelope: A từng ở overlay, B từng ở base (ngược so với fresh pack).
    const p = packed();
    const out = mergeEnvelopeLaneMembership(
      p,
      [
        sceneClip("clip.a", "layer.a", "lane.overlay.0", 0, 2),
        sceneClip("clip.b", "layer.b", "lane.main", 2, 2),
      ],
      [base(), overlay()],
    );

    const a = out.clips.find((c) => c.id === "clip.a");
    const b = out.clips.find((c) => c.id === "clip.b");
    expect(a?.laneId).toBe("lane.overlay.0");
    expect(b?.laneId).toBe("lane.main");
  });

  it("rơi về lane của fresh pack khi lane nhớ không còn trong envelope lanes", () => {
    const p = packed();
    const out = mergeEnvelopeLaneMembership(
      p,
      [sceneClip("clip.a", "layer.a", "lane.gone", 0, 2)],
      [base()], // "lane.gone" không có trong envelope lanes
    );

    const a = out.clips.find((c) => c.id === "clip.a");
    expect(a?.laneId).toBe("lane.main");
  });

  it("thêm base lane nếu envelope thiếu base lane", () => {
    const p = packed();
    const out = mergeEnvelopeLaneMembership(
      p,
      [sceneClip("clip.a", "layer.a", "lane.overlay.0", 0, 2)],
      [overlay()],
    );

    expect(
      out.lanes.some((l) => l.kind === "visual" && l.role === "base"),
    ).toBe(true);
  });

  it("giữ lại clip name nhớ được từ envelope", () => {
    const p = packed();
    const out = mergeEnvelopeLaneMembership(
      p,
      [sceneClip("clip.a", "layer.a", "lane.main", 0, 2)],
      [base(), overlay()],
    );

    const a = out.clips.find((c) => c.id === "clip.a");
    expect(a?.name).toBe("clip.a");
  });
});
