import type { TimelineClip, TimelineLane } from "../timeline-clips";
import type { MotionProject } from "@motionvideo/motion-protocol";

/** Giữ mọi scene được visual clip tham chiếu; sceneOrder chỉ từ base lane. */
export function rebuildMainProject(
  project: MotionProject,
  clips: TimelineClip[],
  lanes: TimelineLane[],
): MotionProject {
  const byId = new Map(project.scenes.map((scene) => [scene.id, scene]));
  const mainId = lanes.find(
    (lane) => lane.kind === "visual" && lane.role === "base",
  )?.id;
  const main = clips
    .filter(
      (clip): clip is Extract<TimelineClip, { kind: "scene" }> =>
        clip.kind === "scene" && clip.laneId === mainId,
    )
    .sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));
  const sceneOrder = main
    .map((clip) => clip.sceneId)
    .filter((sceneId) => byId.has(sceneId));

  // Overlay/base đều giữ scene content — không xóa khi đổi lane (MODEL-02).
  const referenced = new Set(
    clips
      .filter((clip) => clip.kind === "scene")
      .map((clip) => (clip.kind === "scene" ? clip.sceneId : ""))
      .filter((sceneId) => sceneId && byId.has(sceneId)),
  );
  const orderedIds = [
    ...sceneOrder,
    ...[...referenced].filter((id) => !sceneOrder.includes(id)),
  ];
  return {
    ...project,
    scenes: orderedIds.map((sceneId) => byId.get(sceneId)!),
    // Schema requires every scene in `scenes` to appear in sceneOrder.
    timeline: { ...project.timeline, sceneOrder: orderedIds },
  };
}
