/**
 * Migration diagnostics — emitted while migrating v2 → v3.
 */
export type MigrationDiagnosticSeverity = "info" | "warning" | "error";

export type MigrationDiagnosticCode =
  | "MIG_MISSING_AUDIO_DURATION"
  | "MIG_TRANSITION_OVERFLOW"
  | "MIG_UNSUPPORTED_COMPONENT"
  | "MIG_BRAND_FONT_UNRESOLVED"
  | "MIG_ASPECT_PRESET_AMBIGUOUS"
  | "MIG_SCENE_ORDER_EMPTY";

export interface MigrationDiagnostic {
  code: MigrationDiagnosticCode;
  severity: MigrationDiagnosticSeverity;
  message: string;
  path?: string;
}

export function createDiagnostic(
  code: MigrationDiagnosticCode,
  severity: MigrationDiagnosticSeverity,
  message: string,
  path?: string,
): MigrationDiagnostic {
  return { code, severity, message, path };
}
