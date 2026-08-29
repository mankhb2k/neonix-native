import type { RuntimeMediaSourceRefV3 } from "@motionvideo/motion-runtime";

export type PcmChunkV3 = {
  readonly sourceRef: RuntimeMediaSourceRefV3;
  readonly generation: number;
  readonly startSample: number;
  readonly sampleRate: number;
  readonly channels: number;
  readonly frames: number;
  readonly data: Float32Array;
};
export type PcmWindowV3 = { readonly sampleRate: number; readonly startSample: number; readonly endSample: number; readonly channels: readonly Float32Array[] };
export type PcmWindowStoreOptionsV3 = { maxChunks?: number; maxBytes?: number };

const keyOf = (source: RuntimeMediaSourceRefV3) => `${source.mediaId}:${source.streamId}`;

/** Bounded, generation-aware PCM cache. Old seeks are discarded before mixing. */
export class PcmWindowStoreV3 {
  private readonly chunks: PcmChunkV3[] = [];
  private readonly maxChunks: number;
  private readonly maxBytes: number;
  private currentGeneration = 0;
  private bytes = 0;
  constructor(options: PcmWindowStoreOptionsV3 = {}) { this.maxChunks = options.maxChunks ?? 32; this.maxBytes = options.maxBytes ?? 16 * 1024 * 1024; }
  generation(): number { return this.currentGeneration; }
  reset(generation: number): void { if (generation < this.currentGeneration) return; this.currentGeneration = generation; this.clear(); }
  push(chunk: PcmChunkV3): boolean {
    if (chunk.generation !== this.currentGeneration || chunk.frames < 0 || chunk.channels < 1 || chunk.data.length < chunk.frames * chunk.channels) return false;
    const end = chunk.startSample + chunk.frames;
    const sourceKey = keyOf(chunk.sourceRef);
    if (this.chunks.some((item) => item.generation === chunk.generation && keyOf(item.sourceRef) === sourceKey && chunk.startSample < item.startSample + item.frames && item.startSample < end)) return false;
    this.chunks.push(chunk); this.chunks.sort((a, b) => a.startSample - b.startSample); this.bytes += chunk.data.byteLength;
    while (this.chunks.length > this.maxChunks || this.bytes > this.maxBytes) { const removed = this.chunks.shift(); if (removed) this.bytes -= removed.data.byteLength; }
    return true;
  }
  read(sourceRef: RuntimeMediaSourceRefV3, startSample: number, endSample: number): readonly PcmChunkV3[] { const key = keyOf(sourceRef); return this.chunks.filter((chunk) => keyOf(chunk.sourceRef) === key && chunk.generation === this.currentGeneration && chunk.startSample < endSample && chunk.startSample + chunk.frames > startSample); }
  remove(sourceRef: RuntimeMediaSourceRefV3): void { const key = keyOf(sourceRef); for (let i = this.chunks.length - 1; i >= 0; i--) if (keyOf(this.chunks[i]!.sourceRef) === key) this.bytes -= this.chunks.splice(i, 1)[0]!.data.byteLength; }
  clear(): void { this.chunks.length = 0; this.bytes = 0; }
  stats(): { chunks: number; bytes: number; generation: number } { return { chunks: this.chunks.length, bytes: this.bytes, generation: this.currentGeneration }; }
}
