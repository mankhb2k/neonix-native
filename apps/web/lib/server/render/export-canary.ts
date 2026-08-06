/**
 * Local export canary gate — records engine/capability for jobs.
 */

export type ExportCanaryRecord = {
  engine: "remotion-lambda" | "remotion-local" | "stub";
  paintCommandVersion: number;
  capabilityManifest: string;
  preflightOk: boolean;
  productionGate: boolean;
};

export function buildExportCanaryRecord(input: {
  engine: ExportCanaryRecord["engine"];
  paintCommandVersion: number;
  capabilityManifest: string;
  preflightOk: boolean;
}): ExportCanaryRecord {
  return {
    ...input,
    productionGate: process.env.MOTICLIP_EXPORT_PRODUCTION_GATE === "1",
  };
}
