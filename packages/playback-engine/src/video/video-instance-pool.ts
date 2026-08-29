export type VideoInstancePoolV3<T> = {
  get(instanceId: string): T | undefined;
  set(instanceId: string, value: T): void;
  delete(instanceId: string): void;
  values(): IterableIterator<T>;
  clear(): void;
};

export function createVideoInstancePoolV3<T>(): VideoInstancePoolV3<T> {
  const map = new Map<string, T>();
  return { get: (id) => map.get(id), set: (id, value) => void map.set(id, value), delete: (id) => void map.delete(id), values: () => map.values(), clear: () => map.clear() };
}
