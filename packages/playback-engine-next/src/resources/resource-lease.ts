export type ResourceLeaseV3<T> = { readonly value: T; release(): void; readonly released: boolean };

export function createResourceLeaseV3<T>(value: T, onRelease?: () => void): ResourceLeaseV3<T> {
  let released = false;
  return { value, get released() { return released; }, release() { if (released) return; released = true; onRelease?.(); } };
}
