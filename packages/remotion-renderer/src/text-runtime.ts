import type { RuntimeProjectV2 } from "@motionvideo/motion-runtime";

/**
 * Remotion receives a fully prepared Runtime IR. Shaping and font I/O happen
 * in the export host before input props are serialized, never inside React.
 */
export function assertRemotionTextPrepared(runtime: RuntimeProjectV2): RuntimeProjectV2 {
  const pending = runtime.nodes.filter(
    (node) => node.content.kind === "text" && node.content.layout === undefined,
  );
  if (pending.length > 0) {
    throw new Error(
      `Remotion requires Runtime V2 text glyph layouts before export: ${pending.map((node) => node.id).join(", ")}`,
    );
  }
  return runtime;
}
