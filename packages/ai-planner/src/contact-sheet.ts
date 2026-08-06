import { compileMotionProject } from "@motionvideo/motion-compiler";
import { evaluateScene } from "@motionvideo/motion-runtime";
import type { MotionProject } from "@motionvideo/motion-schema";

export type ContactSheetFrame = {
  sceneId: string;
  time: number;
  /** Deterministic fingerprint from evaluated transforms (no pixels required). */
  fingerprint: string;
  nodeCount: number;
};

export type ContactSheetPlan = {
  width: number;
  height: number;
  frames: ContactSheetFrame[];
};

/** Build contact-sheet plan from evaluated scene samples (R7-P2). */
export function buildContactSheetPlan(
  project: MotionProject,
  options: {
    sceneId?: string;
    times?: number[];
    width?: number;
    height?: number;
  } = {},
): ContactSheetPlan {
  const runtime = compileMotionProject(project);
  const scene =
    runtime.scenes.find((item) => item.id === options.sceneId) ??
    runtime.scenes[0];
  if (!scene) {
    return { width: options.width ?? 256, height: options.height ?? 256, frames: [] };
  }
  const times =
    options.times ??
    [0, scene.duration * 0.25, scene.duration * 0.5, scene.duration * 0.75, Math.max(0, scene.duration - 0.001)];
  const frames = times.map((time) => {
    const evaluated = evaluateScene(scene, time);
    const fingerprint = evaluated
      .map(
        (item) =>
          `${item.node.id}:${item.transform.x.toFixed(2)},${item.transform.y.toFixed(2)},${item.transform.opacity.toFixed(3)}`,
      )
      .join("|");
    return {
      sceneId: scene.id,
      time,
      fingerprint,
      nodeCount: evaluated.length,
    };
  });
  return {
    width: options.width ?? 256,
    height: options.height ?? 256,
    frames,
  };
}
