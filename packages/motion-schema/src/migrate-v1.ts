import type { MotionProjectV1 } from "./legacy-v1";
import { parseMotionProjectV2, type MotionProjectV2, type MotionNode } from "./v2";

function transform(x: number, y: number): MotionNode["transform"] {
  return {
    x,
    y,
    width: 0,
    height: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    anchorX: 0.5,
    anchorY: 0.5,
    opacity: 1,
    visible: true,
    flipX: false,
    flipY: false,
  };
}

export function migrateMotionProjectV1ToV2(project: MotionProjectV1): MotionProjectV2 {
  const now = new Date().toISOString();
  const migrated = {
    format: "motion-project",
    formatVersion: 2,
    metadata: {
      id: project.id,
      name: project.brand.name,
      aspectRatio: project.aspectRatio,
      fps: 30,
      locale: project.locale,
      industry: project.industry,
      brand: { ...project.brand },
      updatedAt: now,
    },
    dependencies: { components: [] },
    assets: [],
    variables: [
      { id: "project.brandName", type: "string", name: "Brand Name", value: project.brand.name },
      { id: "project.primaryColor", type: "color", name: "Primary Color", value: project.brand.primaryColor ?? "#1A5D3A" },
    ],
    timeline: {
      sceneOrder: project.scenes.map((scene) => scene.id),
      audioTracks: [],
    },
    scenes: project.scenes.map((scene) => ({
      id: scene.id,
      name: scene.role ?? scene.id,
      duration: scene.duration,
      semantic: scene.role ? { role: scene.role, tags: [] } : undefined,
      activeCameraId: undefined,
      nodes: scene.layers.map((layer, index) => ({
        id: layer.id,
        type: layer.type,
        parentId: null,
        zIndex: index,
        transform: transform(540 + layer.x, 960 + layer.y),
        payload: {
          ...(layer.content !== undefined ? { text: layer.content } : {}),
          ...(layer.assetId !== undefined ? { assetId: layer.assetId } : {}),
        },
      })),
      clips: scene.layers.flatMap((layer) =>
        layer.animations.map((animation, index) => ({
          id: `clip.${layer.id}.${index}`,
          targetId: layer.id,
          schedule: { kind: "absolute" as const, at: animation.start + (animation.delay ?? 0) },
          duration: animation.duration,
          playback: { iterations: 1 as const, direction: "normal" as const, rate: 1 },
          source: {
            kind: "preset" as const,
            presetId: animation.preset,
            params: animation.params,
          },
        })),
      ),
    })),
    bindings: [],
    extensions: { constraints: [], events: [] },
  };
  return parseMotionProjectV2(migrated);
}
