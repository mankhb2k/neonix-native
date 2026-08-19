import {
  type MotionProjectV1,
  MotionProjectV1Schema,
} from "@motionvideo/motion-protocol";
import { computeRuntimeHash, shortHash } from "@motionvideo/render-contracts";
import type { MotionProjectV1Patch } from "./patch";
import { applyMotionProjectV1Patch } from "./patch";
import {
  compileMotionProjectV1,
  COMPILER_VERSION_V1,
} from "@motionvideo/motion-compiler";
import type { CompileV1Options } from "@motionvideo/motion-compiler";
import type {
  MCPApplyPatchInput,
  MCPApplyPatchResult,
  MCPCapabilityCheck,
  MCPCompileProjectInput,
  MCPCompileProjectResult,
  MCPCreateProjectInput,
  MCPCreateProjectResult,
  MCPValidateProjectInput,
  MCPValidateProjectResult,
} from "./mcp";
import { computeMCPProjectHash } from "./mcp";

type DiagnosticSeverity = "error" | "warning" | "info";

type CompileDiagnosticLike = {
  path?: readonly (string | number)[];
  message: string;
  severity: DiagnosticSeverity;
};

function emptyCapabilityCheck(): MCPCapabilityCheck {
  return {
    available: [],
    missing: [],
    recommended: [],
    experimental: [],
    allowed: true,
  };
}

function withProjectHash<T extends { warnings: string[] }>(
  project: MotionProjectV1,
  payload: T,
): T & { projectHash: string; projectHashShort: string } {
  return {
    ...payload,
    ...computeMCPProjectHash(project),
  };
}

function diagnosticPath(path?: readonly (string | number)[]): string {
  return Array.isArray(path) ? path.join(".") : "project";
}

export function createProject(
  input: MCPCreateProjectInput,
): MCPCreateProjectResult {
  const project: MotionProjectV1 = {
    format: "motion-project",
    formatVersion: 1,
    metadata: input.metadata,
    composition: input.composition,
    assets: [],
    components: [],
    layers: [],
  };

  return withProjectHash(project, {
    warnings: [],
    project,
    ...(input.skillId ? { skillApplied: input.skillId } : {}),
  });
}

export function validateProject(
  input: MCPValidateProjectInput,
): MCPValidateProjectResult {
  const diagnostics: MCPValidateProjectResult["diagnostics"] = [];
  const parsed = MotionProjectV1Schema.safeParse(input.project);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      diagnostics.push({
        path: issue.path.join(".") || "project",
        message: issue.message,
        severity: "error",
      });
    }
    return {
      warnings: [],
      valid: false,
      diagnostics,
      capabilityCheck: emptyCapabilityCheck(),
    };
  }

  for (const issue of V1.validateMotionProjectV1References(parsed.data)) {
    diagnostics.push({
      path: issue.path,
      message: issue.message,
      severity: "error",
    });
  }

  return withProjectHash(parsed.data, {
    warnings: [],
    valid: diagnostics.length === 0,
    diagnostics,
    capabilityCheck: emptyCapabilityCheck(),
  });
}

export function applyPatch(input: MCPApplyPatchInput): MCPApplyPatchResult {
  const result = applyMotionProjectV1Patch(
    input.project,
    input.patch as MotionProjectV1Patch,
  );

  if (!result.project) {
    return {
      warnings: [],
      applied: false,
      project: null,
      diagnostics: result.diagnostics.map((diagnostic) => ({
        path: diagnostic.path,
        message: diagnostic.message,
        severity: diagnostic.severity,
      })),
    };
  }

  return withProjectHash(result.project, {
    warnings: [],
    applied: !result.diagnostics.some(
      (diagnostic) => diagnostic.severity === "error",
    ),
    project: result.project,
    diagnostics: result.diagnostics.map(
      (diagnostic: {
        path: string;
        message: string;
        severity: "error" | "warning";
      }) => ({
        path: diagnostic.path,
        message: diagnostic.message,
        severity: diagnostic.severity,
      }),
    ),
  });
}

export function compileProject(
  input: MCPCompileProjectInput,
  options: CompileV1Options = {},
): MCPCompileProjectResult {
  const compile = compileMotionProjectV1(input.project, options);
  if (!compile.ok) {
    return withProjectHash(input.project, {
      warnings: [],
      runtimeProject: {},
      compilerVersion: COMPILER_VERSION_V1,
      diagnostics: compile.diagnostics.map(
        (diagnostic: CompileDiagnosticLike) => ({
          path: diagnosticPath(diagnostic.path),
          message: diagnostic.message,
          severity: diagnostic.severity,
        }),
      ),
    });
  }

  const runtimeProject = compile.project as unknown as Record<string, unknown>;
  const runtimeHash = computeRuntimeHash(runtimeProject);

  return withProjectHash(input.project, {
    warnings: [],
    runtimeProject,
    runtimeHash,
    runtimeHashShort: shortHash(runtimeHash),
    compilerVersion: COMPILER_VERSION_V1,
    diagnostics: compile.diagnostics.map(
      (diagnostic: CompileDiagnosticLike) => ({
        path: diagnosticPath(diagnostic.path),
        message: diagnostic.message,
        severity: diagnostic.severity,
      }),
    ),
  });
}
