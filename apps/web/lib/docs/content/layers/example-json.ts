/** Shared authoring envelope for docs “Example layer” JSON. */
export const EXAMPLE_TRANSFORM = {
  translate: { x: 120, y: 80 },
  scale: { x: 1, y: 1 },
  rotate: { z: 0 },
  skew: { x: 0, y: 0 },
  origin: { x: 0.5, y: 0.5 },
  depth: 0,
};

export const EXAMPLE_APPEARANCE = { visible: true, opacity: 100 };

export function visualLayerExample<T extends Record<string, unknown>>(
  layer: T,
): T & {
  parentLayerId: null;
  zIndex: number;
  timing: { start: number; duration: number };
  transform: typeof EXAMPLE_TRANSFORM;
  appearance: typeof EXAMPLE_APPEARANCE;
} {
  return {
    parentLayerId: null,
    zIndex: 1,
    timing: { start: 0, duration: 90 },
    transform: EXAMPLE_TRANSFORM,
    appearance: EXAMPLE_APPEARANCE,
    ...layer,
  };
}
