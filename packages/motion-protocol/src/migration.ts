import { MotionProtocolV2Schema, type MotionProtocolV2 } from "./v2";

export type ProtocolMigrationDiagnostic = {
  code: "legacy_video_muted";
  severity: "warning";
  path: readonly (string | number)[];
  message: string;
};

export type MotionProtocolV2Migration = {
  input: unknown;
  diagnostics: ProtocolMigrationDiagnostic[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * One-way migration for persisted V2 documents written before embedded video
 * audio was explicit. The returned input is safe to pass to the strict V2
 * schema; the original value is never mutated.
 */
export function migrateMotionProtocolV2(input: unknown): MotionProtocolV2Migration {
  if (!isRecord(input) || !Array.isArray(input.layers)) {
    return { input, diagnostics: [] };
  }

  const diagnostics: ProtocolMigrationDiagnostic[] = [];
  const layers = input.layers.map((layer, layerIndex) => {
    if (!isRecord(layer) || layer.type !== "video" || !isRecord(layer.payload)) return layer;
    if (!Object.prototype.hasOwnProperty.call(layer.payload, "muted")) return layer;

    const payload = { ...layer.payload };
    const muted = payload.muted === true;
    delete payload.muted;
    if (!isRecord(payload.audio)) {
      payload.audio = { enabled: !muted, gainDb: 0 };
    }
    diagnostics.push({
      code: "legacy_video_muted",
      severity: "warning",
      path: ["layers", layerIndex, "payload", "muted"],
      message: "Migrated legacy video payload.muted to payload.audio.enabled; save the project to persist the new shape.",
    });
    return { ...layer, payload };
  });

  return { input: { ...input, layers }, diagnostics };
}

export function parseMotionProtocolV2WithMigration(input: unknown): {
  project: MotionProtocolV2;
  diagnostics: ProtocolMigrationDiagnostic[];
} {
  const migrated = migrateMotionProtocolV2(input);
  return {
    project: MotionProtocolV2Schema.parse(migrated.input),
    diagnostics: migrated.diagnostics,
  };
}
