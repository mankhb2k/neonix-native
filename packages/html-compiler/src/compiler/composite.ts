import { V2BlendModeSchema, V2IsolationModeSchema, type V2BlendMode, type V2IsolationMode } from "@motionvideo/motion-protocol/v2";
import { fail } from "./errors";

export type HtmlComposite = {
  blendMode: V2BlendMode;
  isolation?: V2IsolationMode;
};

/** Resolve CSS compositing declarations without changing layout order. */
export function parseComposite(style: Map<string, string>): HtmlComposite | undefined {
  const rawBlendMode = (style.get("mix-blend-mode") ?? "normal").trim().toLowerCase();
  const blendMode = V2BlendModeSchema.safeParse(rawBlendMode);
  if (!blendMode.success) fail("css-mix-blend-mode-unsupported", `Unsupported mix-blend-mode: ${rawBlendMode}`);

  const rawIsolation = (style.get("isolation") ?? "auto").trim().toLowerCase();
  const isolation = V2IsolationModeSchema.safeParse(rawIsolation);
  if (!isolation.success) fail("css-isolation-invalid", `isolation must be auto or isolate: ${rawIsolation}`);

  const resolvedBlendMode = blendMode.data!;
  const resolvedIsolation = isolation.data!;
  if (resolvedBlendMode === "normal" && resolvedIsolation === "auto") return undefined;
  return {
    blendMode: resolvedBlendMode,
    ...(resolvedIsolation === "isolate" ? { isolation: resolvedIsolation } : {}),
  };
}
