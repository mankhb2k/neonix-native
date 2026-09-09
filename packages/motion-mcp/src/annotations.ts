import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * Keep all MCP hints explicit instead of relying on protocol defaults. Some
 * hosts validate these fields and clients may apply conservative defaults
 * when a hint is omitted.
 */
export type NeonixToolAnnotations = ToolAnnotations & {
  readOnlyHint: boolean;
  openWorldHint: boolean;
  destructiveHint: boolean;
};

export const READ_ONLY_TOOL_ANNOTATIONS: NeonixToolAnnotations = {
  readOnlyHint: true,
  openWorldHint: false,
  destructiveHint: false,
  idempotentHint: true,
};

export const ADDITIVE_TOOL_ANNOTATIONS: NeonixToolAnnotations = {
  readOnlyHint: false,
  openWorldHint: false,
  destructiveHint: false,
  idempotentHint: false,
};

export const EXTERNAL_IMPORT_TOOL_ANNOTATIONS: NeonixToolAnnotations = {
  readOnlyHint: false,
  openWorldHint: true,
  destructiveHint: false,
  idempotentHint: false,
};

export const DESTRUCTIVE_TOOL_ANNOTATIONS: NeonixToolAnnotations = {
  readOnlyHint: false,
  openWorldHint: false,
  destructiveHint: true,
  idempotentHint: false,
};
