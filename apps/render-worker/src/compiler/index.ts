import type { MotionProject } from "@motionvideo/motion-schema";
import { resolvePresetId } from "@motionvideo/template-library";

export type CompiledLayer = {
  id: string;
  type: string;
  content?: string;
  x: number;
  y: number;
  animations: Array<{
    preset: string;
    start: number;
    duration: number;
    delay: number;
    easing: string;
    params?: Record<string, unknown>;
  }>;
};

export type CompiledScene = {
  sceneId: string;
  role?: string;
  duration: number;
  layers: CompiledLayer[];
};

export type CompiledProject = {
  projectId: string;
  aspectRatio: MotionProject["aspectRatio"];
  brand: MotionProject["brand"];
  sceneCount: number;
  scenes: CompiledScene[];
  totalDuration: number;
};

/** Motion JSON → engine-agnostic compile IR (reference renderer / adapters later) */
export function compileMotionProject(project: MotionProject): CompiledProject {
  const scenes: CompiledScene[] = project.scenes.map((scene) => ({
    sceneId: scene.id,
    role: scene.role,
    duration: scene.duration,
    layers: scene.layers.map((layer) => ({
      id: layer.id,
      type: layer.type,
      content: layer.content,
      x: layer.x,
      y: layer.y,
      animations: layer.animations.map((a) => ({
        preset: resolvePresetId(a.preset),
        start: a.start,
        duration: a.duration,
        delay: a.delay ?? 0,
        easing: a.easing ?? "easeOut",
        params: a.params,
      })),
    })),
  }));

  return {
    projectId: project.id,
    aspectRatio: project.aspectRatio,
    brand: project.brand,
    sceneCount: scenes.length,
    scenes,
    totalDuration: scenes.reduce((sum, s) => sum + s.duration, 0),
  };
}
