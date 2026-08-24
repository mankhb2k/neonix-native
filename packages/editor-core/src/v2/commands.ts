import { compileProtocolV2 } from "@motionvideo/motion-compiler";
import {
  MotionProtocolV2Schema,
  type MotionProtocolV2,
} from "@motionvideo/motion-protocol/v2";

type V2Layer = MotionProtocolV2["layers"][number];

/** Recursive patch accepted by the V2 editor surface. */
export type DeepPartial<T> = T extends readonly (infer Item)[]
  ? readonly DeepPartial<Item>[]
  : T extends object
    ? { [Key in keyof T]?: DeepPartial<T[Key]> }
    : T;

export type V2LayerPatch = DeepPartial<V2Layer>;

/**
 * Commands operate on the Protocol V2 document directly. Session/UI state
 * (selection, playhead, zoom) is deliberately excluded.
 */
export type V2EditorCommand =
  | { type: "add-layer"; layer: V2Layer }
  | { type: "remove-layer"; layerId: string }
  | { type: "patch-layer"; layerId: string; patch: V2LayerPatch }
  | { type: "replace-layer"; layerId: string; layer: V2Layer };

export type V2EditorDiagnostic = {
  severity: "error" | "warning";
  code:
    | "document_invalid"
    | "command_invalid"
    | "layer_not_found"
    | "compile_invalid";
  message: string;
  path?: readonly (string | number)[];
};

export type V2EditorCommandResult =
  | {
      ok: true;
      document: MotionProtocolV2;
      inverse: V2EditorCommand;
      diagnostics: readonly V2EditorDiagnostic[];
    }
  | {
      ok: false;
      document: MotionProtocolV2;
      diagnostics: readonly V2EditorDiagnostic[];
    };

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Merge nested object fields while replacing scalar and array values. */
function mergePatch<T>(value: T, patch: DeepPartial<T>): T {
  if (!isRecord(value) || !isRecord(patch)) return patch as T;
  const result: Record<string, unknown> = { ...value };
  for (const [key, nextValue] of Object.entries(patch)) {
    if (nextValue === undefined) continue;
    const previousValue = result[key];
    result[key] =
      isRecord(previousValue) && isRecord(nextValue)
        ? mergePatch(previousValue, nextValue)
        : nextValue;
  }
  return result as T;
}

function diagnosticsFromSchema(error: {
  issues: Array<{ message: string; path: (string | number)[] }>;
}): V2EditorDiagnostic[] {
  return error.issues.map((issue) => ({
    severity: "error",
    code: "document_invalid",
    message: issue.message,
    path: issue.path,
  }));
}

function reject(
  document: MotionProtocolV2,
  diagnostics: readonly V2EditorDiagnostic[],
): V2EditorCommandResult {
  return { ok: false, document, diagnostics };
}

/**
 * Apply one V2 document command atomically. The source document is never
 * mutated; invalid schema/compiler output is rejected before it reaches UI.
 */
export function applyV2EditorCommand(
  input: MotionProtocolV2,
  command: V2EditorCommand,
): V2EditorCommandResult {
  const original = clone(input);
  const parsedOriginal = MotionProtocolV2Schema.safeParse(original);
  if (!parsedOriginal.success) {
    return reject(original, diagnosticsFromSchema(parsedOriginal.error));
  }

  const commit = (
    next: MotionProtocolV2,
    inverse: V2EditorCommand,
  ): V2EditorCommandResult => {
    const parsedNext = MotionProtocolV2Schema.safeParse(next);
    if (!parsedNext.success) {
      return reject(original, diagnosticsFromSchema(parsedNext.error));
    }

    try {
      compileProtocolV2(parsedNext.data);
    } catch (error) {
      return reject(original, [
        {
          severity: "error",
          code: "compile_invalid",
          message: error instanceof Error ? error.message : String(error),
        },
      ]);
    }

    return { ok: true, document: parsedNext.data, inverse, diagnostics: [] };
  };

  if (command.type === "add-layer") {
    if (original.layers.some((layer) => layer.id === command.layer.id)) {
      return reject(original, [
        {
          severity: "error",
          code: "command_invalid",
          message: `Layer id already exists: ${command.layer.id}`,
        },
      ]);
    }
    if (
      original.layers.some(
        (layer) =>
          layer.parentLayerId === command.layer.parentLayerId &&
          layer.order === command.layer.order,
      )
    ) {
      return reject(original, [
        {
          severity: "error",
          code: "command_invalid",
          message: `Duplicate order in sibling scope: ${command.layer.order}`,
        },
      ]);
    }
    if (command.layer.parentLayerId !== null) {
      const parent = original.layers.find(
        (layer) => layer.id === command.layer.parentLayerId,
      );
      if (!parent || parent.type !== "group") {
        return reject(original, [
          {
            severity: "error",
            code: "command_invalid",
            message: "A layer can only be added under an existing group.",
          },
        ]);
      }
    }
    const next = clone(original);
    next.layers.push(clone(command.layer));
    return commit(next, { type: "remove-layer", layerId: command.layer.id });
  }

  const layerIndex = original.layers.findIndex(
    (layer) => layer.id === command.layerId,
  );
  if (layerIndex < 0) {
    return reject(original, [
      {
        severity: "error",
        code: "layer_not_found",
        message: `Layer not found: ${command.layerId}`,
      },
    ]);
  }

  const previousLayer = clone(original.layers[layerIndex]!);
  const next = clone(original);
  if (command.type === "remove-layer") {
    if (original.layers.some((layer) => layer.parentLayerId === command.layerId)) {
      return reject(original, [
        {
          severity: "error",
          code: "command_invalid",
          message: "A layer with children cannot be removed yet.",
        },
      ]);
    }
    next.layers.splice(layerIndex, 1);
    return commit(next, { type: "add-layer", layer: previousLayer });
  }

  next.layers[layerIndex] =
    command.type === "patch-layer"
      ? mergePatch(next.layers[layerIndex]!, command.patch)
      : clone(command.layer);

  return commit(next, {
    type: "replace-layer",
    layerId: previousLayer.id,
    layer: previousLayer,
  });
}
