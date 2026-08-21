import type { RuntimeBlurEffect, RuntimeEffect } from "../paint/paint-types";

export type RuntimeEffectStep =
  | { kind: "color-adjust"; effect: Extract<RuntimeEffect, { type: "color-adjust" }>; requiresOffscreen: false }
  | { kind: "blur"; effect: RuntimeBlurEffect; requiresOffscreen: true };

/** Shared execution metadata; GPU surfaces remain owned by each backend. */
export function buildRuntimeEffectPlan(
  effects: readonly RuntimeEffect[] | undefined,
): RuntimeEffectStep[] {
  return (effects ?? []).map((effect) =>
    effect.type === "blur"
      ? { kind: "blur" as const, effect, requiresOffscreen: true as const }
      : { kind: "color-adjust" as const, effect, requiresOffscreen: false as const },
  );
}
