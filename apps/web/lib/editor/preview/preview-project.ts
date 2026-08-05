import { compileMotionProject } from "@motionvideo/motion-compiler";
import {
  buildRenderSnapshot,
  type RenderSnapshot,
} from "@motionvideo/motion-runtime";
import type { MotionProject } from "@motionvideo/motion-schema";
import {
  createDemoMotionProject,
  DEMO_SCENE_ID,
} from "@motionvideo/remotion-renderer";
import { stageSizeForAspect } from "@/lib/runtime/preview-evaluate";

/** Project used for Remotion preview + hit-test (demo when blank). */
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
  const demo = createDemoMotionProject();
  return { project: demo, usingDemo: true, sceneId: DEMO_SCENE_ID };
}

export function buildPreviewSnapshot(
  project: MotionProject,
  time = 0,
  frame = 0,
): RenderSnapshot | null {
  const preview = resolvePreviewProject(project);
  const runtime = compileMotionProject(preview.project);
  const scene =
    runtime.scenes.find((s) => s.id === preview.sceneId) ?? runtime.scenes[0];
  if (!scene) return null;
  const { width, height } = stageSizeForAspect(
    preview.project.metadata.aspectRatio,
  );
  return buildRenderSnapshot({
    scene,
    time,
    frame,
    width,
    height,
    background: "#0c0b0a",
  });
}
