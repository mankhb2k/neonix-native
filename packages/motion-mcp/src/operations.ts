import {
  MotionProtocolV2Schema,
  type MotionProtocolV2,
} from "@motionvideo/motion-protocol/v2";
import {
  compileProtocolV2,
} from "@motionvideo/motion-compiler";
import { computeRuntimeHash, shortHash } from "@motionvideo/render-contracts";
import type { MCPApplyPatchInput, MCPApplyPatchResult, MCPCapabilityCheck, MCPCompileProjectInput, MCPCompileProjectResult, MCPCreateProjectInput, MCPCreateProjectResult, MCPValidateProjectInput, MCPValidateProjectResult } from "./mcp";
import { computeMCPProjectHash, preflightCapabilities } from "./mcp";
import { applyMotionProtocolV2Patch } from "./patch";

type Diagnostic = { path: string; message: string; severity: "error" | "warning" | "info" };

function withProjectHash<T extends { warnings: string[] }>(project: MotionProtocolV2, payload: T): T & { projectHash: string; projectHashShort: string } {
  return { ...payload, ...computeMCPProjectHash(project) };
}

function emptyCapabilityCheck(): MCPCapabilityCheck {
  return { available: [], missing: [], recommended: [], experimental: [], allowed: true };
}

export function createProject(input: MCPCreateProjectInput): MCPCreateProjectResult {
  const project: MotionProtocolV2 = {
    format: "motion-protocol",
    formatVersion: 2,
    id: input.id,
    composition: input.composition,
    assets: input.assets,
    layers: input.layers,
    audio: input.audio,
  };
  return withProjectHash(project, {
    warnings: [],
    project,
    ...(input.skillId ? { skillApplied: input.skillId } : {}),
  });
}

export function validateProject(input: MCPValidateProjectInput): MCPValidateProjectResult {
  const parsed = MotionProtocolV2Schema.safeParse(input.project);
  if (!parsed.success) {
    return {
      warnings: [],
      valid: false,
      diagnostics: parsed.error.issues.map((issue) => ({ path: issue.path.join(".") || "project", message: issue.message, severity: "error" as const })),
      capabilityCheck: emptyCapabilityCheck(),
    };
  }
  const capabilityCheck = preflightCapabilities(parsed.data, []);
  return withProjectHash(parsed.data, {
    warnings: [],
    valid: capabilityCheck.allowed,
    diagnostics: [],
    capabilityCheck,
  });
}

export function applyPatch(input: MCPApplyPatchInput): MCPApplyPatchResult {
  const result = applyMotionProtocolV2Patch(input.project, input.patch);
  const diagnostics = result.diagnostics.map((diagnostic) => ({ ...diagnostic }));
  if (!result.project) return { warnings: [], applied: false, project: null, diagnostics };
  return withProjectHash(result.project, {
    warnings: [],
    applied: !diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    project: result.project,
    diagnostics,
  });
}

export function compileProject(input: MCPCompileProjectInput): MCPCompileProjectResult {
  try {
    const runtime = compileProtocolV2(input.project);
    const runtimeProject = runtime as unknown as Record<string, unknown>;
    const runtimeHash = computeRuntimeHash(runtimeProject);
    const diagnostics: Diagnostic[] = [];
    return withProjectHash(input.project, {
      warnings: [],
      runtimeProject,
      runtimeHash,
      runtimeHashShort: shortHash(runtimeHash),
      compilerVersion: "protocol-v2",
      diagnostics,
    });
  } catch (error) {
    return withProjectHash(input.project, {
      warnings: [],
      runtimeProject: {},
      compilerVersion: "protocol-v2",
      diagnostics: [{ path: "project", message: error instanceof Error ? error.message : String(error), severity: "error" }],
    });
  }
}
