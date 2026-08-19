/**
 * Atom mặc định cho layer hình — dùng test và fixture (core shape).
 */
export function defaultTransform(overrides: Record<string, unknown> = {}) {
  return {
    translate: { x: 0, y: 0 },
    rotate: { z: 0 },
    scale: { x: 1, y: 1 },
    skew: { x: 0, y: 0 },
    origin: { x: 0.5, y: 0.5 },
    depth: 0,
    ...overrides,
  };
}

export function visualLayerAtoms(opts: {
  x?: number;
  y?: number;
  width: number;
  height: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  originX?: number;
  originY?: number;
  opacity?: number;
  depth?: number;
}) {
  return {
    frame: { width: opts.width, height: opts.height },
    transform: defaultTransform({
      translate: { x: opts.x ?? 0, y: opts.y ?? 0 },
      rotate: { z: opts.rotation ?? 0 },
      scale: { x: opts.scaleX ?? 1, y: opts.scaleY ?? 1 },
      origin: {
        x: opts.originX ?? 0.5,
        y: opts.originY ?? 0.5,
      },
      depth: opts.depth ?? 0,
    }),
    opacity: opts.opacity ?? 100,
  };
}
