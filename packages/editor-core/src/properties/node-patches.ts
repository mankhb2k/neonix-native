/**
 * Node-level patch helpers (pure). Biến MotionLayer + patch thành MotionLayer mới.
 * Không traversal, không validation, không targets.
 */
import {
  MOTION_PROTOCOL_LIMITS,
  motionPropertyCapability,
  setTextPayloadPlain,
  V1,
  type MotionLayer,
} from "@motionvideo/motion-protocol";
import type {
  EffectStackPatch,
  LayerTimingPatch,
  MediaPayloadPatch,
  MetadataPatch,
  StylePatch,
  TextPayloadPatch,
  TransformPatch,
} from "./property-commands";

export function clampNumber(
  value: number,
  capabilityKey: string,
  nodeType: string,
): number {
  const cap = motionPropertyCapability(nodeType, capabilityKey);
  let next = value;
  if (!Number.isFinite(next)) return 0;
  if (cap?.min !== undefined) next = Math.max(cap.min, next);
  if (cap?.minExclusive !== undefined)
    next = Math.max(cap.minExclusive + Number.EPSILON, next);
  if (cap?.max !== undefined) next = Math.min(cap.max, next);
  return next;
}

export function applyTransformPatch(
  node: MotionLayer,
  patch: TransformPatch,
): MotionLayer {
  if (node.type === "audio") return node;
  const t = node.transform;
  const type = node.type;
  let scaleX = t.scale.x;
  let scaleY = t.scale.y;
  if (patch.lockAspect) {
    const uniform =
      patch.scaleX !== undefined
        ? patch.scaleX
        : patch.scaleY !== undefined
          ? patch.scaleY
          : undefined;
    if (uniform !== undefined) {
      const clamped = clampNumber(uniform, "transform.scale.x", type);
      scaleX = clamped;
      scaleY = clamped;
    }
  } else {
    if (patch.scaleX !== undefined) {
      scaleX = clampNumber(patch.scaleX, "transform.scale.x", type);
    }
    if (patch.scaleY !== undefined) {
      scaleY = clampNumber(patch.scaleY, "transform.scale.y", type);
    }
  }
  return {
    ...node,
    transform: {
      ...t,
      translate: {
        ...t.translate,
        x:
          patch.x !== undefined
            ? clampNumber(patch.x, "transform.translate.x", type)
            : t.translate.x,
        y:
          patch.y !== undefined
            ? clampNumber(patch.y, "transform.translate.y", type)
            : t.translate.y,
      },
      rotate: {
        ...t.rotate,
        z:
          patch.rotation !== undefined
            ? clampNumber(patch.rotation, "transform.rotate.z", type)
            : t.rotate.z,
      },
      scale: { ...t.scale, x: scaleX, y: scaleY },
    },
  };
}

export function applyOpacity(node: MotionLayer, opacity: number): MotionLayer {
  if (node.type === "audio") return node;
  return {
    ...node,
    opacity: clampNumber(opacity, "opacity", node.type),
  };
}

export function applyMetadata(
  node: MotionLayer,
  patch: MetadataPatch,
): MotionLayer {
  let next: MotionLayer = node;
  if (patch.visible !== undefined && next.type !== "audio") {
    next = applyOpacity(next, patch.visible ? 100 : 0);
  }
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) {
      const rest = { ...next };
      delete (rest as { name?: string }).name;
      next = rest as MotionLayer;
    } else {
      next = { ...next, name: name.slice(0, MOTION_PROTOCOL_LIMITS.idLength) };
    }
  }
  return next;
}

export function applyStyle(
  node: MotionLayer,
  patch: StylePatch,
): MotionLayer | null {
  // Protocol V1: shape/path mang PaintStyleSchema (fill + stroke); svg chỉ mang
  // SvgStyleSchema { fill } (.strict(), không stroke); text/image/video/... không có
  // field style trên layer. Chỉ nhận shape/path/svg để không sinh JSON không hợp lệ.
  if (node.type !== "shape" && node.type !== "path" && node.type !== "svg") {
    return null;
  }
  const prev =
    "style" in node && node.style && typeof node.style === "object"
      ? { ...node.style }
      : {};
  const nextStyle = { ...prev };
  if (node.type === "svg") {
    // SvgStyleSchema .strict() chỉ cho phép fill — stroke/strokeWidth bị bỏ qua.
    if (patch.fill !== undefined) nextStyle.fill = patch.fill;
    return { ...node, style: nextStyle } as MotionLayer;
  }
  if (patch.fill !== undefined) nextStyle.fill = patch.fill;
  if (patch.fillOpacity !== undefined) {
    nextStyle.fillOpacity = Math.min(1, Math.max(0, patch.fillOpacity));
  }
  if (patch.stroke !== undefined) nextStyle.stroke = patch.stroke;
  if (patch.strokeWidth !== undefined) {
    nextStyle.strokeWidth = Math.max(0, patch.strokeWidth);
  }
  if (patch.strokeOpacity !== undefined) {
    nextStyle.strokeOpacity = Math.min(1, Math.max(0, patch.strokeOpacity));
  }
  return { ...node, style: nextStyle } as MotionLayer;
}

