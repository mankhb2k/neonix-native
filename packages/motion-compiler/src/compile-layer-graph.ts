/**
 * Compile an in-memory layer graph plus runtime propertyAnimations.
 *
 * V1 animation input is already propertyAnimations (from timeline.clips and
 * component prop keyframes). There is no InternalAnimationUnitV1 bridge.
 */
import { type MotionLayer } from "@motionvideo/motion-protocol";
import {
  type MotionRuntimeProject,
  type RuntimeLayerGraph,
  type RuntimeSourceRef,
} from "@motionvideo/motion-protocol/runtime";
import { applyLayoutConstraints } from "./layout-solver";

type RuntimePropertyAnimation = MotionRuntimeProject["propertyAnimations"][number];
type RuntimeNode = Exclude<
  MotionRuntimeProject["layers"][number],
  { type: "audio" }
>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergePropertyAnimations(
  animations: RuntimePropertyAnimation[],
): RuntimePropertyAnimation[] {
  const merged = new Map<string, RuntimePropertyAnimation>();
  for (const animation of animations) {
    const key = `${animation.layerId}\u0000${animation.property}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, {
        ...clone(animation),
        keys: [...animation.keys],
      });
      continue;
    }
    const byTime = new Map(
      current.keys.map((keyframe) => [keyframe.t, keyframe]),
    );
    for (const keyframe of animation.keys) byTime.set(keyframe.t, keyframe);
    current.keys = [...byTime.values()].sort((a, b) => a.t - b.t);
  }
  return [...merged.values()];
}

export function compileLayerGraphToRuntime(input: {
  id: string;
  duration: number;
  layers: MotionLayer[];
  propertyAnimations?: RuntimePropertyAnimation[];
  /** Unused on this path: V1 variables reach internals only via prop bindings. */
  variables: Map<string, unknown>;
  space?: RuntimeLayerGraph["space"];
  motionBlur?: RuntimeLayerGraph["motionBlur"];
  drivers?: RuntimeLayerGraph["drivers"];
  activeCameraLayerId?: string;
  sourceRef?: RuntimeSourceRef;
}): RuntimeLayerGraph {
  const laidOut = applyLayoutConstraints(clone(input.layers));
  const runtimeNodes: RuntimeNode[] = laidOut.map((node) =>
    node.type === "path"
      ? {
          ...node,
          payload: {
            ...node.payload,
            fillRule: node.payload.fillRule ?? ("nonzero" as const),
          },
        }
      : node,
  ) as RuntimeNode[];
  const sourceRef = input.sourceRef ?? {
    projectPath: ["layers", input.id],
  };
  return {
    id: input.id,
    duration: input.duration,
    ...(input.space ? { space: input.space } : {}),
    ...(input.motionBlur ? { motionBlur: input.motionBlur } : {}),
    ...(input.drivers && input.drivers.length > 0
      ? { drivers: clone(input.drivers) }
      : {}),
    ...(input.activeCameraLayerId
      ? { activeCameraLayerId: input.activeCameraLayerId }
      : {}),
    sourceRef,
    layers: runtimeNodes,
    propertyAnimations: mergePropertyAnimations(input.propertyAnimations ?? []),
  };
}
