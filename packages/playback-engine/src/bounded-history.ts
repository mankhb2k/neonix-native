/**
 * Allocation-free bounded history for diagnostics and performance samples.
 *
 * The realtime path only writes into a fixed-size ring. Reading the history
 * creates a snapshot intentionally, so callers cannot mutate live state.
 */
export type BoundedHistory<T> = {
  push(value: T): void;
  toArray(): readonly T[];
  clear(): void;
  readonly size: number;
};

export function createBoundedHistory<T>(capacity: number): BoundedHistory<T> {
  const limit = Math.max(0, Math.floor(capacity));
  const values: Array<T | undefined> = limit > 0 ? new Array<T | undefined>(limit) : [];
  let head = 0;
  let size = 0;

  return {
    push(value) {
      if (limit === 0) return;
      const index = (head + size) % limit;
      values[index] = value;
      if (size < limit) {
        size += 1;
        return;
      }
      head = (head + 1) % limit;
    },
    toArray() {
      const result: T[] = [];
      for (let index = 0; index < size; index += 1) {
        const value = values[(head + index) % limit];
        if (value !== undefined) result.push(value);
      }
      return result;
    },
    clear() {
      values.fill(undefined);
      head = 0;
      size = 0;
    },
    get size() {
      return size;
    },
  };
}
