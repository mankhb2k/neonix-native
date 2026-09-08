import type { MotionProtocolV2 } from "@motionvideo/motion-protocol/v2";
import { fail } from "./errors";
import { calcExpression } from "./values";
import type { Style } from "./model";

export type ParsedTransform = {
  translate: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  rotate: { x: number; y: number; z: number };
  skew: { x: number; y: number };
  anchor: { x: number; y: number; z: number };
  operations?: NonNullable<MotionProtocolV2["layers"][number]["transform"]["operations"]>;
  extensions?: NonNullable<MotionProtocolV2["layers"][number]["transform"]["extensions"]>;
};

function transformNumber(value: string, property: string, relative: number, fontSize: number, viewport: { width: number; height: number }): number {
  const parsed = calcExpression(value, property, relative, fontSize, 16, viewport).value;
  if (!Number.isFinite(parsed)) fail("css-transform-value-invalid", `${property} requires a finite value: ${value}`);
  return parsed;
}

function transformAngle(value: string, property: string): number {
  const match = value.trim().match(/^(-?(?:\d+\.?\d*|\.\d+))(deg|rad|turn)$/i);
  if (!match) fail("css-transform-angle-invalid", `${property} requires an angle (deg, rad or turn): ${value}`);
  const parsed = match as RegExpMatchArray; const n = Number(parsed[1]); const unit = parsed[2]!.toLowerCase();
  return unit === "rad" ? (n * 180) / Math.PI : unit === "turn" ? n * 360 : n;
}

function parseTransformOrigin(value: string | undefined, width: number, height: number, fontSize: number, viewport: { width: number; height: number }): { x: number; y: number; z: number } {
  if (value === undefined) return { x: width / 2, y: height / 2, z: 0 };
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 1 || tokens.length > 3) fail("css-transform-origin-invalid", `transform-origin expects one to three values: ${value}`);
  const keywordX: Record<string, string> = { left: "0%", center: "50%", right: "100%" }; const keywordY: Record<string, string> = { top: "0%", center: "50%", bottom: "100%" };
  const xValue = keywordX[tokens[0]!.toLowerCase()] ?? tokens[0]!; const yValue = keywordY[tokens[1]?.toLowerCase() ?? "center"] ?? tokens[1] ?? "50%";
  return { x: transformNumber(xValue, "transform-origin", width, fontSize, viewport), y: transformNumber(yValue, "transform-origin", height, fontSize, viewport), z: tokens[2] === undefined ? 0 : transformNumber(tokens[2], "transform-origin", 1, fontSize, viewport) };
}

/** Lower CSS parent perspective into the Protocol V2 group context. */
export function parsePerspectiveContext(style: Style, width: number, height: number, fontSize: number, viewport: { width: number; height: number }): { distance: number; origin: { x: number; y: number } } | undefined {
  const value = style.get("perspective");
  if (value === undefined || value.trim().toLowerCase() === "none") return undefined;
  const distance = transformNumber(value, "perspective", 1, fontSize, viewport);
  if (distance <= 0) fail("css-perspective-invalid", "perspective requires a positive length");
  const origin = parseTransformOrigin(style.get("perspective-origin"), width, height, fontSize, viewport);
  return { distance, origin: { x: origin.x, y: origin.y } };
}

