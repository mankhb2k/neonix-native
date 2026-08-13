import type { StoredAssetRecord } from "../types";

export interface AssetMetadataStore {
  get(id: string): Promise<StoredAssetRecord | null>;
  put(record: StoredAssetRecord): Promise<void>;
  delete(id: string): Promise<void>;
  listReady(): Promise<StoredAssetRecord[]>;
}

export class MemoryAssetMetadataStore implements AssetMetadataStore {
  private readonly records = new Map<string, StoredAssetRecord>();

  async get(id: string): Promise<StoredAssetRecord | null> {
    return this.records.get(id) ?? null;
  }

  async put(record: StoredAssetRecord): Promise<void> {
    this.records.set(record.id, record);
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }

  async listReady(): Promise<StoredAssetRecord[]> {
    return [...this.records.values()].filter((r) => r.status === "ready");
  }
}
