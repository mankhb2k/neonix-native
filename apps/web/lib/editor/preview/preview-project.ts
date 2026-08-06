import { assertSnapshotContract } from "@motionvideo/pixi-renderer";
import { compileMotionProject } from "@motionvideo/motion-compiler";
import {
  evaluateFrame,
  resolveTimelineAtTime,
  type RenderSnapshot,
} from "@motionvideo/motion-runtime";
import type { MotionProject } from "@motionvideo/motion-schema";
import {
  createFacebookHistoryDemoProject,
  FB_HISTORY_SCENE_IDS,
} from "@motionvideo/motion-runtime/testing";
import { stageSizeForAspect } from "@/lib/runtime/preview-evaluate";

/** Project used for stage preview + hit-test (Facebook History when blank). */
export function resolvePreviewProject(project: MotionProject): {
  project: MotionProject;
  usingDemo: boolean;
  sceneId: string;
} {
  if (project.scenes.length > 0) {
    const sceneId =
      project.timeline.sceneOrder[0] ?? project.scenes[0]!.id;
    return { project, usingDemo: false, sceneId };
  }
  const demo = createFacebookHistoryDemoProject();
  return {
    project: demo,
    usingDemo: true,
    sceneId: FB_HISTORY_SCENE_IDS.hook,
  };
}

export function buildPreviewSnapshot(
  project: MotionProject,
  time = 0,
  frame = 0,
): RenderSnapshot | null {
  const preview = resolvePreviewProject(project);
  const runtime = compileMotionProject(preview.project);
  const resolved = resolveTimelineAtTime(runtime, time);
  const scene =
    (resolved
      ? runtime.scenes.find((s) => s.id === resolved.sceneId)
      : null) ??
    runtime.scenes.find((s) => s.id === preview.sceneId) ??
    runtime.scenes[0];
  if (!scene) return null;
  const { width, height } = stageSizeForAspect(
    preview.project.metadata.aspectRatio,
  );
  const localTime = resolved?.localTime ?? time;
  const localFrame = resolved
    ? Math.max(0, Math.round(resolved.localTime * (runtime.metadata.fps || 30)))
    : frame;
  const evaluated = evaluateFrame({
    scene,
    time: localTime,
    frame: localFrame,
    width,
    height,
    background: "#ffffff",
  });
  assertSnapshotContract(evaluated.interaction);
  return evaluated.interaction;
}
