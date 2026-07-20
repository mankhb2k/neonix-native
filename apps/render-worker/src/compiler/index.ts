import type { MotionProject } from "@motionvideo/motion-schema";

export type CompiledProject = {
  projectId: string;
  sceneCount: number;
  // Later: Motion Canvas scene graph / runtime instructions
  instructions: Array<{ sceneId: string; duration: number; layerCount: number }>;
};

/** Motion JSON → engine-agnostic compile IR (Motion Canvas adapter later) */
export function compileMotionProject(project: MotionProject): CompiledProject {
  return {
    projectId: project.id,
    sceneCount: project.scenes.length,
    instructions: project.scenes.map((scene) => ({
      sceneId: scene.id,
      duration: scene.duration,
      layerCount: scene.layers.length,
    })),
  };
}
