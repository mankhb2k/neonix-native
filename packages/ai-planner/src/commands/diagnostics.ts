export type DiagnosticSeverity = "error" | "warning" | "info";

export type Diagnostic = {
  code: string;
  path: string;
  message: string;
  severity: DiagnosticSeverity;
  repairHint?: string;
};

export type CommandReceipt = {
  revision: number;
  changedIds: string[];
  diagnostics: Diagnostic[];
};

export function diagnostic(
  code: string,
  path: string,
  message: string,
  options: { severity?: DiagnosticSeverity; repairHint?: string } = {},
): Diagnostic {
  return {
    code,
    path,
    message,
    severity: options.severity ?? "error",
    ...(options.repairHint ? { repairHint: options.repairHint } : {}),
  };
}

export function unsupportedCapability(commandType: string): Diagnostic {
  return diagnostic(
    "unsupported_capability",
    `commands.${commandType}`,
    `Command ${commandType} is not implemented in R1`,
    {
      severity: "error",
      repairHint: `Defer ${commandType} until the owning roadmap wave (R2–R5) or remove it from the batch`,
    },
  );
}
