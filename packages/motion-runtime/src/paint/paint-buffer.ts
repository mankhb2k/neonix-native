import type { PaintCommand, RenderDiagnostic } from "./paint-command";

/** Versioned backend-neutral command buffer emitted by Runtime V2. */
export const PAINT_COMMAND_VERSION = 1 as const;

export type PaintCommandBuffer = {
  version?: typeof PAINT_COMMAND_VERSION;
  commands: PaintCommand[];
  diagnostics: RenderDiagnostic[];
};
