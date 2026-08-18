import { compileMotionProject } from "@motionvideo/motion-compiler";
import {
  evaluateScene,
  layerGraphFromRuntime,
} from "@motionvideo/motion-runtime";
import type { MotionProject } from "@motionvideo/motion-protocol";

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
  const graph = layerGraphFromRuntime(runtime);
  if (graph.layers.length === 0 && !(graph.duration > 0)) {
    return {
      width: options.width ?? 256,
      height: options.height ?? 256,
      frames: [],
    };
  }
  const times = options.times ?? [
    0,
    graph.duration * 0.25,
    graph.duration * 0.5,
    graph.duration * 0.75,
    Math.max(0, graph.duration - 0.001),
  ];
  const frames = times.map((time) => {
    const evaluated = evaluateScene(graph, time);
    const fingerprint = evaluated
      .map(
        (item) =>
          `${item.layer.id}:${item.transform.x.toFixed(2)},${item.transform.y.toFixed(2)},${item.transform.opacity.toFixed(3)}`,
      )
      .join("|");
    return {
      sceneId: graph.id,
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
