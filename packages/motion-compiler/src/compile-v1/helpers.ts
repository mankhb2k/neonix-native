import { V1 } from "@motionvideo/motion-protocol";

export type JsonRecord = Record<string, unknown>;

export type V1SceneClip = V1.MotionClipV1;

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Set a dotted property path on a plain object, creating intermediate objects. */
export function setPropertyPath(
  target: Record<string, unknown>,
  property: string,
  value: unknown,
): void {
  const parts = property.split(".");
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (!cursor[part] || typeof cursor[part] !== "object") {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
}

/** Map a V1 authoring property path to its runtime IR equivalent. */
export function toRuntimeProperty(property: string): string {
  return property === "payload.text" ? "payload.content.text" : property;
}

export function pixelFormatHasAlpha(pixelFormat: string): boolean {
  return /(?:rgba|bgra|argb|abgr|yuva|graya)/i.test(pixelFormat);
}

export function deriveAspectRatio(
  width: number,
  height: number,
): "9:16" | "16:9" | "1:1" {
  const ratio = width / height;
  if (Math.abs(ratio - 9 / 16) < 0.01) return "9:16";
  if (Math.abs(ratio - 16 / 9) < 0.01) return "16:9";
  if (Math.abs(ratio - 1) < 0.01) return "1:1";
  return "16:9";
}
