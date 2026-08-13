import type {
  MotionRuntimeProject,
  MotionRuntimeScene,
} from "@motionvideo/motion-protocol";

export const ROOT_LAYER_GRAPH_ID = "root";

/** In-memory visual graph for `evaluateFrame` — audio stays on `project.layers`. */
export function layerGraphFromRuntime(
  runtime: MotionRuntimeProject,
): MotionRuntimeScene {
  return {
    id: ROOT_LAYER_GRAPH_ID,
    duration: runtime.timeline.duration,
    layers: runtime.layers.filter(
      (layer): layer is Exclude<(typeof runtime.layers)[number], { type: "audio" }> =>
        layer.type !== "audio",
    ),
    tracks: runtime.tracks,
    ...(runtime.space ? { space: runtime.space } : {}),
    ...(runtime.motionBlur ? { motionBlur: runtime.motionBlur } : {}),
    ...(runtime.drivers && runtime.drivers.length > 0
      ? { drivers: runtime.drivers }
      : {}),
    ...(runtime.activeCameraLayerId
      ? { activeCameraLayerId: runtime.activeCameraLayerId }
      : {}),
  };
}

export function audioLayersFromRuntime(runtime: MotionRuntimeProject) {
  return runtime.layers.filter(
    (layer): layer is Extract<typeof layer, { type: "audio" }> =>
      layer.type === "audio",
  );
}