export function applyText(
  node: MotionLayer,
  patch: TextPayloadPatch,
): MotionLayer | null {
  if (node.type !== "text") return null;
  let payload = { ...node.payload };
  if (patch.text !== undefined) {
    payload = setTextPayloadPlain(payload, patch.text);
  }
  if (patch.fontSize !== undefined) {
    payload.fontSize = clampNumber(
      patch.fontSize,
      "payload.fontSize",
      node.type,
    );
  }
  if (patch.align !== undefined) payload.alignment = patch.align;
  if (patch.lineHeight !== undefined) {
    payload.lineHeight = Math.max(Number.EPSILON, patch.lineHeight);
  }
  if (patch.letterSpacing !== undefined) {
    payload.letterSpacing = patch.letterSpacing;
  }
  return { ...node, payload };
}

function normalizeCrop(crop: {
  x: number;
  y: number;
  width: number;
  height: number;
}): { x: number; y: number; width: number; height: number } {
  const x = Math.min(1, Math.max(0, crop.x));
  const y = Math.min(1, Math.max(0, crop.y));
  let width = Math.min(1, Math.max(Number.EPSILON, crop.width));
  let height = Math.min(1, Math.max(Number.EPSILON, crop.height));
  if (x + width > 1) width = Math.max(Number.EPSILON, 1 - x);
  if (y + height > 1) height = Math.max(Number.EPSILON, 1 - y);
  return { x, y, width, height };
}

export function applyMedia(
  node: MotionLayer,
  patch: MediaPayloadPatch,
): MotionLayer | null {
  if (node.type !== "image" && node.type !== "svg" && node.type !== "video") {
    return null;
  }
  // Protocol: crop chỉ tồn tại trên image (svg/video payload là .strict() và
  // không có field crop). Nếu patch mang crop nhưng target không phải image →
  // incompatible để tránh sinh ra JSON protocol không hợp lệ.
  if (patch.crop !== undefined && node.type !== "image") {
    return null;
  }
  const payload = { ...node.payload } as Record<string, unknown>;
  if (patch.fit !== undefined) payload.fit = patch.fit;
  if (patch.crop !== undefined) {
    const prev =
      "crop" in node.payload &&
      node.payload.crop &&
      typeof node.payload.crop === "object"
        ? (node.payload.crop as {
            x?: number;
            y?: number;
            width?: number;
            height?: number;
          })
        : undefined;
    payload.crop = normalizeCrop({
      x: patch.crop.x,
      y: patch.crop.y,
      width: patch.crop.width ?? prev?.width ?? 1,
      height: patch.crop.height ?? prev?.height ?? 1,
    });
  }
  return { ...node, payload } as MotionLayer;
}

export function applyEffects(
  node: MotionLayer,
  patch: EffectStackPatch,
): MotionLayer {
  if (node.type === "audio" || node.type === "camera") return node;
  const effects = [...(node.effects ?? [])];
  if (patch.op === "remove") {
    return {
      ...node,
      effects: effects.filter((e) => e.id !== patch.effectId),
    };
  }
  if (patch.op === "reorder") {
    const seen = new Set<string>();
    const uniqueIds = patch.effectIds.filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    const byId = new Map(effects.map((e) => [e.id, e]));
    const next = uniqueIds
      .map((id) => byId.get(id))
      .filter((e): e is NonNullable<typeof e> => Boolean(e));
    for (const e of effects) {
      if (!uniqueIds.includes(e.id)) next.push(e);
    }
    return { ...node, effects: next };
  }
  const radius = Math.max(0, patch.radius);
  const idx = effects.findIndex((e) => e.id === patch.effectId);
  const blur = {
    id: patch.effectId,
    type: "blur" as const,
    radius,
  };
  if (idx >= 0) effects[idx] = blur;
  else effects.push(blur);
  return { ...node, effects };
}

export function applyTiming(
  node: MotionLayer,
  timing: LayerTimingPatch,
): MotionLayer {
  const start = Math.max(0, timing.start);
  const duration = Math.max(Number.EPSILON, timing.duration);
  const next = {
    ...node,
    timing: { start, duration },
  } as MotionLayer;
  if (next.type === "audio") return next;
  const animations = V1.getLayerAnimations(next)
    .map((animation) => ({
      ...animation,
      keys: animation.keys.filter((key) => key.t <= duration + 1e-9),
    }))
    .filter((animation) => animation.keys.length > 0);
  if (animations.length === 0) {
    const { animations: _omitted, ...rest } = next as MotionLayer & {
      animations?: unknown;
    };
    return rest as MotionLayer;
  }
  return { ...next, animations } as MotionLayer;
}
