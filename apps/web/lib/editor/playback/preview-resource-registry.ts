export type PreviewResourceLease<T> = {
  readonly value: T;
  release: () => void;
};

type ResourceEntry<T> = {
  value: T;
  refs: number;
  lastUsed: number;
  cpuBytes: number;
  gpuBytesHint: number;
  encodedBytes?: number;
  dispose?: (value: T) => void;
};

export type PreviewResourceCost = {
  cpuBytes: number;
  gpuBytesHint: number;
  encodedBytes?: number;
};

export type PreviewResourceRegistryOptions = {
  maxEntries?: number;
  maxCpuBytes?: number;
  estimateCost?: (value: unknown) => PreviewResourceCost;
};

export type PreviewResourceRegistryStats = {
  entries: number;
  activeEntries: number;
  idleEntries: number;
  cpuBytes: number;
  gpuBytesHint: number;
  overBudgetCpuBytes: number;
};

/**
 * Revision-keyed cache for decoded preview resources.
 *
 * A resource remains cached while idle so unrelated document edits can reuse
 * the same decoder/raster/font data. Idle entries are evicted by LRU once the
 * bounded cache is full; active leases are never evicted.
 */
export class PreviewResourceRegistry {
  private readonly entries = new Map<string, ResourceEntry<unknown>>();
  private readonly loading = new Map<string, Promise<unknown>>();
  private clock = 0;
  private disposed = false;
  private readonly maxEntries: number;
  private readonly maxCpuBytes: number;
  private readonly estimateCost: (value: unknown) => PreviewResourceCost;
  private cpuBytes = 0;
  private gpuBytesHint = 0;

  constructor(maxEntriesOrOptions: number | PreviewResourceRegistryOptions = 64) {
    const options = typeof maxEntriesOrOptions === "number"
      ? { maxEntries: maxEntriesOrOptions }
      : maxEntriesOrOptions;
    this.maxEntries = Math.max(0, Math.floor(options.maxEntries ?? 64));
    this.maxCpuBytes = Math.max(0, Math.floor(options.maxCpuBytes ?? 256 * 1024 * 1024));
    this.estimateCost = options.estimateCost ?? estimatePreviewResourceCost;
  }

  async acquire<T>(
    key: string,
    load: () => Promise<T> | T,
    dispose?: (value: T) => void,
    cost?: PreviewResourceCost,
  ): Promise<PreviewResourceLease<T>> {
    if (this.disposed) throw new Error("PreviewResourceRegistry is disposed");
    const existing = this.entries.get(key) as ResourceEntry<T> | undefined;
    if (existing) {
      existing.refs += 1;
      existing.lastUsed = ++this.clock;
      return this.lease(key, existing);
    }

    let pending = this.loading.get(key) as Promise<T> | undefined;
    if (!pending) {
      pending = Promise.resolve().then(load);
      this.loading.set(key, pending);
    }
    let value: T;
    try {
      value = await pending;
    } finally {
      if (this.loading.get(key) === pending) this.loading.delete(key);
    }
    if (this.disposed) {
      dispose?.(value);
      throw new Error("PreviewResourceRegistry is disposed");
    }
    const raced = this.entries.get(key) as ResourceEntry<T> | undefined;
    if (raced) {
      raced.refs += 1;
      raced.lastUsed = ++this.clock;
      return this.lease(key, raced);
    }
    const entry: ResourceEntry<T> = {
      value,
      refs: 1,
      lastUsed: ++this.clock,
      ...(cost ?? this.estimateCost(value)),
      dispose,
    };
    this.entries.set(key, entry as ResourceEntry<unknown>);
    this.cpuBytes += entry.cpuBytes;
    this.gpuBytesHint += entry.gpuBytesHint;
    this.evictIdle();
    return this.lease(key, entry);
  }

  stats(): PreviewResourceRegistryStats {
    let activeEntries = 0;
    for (const entry of this.entries.values()) {
      if (entry.refs > 0) activeEntries += 1;
    }
    return {
      entries: this.entries.size,
      activeEntries,
      idleEntries: this.entries.size - activeEntries,
      cpuBytes: this.cpuBytes,
      gpuBytesHint: this.gpuBytesHint,
      overBudgetCpuBytes: Math.max(0, this.cpuBytes - this.maxCpuBytes),
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loading.clear();
    for (const entry of this.entries.values()) {
      entry.dispose?.(entry.value);
    }
    this.entries.clear();
    this.cpuBytes = 0;
    this.gpuBytesHint = 0;
  }

  private lease<T>(key: string, entry: ResourceEntry<T>): PreviewResourceLease<T> {
    let released = false;
    return {
      value: entry.value,
      release: () => {
        if (released) return;
        released = true;
        const current = this.entries.get(key);
        if (current !== entry) return;
        current.refs = Math.max(0, current.refs - 1);
        current.lastUsed = ++this.clock;
        this.evictIdle();
      },
    };
  }

  private evictIdle(): void {
    if (this.entries.size <= this.maxEntries && this.cpuBytes <= this.maxCpuBytes) return;
    const idle = [...this.entries.entries()]
      .filter(([, entry]) => entry.refs === 0)
      .sort(([, left], [, right]) => left.lastUsed - right.lastUsed);
    for (const [key, entry] of idle) {
      if (this.entries.size <= this.maxEntries && this.cpuBytes <= this.maxCpuBytes) break;
      this.entries.delete(key);
      this.cpuBytes -= entry.cpuBytes;
      this.gpuBytesHint -= entry.gpuBytesHint;
      entry.dispose?.(entry.value);
    }
  }
}

function estimatePreviewResourceCost(value: unknown): PreviewResourceCost {
  if (!value || typeof value !== "object") return { cpuBytes: 0, gpuBytesHint: 0 };
  const candidate = value as {
    width?: number;
    height?: number;
    videoWidth?: number;
    videoHeight?: number;
    byteLength?: number;
    pixels?: { byteLength?: number };
  };
  if (typeof candidate.byteLength === "number") {
    const bytes = Math.max(0, Math.floor(candidate.byteLength));
    return { cpuBytes: bytes, gpuBytesHint: 0, encodedBytes: bytes };
  }
  const width = Math.max(0, Math.floor(candidate.width ?? candidate.videoWidth ?? 0));
  const height = Math.max(0, Math.floor(candidate.height ?? candidate.videoHeight ?? 0));
  const pixels = Math.max(0, Math.floor(candidate.pixels?.byteLength ?? 0));
  const rgbaBytes = width * height * 4;
  return { cpuBytes: Math.max(pixels, rgbaBytes), gpuBytesHint: rgbaBytes };
}

export function previewResourceKey(asset: {
  id: string;
  uri: string;
  integrity?: string;
  width?: number;
  height?: number;
  kind: string;
}): string {
  return [asset.kind, asset.id, asset.uri, asset.integrity ?? "", asset.width ?? "", asset.height ?? ""].join("|");
}