export function parseTransform(style: Style, width: number, height: number, fontSize: number, viewport: { width: number; height: number }): ParsedTransform {
  const identity: ParsedTransform = { translate: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, rotate: { x: 0, y: 0, z: 0 }, skew: { x: 0, y: 0 }, anchor: { x: 0, y: 0, z: 0 } };
  const value = style.get("transform");
  // CSS transform-origin is still the pivot for an animated transform even
  // when the base declaration has no transform property. Keep the default
  // center anchor in the layer so sampled transform tracks rotate/scale in
  // the same local coordinate system as the browser.
  if (value === undefined || value.trim().toLowerCase() === "none") {
    return { ...identity, anchor: parseTransformOrigin(style.get("transform-origin"), width, height, fontSize, viewport) };
  }
  const result: ParsedTransform = { ...identity, anchor: parseTransformOrigin(style.get("transform-origin"), width, height, fontSize, viewport), operations: [] };
  const operationPattern = /([A-Za-z][\w-]*)\(([^()]*)\)/g; let cursor = 0; let match: RegExpExecArray | null;
  while ((match = operationPattern.exec(value)) !== null) {
    const parsedMatch = match as RegExpExecArray; if (value.slice(cursor, parsedMatch.index).trim()) fail("css-transform-invalid", `Unsupported transform syntax near ${value.slice(cursor, parsedMatch.index)}`); cursor = operationPattern.lastIndex;
    const name = parsedMatch[1]!.toLowerCase(); const args = parsedMatch[2]!.split(/\s*,\s*|\s+/).filter(Boolean);
    if (name === "translate" || name === "translate3d") {
      if (args.length < 1 || args.length > 3) fail("css-transform-arguments-invalid", `${name} expects one to three values`);
      const x = transformNumber(args[0]!, name, width, fontSize, viewport); const y = args[1] === undefined ? 0 : transformNumber(args[1], name, height, fontSize, viewport); const z = args[2] === undefined ? 0 : transformNumber(args[2], name, 1, fontSize, viewport); result.translate.x += x; result.translate.y += y; result.translate.z += z;
      result.operations!.push(z !== 0 || name === "translate3d" ? { type: "extension", name: "motion.translate3d", value: { x, y, z } } : { type: "translate", x, y });
    } else if (name === "translatex" || name === "translatey") {
      if (args.length !== 1) fail("css-transform-arguments-invalid", `${name} expects one value`); const x = name === "translatex" ? transformNumber(args[0]!, name, width, fontSize, viewport) : 0; const y = name === "translatey" ? transformNumber(args[0]!, name, height, fontSize, viewport) : 0; result.translate.x += x; result.translate.y += y; result.operations!.push({ type: "translate", x, y });
    } else if (name === "translatez") {
      if (args.length !== 1) fail("css-transform-arguments-invalid", `${name} expects one value`); const z = transformNumber(args[0]!, name, 1, fontSize, viewport); result.translate.z += z; result.operations!.push({ type: "extension", name: "motion.translate3d", value: { x: 0, y: 0, z } });
    } else if (name === "scale" || name === "scale3d") {
      if (args.length < 1 || args.length > 3) fail("css-transform-arguments-invalid", `${name} expects one to three values`); const x = Number(args[0]); const y = args[1] === undefined ? x : Number(args[1]); const z = args[2] === undefined ? 1 : Number(args[2]); if (![x, y, z].every(Number.isFinite)) fail("css-transform-value-invalid", `${name} requires numeric values`); result.scale.x *= x; result.scale.y *= y; result.scale.z *= z; result.operations!.push(name === "scale" ? { type: "scale", x, y } : { type: "extension", name: "motion.scale3d", value: { x, y, z } });
    } else if (name === "scalex" || name === "scaley" || name === "scalez") {
      if (args.length !== 1 || !Number.isFinite(Number(args[0]))) fail("css-transform-value-invalid", `${name} requires one numeric value`); const x = name === "scalex" ? Number(args[0]) : 1; const y = name === "scaley" ? Number(args[0]) : 1; const z = name === "scalez" ? Number(args[0]) : 1; result.scale.x *= x; result.scale.y *= y; result.scale.z *= z; result.operations!.push(name === "scalez" ? { type: "extension", name: "motion.scale3d", value: { x: 1, y: 1, z } } : { type: "scale", x, y });
    } else if (name === "perspective") {
      if (args.length !== 1) fail("css-transform-arguments-invalid", `${name} expects one value`); const distance = transformNumber(args[0]!, name, 1, fontSize, viewport); if (distance <= 0) fail("css-perspective-invalid", "transform perspective() requires a positive length"); result.operations!.push({ type: "extension", name: "motion.perspective", value: distance });
    } else if (["rotate", "rotatez", "rotatex", "rotatey"].includes(name)) {
      if (args.length !== 1) fail("css-transform-arguments-invalid", `${name} expects one angle`); const angle = transformAngle(args[0]!, name); const x = name === "rotatex" ? angle : 0; const y = name === "rotatey" ? angle : 0; const z = name === "rotatex" || name === "rotatey" ? 0 : angle; result.rotate.x += x; result.rotate.y += y; result.rotate.z += z; result.operations!.push(name === "rotate" ? { type: "rotate", angle } : { type: "extension", name: name === "rotatex" ? "motion.rotateX" : name === "rotatey" ? "motion.rotateY" : "motion.rotateZ", value: angle });
    } else if (["skew", "skewx", "skewy"].includes(name)) {
      if (args.length < 1 || args.length > 2) fail("css-transform-arguments-invalid", `${name} expects one or two angles`); const x = name === "skewy" ? 0 : transformAngle(args[0]!, name); const y = name === "skewy" ? transformAngle(args[0]!, name) : name === "skewx" ? 0 : args[1] === undefined ? 0 : transformAngle(args[1]!, name); result.skew.x += x; result.skew.y += y; if (x !== 0) result.operations!.push({ type: "skewX", angle: x }); if (y !== 0) result.operations!.push({ type: "skewY", angle: y });
    } else if (name === "matrix") {
      if (args.length !== 6 || args.some((value) => !Number.isFinite(Number(value)))) fail("css-transform-arguments-invalid", "matrix() expects six finite numbers");
      result.operations!.push({ type: "matrix", values: args.map(Number) as [number, number, number, number, number, number] });
    } else if (name === "matrix3d") {
      if (args.length !== 16 || args.some((value) => !Number.isFinite(Number(value)))) fail("css-transform-arguments-invalid", "matrix3d() expects sixteen finite numbers");
      result.operations!.push({ type: "extension", name: "motion.matrix4", value: args.map(Number) as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number] });
    } else fail("css-transform-function-unsupported", `Unsupported transform function: ${name}`);
  }
  if (value.slice(cursor).trim()) fail("css-transform-invalid", `Unsupported transform syntax near ${value.slice(cursor)}`);
  return result.operations!.length ? { ...result, extensions: { anchor: result.anchor } } : identity;
}
