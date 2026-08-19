import type { CompileV1Options } from "@motionvideo/motion-compiler";
import type {
  MCPToolOperation,
  MCPToolResult,
} from "./mcp";
import {
  applyPatch,
  compileProject,
  createProject,
  validateProject,
} from "./operations";
import {
  explainDiagnostics,
  inspectTimeline,
  listCapabilities,
} from "./mcp";

export class MotionMcpUnsupportedToolError extends Error {
  constructor(toolName: string) {
    super(`Tool "${toolName}" is not implemented in @motionvideo/motion-mcp yet.`);
  }
}

export type ExecuteMotionMcpOptions = {
  compileOptions?: CompileV1Options;
};

export function executeMotionMcpOperation(
  operation: MCPToolOperation,
  options: ExecuteMotionMcpOptions = {},
): MCPToolResult {
  switch (operation.tool) {
    case "create_project":
      return { tool: operation.tool, result: createProject(operation.input) };
    case "validate_project":
      return { tool: operation.tool, result: validateProject(operation.input) };
    case "apply_patch":
      return { tool: operation.tool, result: applyPatch(operation.input) };
    case "compile_project":
      return {
        tool: operation.tool,
        result: compileProject(operation.input, options.compileOptions),
      };
    case "list_capabilities":
      return {
        tool: operation.tool,
        result: listCapabilities(
          operation.input.filter,
          operation.input.includeExperimental,
        ),
      };
    case "inspect_timeline":
      return {
        tool: operation.tool,
        result: inspectTimeline(
          operation.input.project,
          operation.input.layerId,
        ),
      };
    case "explain_diagnostics":
      return {
        tool: operation.tool,
        result: explainDiagnostics(operation.input),
      };
    case "render_preview_frame":
      throw new MotionMcpUnsupportedToolError(operation.tool);
  }
}
