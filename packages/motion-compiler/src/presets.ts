/** Closed allowlist of Clip.source.presetId values the compiler expands. */

export const COMPILED_PRESET_IDS = Object.freeze([
  "fade-in",
  "fade-up",
  "fade-down",
  "fade-left",
  "fade-right",
  "slide-up",
  "slide-left",
  "slide-right",
  "scale-in",
  "zoom-in",
  "pop",
  "counter",
] as const);

export type CompiledPresetId = (typeof COMPILED_PRESET_IDS)[number];

export function isCompiledPreset(
  presetId: string,
): presetId is CompiledPresetId {
  return (COMPILED_PRESET_IDS as readonly string[]).includes(presetId);
}
