import { wave1CapabilityPromptBlock } from "@motionvideo/motion-runtime";

/**
 * Closed command allowlist for zero-template model generation (P0.2).
 * Unsupported stubs must not appear here.
 */
export const MODEL_ALLOWED_COMMAND_TYPES = [
  "createProject",
  "setArtDirection",
  "addScene",
  "setSceneTiming",
  "reorderScenes",
  "addNode",
  "removeNode",
  "addTrack",
  "validateProject",
  "compileProject",
  "applyRepairPatch",
  "setLayoutConstraint",
  "addMask",
  "addEffect",
  "setCamera",
  "addDriver",
  "applyRecipe",
  "renderContactSheet",
  "renderPreviewRange",
  "addImageNode",
  "addSvgNode",
  "addPathNode",
  "setNodePayload",
  "setSceneTransition",
  "setSceneBackground",
] as const;

/** Server-only — not emitted by model. */
export const SERVER_ONLY_COMMAND_TYPES = ["registerAsset"] as const;

export type ModelAllowedCommandType = (typeof MODEL_ALLOWED_COMMAND_TYPES)[number];

export const MODEL_BLOCKED_COMMAND_TYPES = [
  "addComponentInstance",
  "addAudioCue",
  "addAudioTrack",
  "addVideoNode",
] as const;

export function isModelAllowedCommand(type: string): type is ModelAllowedCommandType {
  return (MODEL_ALLOWED_COMMAND_TYPES as readonly string[]).includes(type);
}

/** Truncated capability summary injected into model prompts. */
export function modelCapabilityPromptBlock(): string {
  return [
    wave1CapabilityPromptBlock(),
    "Allowed authoring commands (closed):",
    MODEL_ALLOWED_COMMAND_TYPES.join(", "),
    "Forbidden (unsupported — never emit):",
    MODEL_BLOCKED_COMMAND_TYPES.join(", "),
    "Scene transitions: cut | fade | crossfade only (no push).",
    "addNode nodeType: group | text | shape. Prefer addImageNode/addSvgNode/addPathNode for media/paths.",
    "Do not emit MotionProject JSON blobs. Emit typed command batches only.",
  ].join("\n");
}
