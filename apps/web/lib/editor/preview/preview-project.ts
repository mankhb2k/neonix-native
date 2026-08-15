import { assertSnapshotContract } from "@motionvideo/pixi-renderer";
import {
  evaluateFrame,
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

/** First scene from the v1 main visual track, else first scene. */
export function firstSceneId(project: MotionProject): string | null {
  const timeline = project.timeline;
  if ("visualTracks" in timeline && Array.isArray(timeline.visualTracks)) {
    for (const track of timeline.visualTracks) {
      if (track.role !== "main") continue;
      const first = track.clips[0];
      if (first && first.source.kind === "scene") return first.source.sceneId;
    }
  }
  return project.scenes?.[0]?.id ?? null;
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
  const resolved = resolveTimelineAtTime(runtime, time);
  const scene =
    (resolved ? runtime.scenes.find((s) => s.id === resolved.sceneId) : null) ??
    runtime.scenes.find((s) => s.id === preview.sceneId) ??
    runtime.scenes[0];
  if (!scene) return null;
  const { width, height } = stageSizeForAspect(
    compositionAspectRatio(preview.project),
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
