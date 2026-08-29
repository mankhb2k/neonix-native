import type { RuntimeProjectV3 } from "@motionvideo/motion-runtime";

/**
 * Remotion receives a fully prepared Runtime IR. Shaping and font I/O happen
 * in the export host before input props are serialized, never inside React.
 */
export function assertRemotionTextPrepared(runtime: RuntimeProjectV3): RuntimeProjectV3 {
  const pending = runtime.visual.nodes.filter(
    (node) => node.content.kind === "text" && node.content.layout === undefined,
  );
  if (pending.length > 0) {
    throw new Error(
      `Remotion requires Runtime V3 text glyph layouts before export: ${pending.map((node) => node.id).join(", ")}`,
    );
  }
  return runtime;
}
