import { assertSnapshotContract } from "@motionvideo/pixi-renderer";
import {
  evaluateFrame,
  layerGraphFromRuntime,
  resolveTimelineAtTime,
  type RenderSnapshot,
} from "@motionvideo/motion-runtime";
import {
  createFacebookHistoryDemoProject,
  FB_HISTORY_SCENE_IDS,
  compileProjectV1,
} from "@motionvideo/motion-runtime/testing";
import type { MotionProject } from "@motionvideo/motion-protocol";
import { stageSizeForAspect } from "@/lib/runtime/preview-evaluate";
import { compositionAspectRatio } from "@/lib/runtime/project-composition";

/** First root layer id. */
export function firstSceneId(project: MotionProject): string | null {
  return project.layers?.[0]?.id ?? null;
}

/** Project used for stage preview + hit-test. */
export function resolvePreviewProject(project: MotionProject): {
  project: MotionProject;
  usingDemo: boolean;
  sceneId: string;
} {
  const sceneId = firstSceneId(project);
  if (sceneId) {
    return { project, usingDemo: false, sceneId };
  }
  if (Array.isArray(project.layers) && project.layers.length > 0) {
    return { project, usingDemo: false, sceneId: "root" };
  }
  try {
    const demo = createFacebookHistoryDemoProject();
    return {
      project: demo,
      usingDemo: true,
      sceneId: FB_HISTORY_SCENE_IDS.hook,
    };
  } catch {
    return { project, usingDemo: false, sceneId: "root" };
  }
}

export function buildPreviewSnapshot(
  project: MotionProject,
  time = 0,
  frame = 0,
): RenderSnapshot | null {
  const preview = resolvePreviewProject(project);
  const runtime = compileProjectV1(preview.project);
  const scene = layerGraphFromRuntime(runtime);
  if (scene.layers.length === 0 && !(scene.duration > 0)) return null;
  const resolved = resolveTimelineAtTime(runtime, time);
  const { width, height } = stageSizeForAspect(
    compositionAspectRatio(preview.project),
  );
  const localTime = resolved?.localTime ?? time;
  const localFrame = resolved
    ? Math.max(
        0,
        Math.round(resolved.localTime * (runtime.composition?.fps ?? 30)),
      )
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
