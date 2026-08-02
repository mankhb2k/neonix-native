import { isMixedValue, type MixedValue } from "./types";

export { isMixedValue };

/** Collapse equal values; otherwise Mixed. */
export function readUniform<T>(
  values: T[],
  equal: (a: T, b: T) => boolean = (a, b) => Object.is(a, b),
): T | MixedValue {
  if (values.length === 0) return { mixed: true };
  const first = values[0]!;
  for (let i = 1; i < values.length; i += 1) {
    if (!equal(first, values[i]!)) return { mixed: true };
  }
  return first;
}
