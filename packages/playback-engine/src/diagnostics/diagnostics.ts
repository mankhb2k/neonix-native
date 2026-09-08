export type { PlaybackEngineSnapshot, PlaybackMetricsSnapshotV3 } from "../core/types";

export class BoundedHistoryV3<T> {
  readonly #items: T[] = [];

  constructor(readonly limit = 100) {}

  push(item: T): void {
    this.#items.push(item);
    if (this.#items.length > this.limit) this.#items.splice(0, this.#items.length - this.limit);
  }

  values(): readonly T[] {
    return this.#items;
  }

  clear(): void {
    this.#items.length = 0;
  }
}
