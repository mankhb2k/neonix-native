import type { RuntimeMediaSourceRefV3 } from "@motionvideo/motion-runtime";
import type { PcmChunkV3 } from "./pcm-window";

export type AudioDecodeRequestV3 = { sourceRef: RuntimeMediaSourceRefV3; startSample: number; endSample: number };
export type DecodeRequestV3 = AudioDecodeRequestV3 & { generation: number };
export type ResolvedAudioStreamV3 = { sourceRef: RuntimeMediaSourceRefV3; codec: string; codecConfig?: string; sampleRate: number; channels: number };
export type AudioDecodeBackendV3 = { configure(stream: ResolvedAudioStreamV3, token: { generation: number }): Promise<void>; decode(request: AudioDecodeRequestV3, token: { generation: number }): Promise<readonly PcmChunkV3[]>; reset(token: { generation: number }): void; dispose(): void };
export type DecodeCoordinatorOptionsV3 = { backend: AudioDecodeBackendV3; onChunks?: (chunks: readonly PcmChunkV3[]) => void };

export class DecodeCoordinatorV3 {
  private generation = 0;
  constructor(private readonly options: DecodeCoordinatorOptionsV3) {}
  currentGeneration(): number { return this.generation; }
  async request(request: AudioDecodeRequestV3): Promise<readonly PcmChunkV3[]> { const token = { generation: this.generation }; const chunks = await this.options.backend.decode(request, token); if (token.generation !== this.generation) return []; this.options.onChunks?.(chunks); return chunks; }
  reset(): void { this.generation += 1; this.options.backend.reset({ generation: this.generation }); }
  dispose(): void { this.generation += 1; this.options.backend.dispose(); }
}

export type EncodedChunkIndexEntryV3 = { startSample: number; endSample: number; offset: number; byteLength: number };
export type EncodedChunkReaderV3 = { read(entry: EncodedChunkIndexEntryV3): Promise<ArrayBuffer> };

export function createEncodedChunkReaderV3(readRange: (offset: number, byteLength: number) => Promise<ArrayBuffer>): EncodedChunkReaderV3 {
  return { read: (entry) => readRange(entry.offset, entry.byteLength) };
}
