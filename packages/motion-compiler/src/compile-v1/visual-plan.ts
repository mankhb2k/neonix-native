import { V1 } from "@motionvideo/motion-protocol";
import type { DiagnosticCollector } from "../compile-result";
import { clone, type JsonRecord } from "./helpers";
import {
  prepareRuntimeScene,
  type ComponentInstanceRef,
} from "./components";

export type VisualPlanEntry = {
  clipId: string;
  sceneId: string;
  /** Authoring clip start carried into runtime (timeline time). */
  start: number;
  /** V1 clip fields propagated to runtime. */
  trimStart?: number;
  playbackRate?: number;
  loop: boolean;
  opacity: number;
};

export type VisualPlanTrack = {
  trackId: string;
  order: number;
  muted?: boolean;
  entries: VisualPlanEntry[];
};

/**
 * Convert `timeline.visualTracks` into a track-preserving visual plan.
 *
 * Each V1 track becomes one runtime track. Track stacking is `order` only.
 * Visual clips are scene-only; component instances live as scene layers and
 * expand into sealed wrapper-group subgraphs during scene preparation.
 */
export function buildVisualPlan(
  project: V1.MotionProjectV1,
  collector: DiagnosticCollector,
): {
  tracks: VisualPlanTrack[];
  sceneOverrides: Map<string, JsonRecord>;
  componentInstances: Map<string, ComponentInstanceRef>;
} {
  const scenes = new Map(
    project.scenes.map((scene) => [scene.id, scene] as const),
  );
  const components = new Map(
    project.components.map((component) => [component.id, component] as const),
  );
  const projectVariables = new Map<string, unknown>(
    project.variables.map((v) => [v.id, clone(v.value)] as const),
  );
  const sceneUsage = new Map<string, number>();
  const componentInstances = new Map<string, ComponentInstanceRef>();
  const sceneOverrides = new Map<string, JsonRecord>();
  const tracks: VisualPlanTrack[] = [];

  const v3Tracks = [...project.timeline.visualTracks].sort(
    (a, b) => a.order - b.order,
  );
  const hasVisualClips = v3Tracks.some((track) => track.clips.length > 0);
  if (!hasVisualClips) {
    collector.error(
      "CMP_TIMELINE_VISUAL_EMPTY",
      "Timeline has no visual clips; add at least one visual clip or remove scenes that should not render",
      {
        path: ["timeline", "visualTracks"],
      },
    );
    return { tracks, sceneOverrides, componentInstances };
  }
  for (const v3Track of v3Tracks) {
    const trackEntries: VisualPlanEntry[] = [];
    for (const clip of v3Track.clips) {
      const sourceScene = scenes.get(clip.source.sceneId);
      if (!sourceScene) {
        collector.error(
          "CMP_CLIP_TARGET_MISSING",
          `Visual clip "${clip.id}" references unknown scene "${clip.source.sceneId}"`,
          {
            path: ["timeline", "visualTracks", v3Track.id, "clips", clip.id],
            details: { clipId: clip.id, sceneId: clip.source.sceneId },
          },
        );
        continue;
      }
      const sourceRefPath = ["scenes", sourceScene.id];

      const usage = sceneUsage.get(sourceScene.id) ?? 0;
      sceneUsage.set(sourceScene.id, usage + 1);
      const reuse =
        usage > 0 ||
        Math.abs(sourceScene.duration - clip.duration) > 1e-9 ||
        clip.trimStart !== undefined;
      const sceneId = reuse ? `${sourceScene.id}@${clip.id}` : sourceScene.id;
      const scene = prepareRuntimeScene(
        sourceScene,
        components,
        componentInstances,
        sceneId,
        {
          authoringSceneId: sourceScene.id,
          bindings: project.bindings,
          variables: projectVariables,
        },
      );
      if (reuse) {
        scene.duration = clip.duration;
      }
      scene.sourceRef = reuse
        ? {
            projectPath: sourceRefPath,
            sourceModule: clip.id,
          }
        : { projectPath: sourceRefPath };
      sceneOverrides.set(sceneId, scene);
      trackEntries.push({
        clipId: clip.id,
        sceneId,
        start: clip.start,
        trimStart: clip.trimStart,
        playbackRate: clip.playbackRate,
        loop: clip.loop,
        opacity: clip.opacity,
      });
    }
    if (trackEntries.length > 0) {
      tracks.push({
        trackId: v3Track.id,
        order: v3Track.order,
        muted: v3Track.muted,
        entries: trackEntries,
      });
    }
  }
  return { tracks, sceneOverrides, componentInstances };
}
