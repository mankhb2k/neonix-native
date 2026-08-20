/**
 * Decode a validated PaintCommandBuffer into a PaintDisplayList tree.
 */

import {
  assertNeverPaintOp,
  type PaintCommand,
  type PaintDrawCommand,
} from "./paint-command";
import type { PaintCommandBuffer } from "./paint-buffer";
import { PAINT_COMMAND_VERSION } from "./paint-buffer";
import type {
  PaintDisplayList,
  PaintDisplayNode,
  PaintGroupScope,
  PaintLayerScope,
  PaintTransformState,
} from "./paint-display-list";
import { validatePaintCommandBuffer } from "./validate-paint-command-buffer";

type ScopeFrame =
  | { kind: "root"; children: PaintDisplayNode[] }
  | { kind: "group"; node: PaintGroupScope }
  | { kind: "layer"; node: PaintLayerScope };

function isDrawOp(cmd: PaintCommand): cmd is PaintDrawCommand {
  return (
    cmd.op === "drawText" ||
    cmd.op === "drawShape" ||
    cmd.op === "drawSolid" ||
    cmd.op === "drawImage" ||
    cmd.op === "drawPath" ||
    cmd.op === "drawVideo" ||
    cmd.op === "unsupported"
  );
}

/**
 * Validate then decode. Throws if structural validation fails.
 */
export function decodePaintCommandBuffer(
  buffer: PaintCommandBuffer,
): PaintDisplayList {
  const validated = validatePaintCommandBuffer(buffer);
  if (!validated.ok) {
    const detail = validated.issues
      .filter((i) => i.severity === "error")
      .map((i) => i.code)
      .join(", ");
    throw new Error(`Invalid PaintCommandBuffer: ${detail || "unknown"}`);
  }

  const transforms = new Map<string, PaintTransformState>();
  const rootChildren: PaintDisplayNode[] = [];
  const stack: ScopeFrame[] = [{ kind: "root", children: rootChildren }];

  let width = 0;
  let height = 0;
  let background: string | undefined;
  let graphId = "";
  let frame = 0;
  let time = 0;

  const pushChild = (node: PaintDisplayNode) => {
    const top = stack[stack.length - 1]!;
    if (top.kind === "root") top.children.push(node);
    else top.node.children.push(node);
  };

  for (const cmd of buffer.commands) {
    switch (cmd.op) {
      case "beginFrame": {
        width = cmd.width;
        height = cmd.height;
        background = cmd.background;
        graphId = cmd.graphId;
        frame = cmd.frame;
        time = cmd.time;
        break;
      }
      case "endFrame":
        break;
      case "setTransform": {
        transforms.set(cmd.key, {
          key: cmd.key,
          matrix: cmd.matrix,
          alpha: cmd.alpha,
          visible: cmd.visible,
          zIndex: cmd.zIndex,
          ...(cmd.blendMode ? { blendMode: cmd.blendMode } : {}),
        });
        break;
      }
      case "beginGroup": {
        const transform = transforms.get(cmd.key);
        const node: PaintGroupScope = {
          kind: "group",
          key: cmd.key,
          layerId: cmd.layerId,
          children: [],
          ...(transform ? { transform } : {}),
        };
        if (transform) transforms.delete(cmd.key);
        pushChild(node);
        stack.push({ kind: "group", node });
        break;
      }
      case "endGroup": {
        const top = stack.pop();
        if (!top || top.kind !== "group" || top.node.key !== cmd.key) {
          throw new Error(`decode: group scope mismatch for ${cmd.key}`);
        }
        break;
      }
      case "beginLayer": {
        const node: PaintLayerScope = {
          kind: "layer",
          key: cmd.key,
          layerId: cmd.layerId,
          isolation: Boolean(cmd.isolation),
          offscreen: Boolean(cmd.offscreen),
          ...(cmd.mask ? { mask: cmd.mask } : {}),
          children: [],
        };
        pushChild(node);
        stack.push({ kind: "layer", node });
        break;
      }
      case "endLayer": {
        const top = stack.pop();
        if (!top || top.kind !== "layer" || top.node.key !== cmd.key) {
          throw new Error(`decode: layer scope mismatch for ${cmd.key}`);
        }
        break;
      }
      case "drawText":
      case "drawShape":
      case "drawSolid":
      case "drawImage":
      case "drawPath":
      case "drawVideo":
      case "unsupported": {
        if (!isDrawOp(cmd)) break;
        const transform = transforms.get(cmd.key);
        if (!transform) {
          throw new Error(`decode: missing transform for ${cmd.key}`);
        }
        pushChild({
          kind: "drawable",
          key: cmd.key,
          transform,
          draw: cmd,
          ...("effects" in cmd && cmd.effects?.length
            ? { effects: cmd.effects }
            : {}),
        });
        transforms.delete(cmd.key);
        break;
      }
      default:
        assertNeverPaintOp(cmd);
    }
  }

  if (stack.length !== 1) {
    throw new Error("decode: unclosed scopes remain");
  }

  return {
    version: buffer.version ?? PAINT_COMMAND_VERSION,
    width,
    height,
    background,
    graphId,
    frame,
    time,
    roots: rootChildren,
    diagnostics: [
      ...buffer.diagnostics,
      ...validated.issues.map((issue) => ({
        severity: issue.severity,
        code: issue.code,
        message: issue.message,
        key: issue.key,
      })),
    ],
  };
}
