export type AudioWorkletPortV2 = {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  close?(): void;
};

export type AudioWorkletNodeV2 = {
  port: AudioWorkletPortV2;
  connect(destination: unknown): unknown;
  disconnect?(): void;
};

export type AudioWorkletContextV2 = {
  destination: unknown;
  audioWorklet?: { addModule(url: string): Promise<void> };
};

export type AudioWorkletMixerChunkV2 = {
  inputId: string;
  startSample: number;
  sampleRate: number;
  channels: number;
  data: Float32Array;
  gain: number;
  pan: number;
};

export type AudioWorkletMixerV2 = {
  readonly supported: boolean;
  readonly ready: Promise<boolean>;
  readonly node: AudioWorkletNodeV2 | null;
  connect(destination?: unknown): void;
  push(chunk: AudioWorkletMixerChunkV2): void;
  removeInput(inputId: string): void;
  reset(generation: number): void;
  dispose(): void;
};

const PROCESSOR_NAME = "moticlip-audio-mixer-v2";

// Kept self-contained so bundlers can create a Blob URL without a separate
// public asset. The processor owns the sample cursor and mixes overlapping
// chunks in the audio rendering thread.
const PROCESSOR_SOURCE = `
class MotiClipAudioMixerV2 extends AudioWorkletProcessor {
  constructor() { super(); this.chunks = []; this.cursor = 0; this.generation = 0;
    this.port.onmessage = (event) => { const m = event.data;
      if (m.type === 'reset') { this.chunks = []; this.cursor = 0; this.generation = m.generation ?? this.generation + 1; }
      else if (m.type === 'remove') this.chunks = this.chunks.filter((c) => c.inputId !== m.inputId);
      else if (m.type === 'chunk' && m.generation === this.generation) this.chunks.push(m);
    };
  }
  process(_inputs, outputs) {
    const output = outputs[0]; if (!output) return true;
    const left = output[0]; const right = output[1] || output[0];
    left.fill(0); if (right !== left) right.fill(0);
    const end = this.cursor + left.length;
    for (const c of this.chunks) {
      const frames = Math.floor(c.data.length / c.channels);
      const cEnd = c.startSample + frames;
      if (cEnd <= this.cursor || c.startSample >= end) continue;
      const gain = Number.isFinite(c.gain) ? c.gain : 1;
      const pan = Math.max(-1, Math.min(1, Number(c.pan) || 0));
      const lGain = gain * (pan <= 0 ? 1 : 1 - pan);
      const rGain = gain * (pan >= 0 ? 1 : 1 + pan);
      const from = Math.max(this.cursor, c.startSample);
      const to = Math.min(end, cEnd);
      for (let sample = from; sample < to; sample++) {
        const outIndex = sample - this.cursor;
        const srcIndex = sample - c.startSample;
        const base = srcIndex * c.channels;
        const value = c.channels === 1 ? c.data[base] : (c.data[base] + c.data[base + 1]) * 0.5;
        left[outIndex] += value * lGain; right[outIndex] += value * rGain;
      }
    }
    this.cursor = end;
    this.chunks = this.chunks.filter((c) => c.startSample + Math.floor(c.data.length / c.channels) > this.cursor - sampleRate * 2);
    return true;
  }
}
registerProcessor('${PROCESSOR_NAME}', MotiClipAudioMixerV2);
`;

function createModuleUrl(): string | null {
  const scope = globalThis as typeof globalThis & {
    Blob?: new (parts: BlobPart[], options?: { type?: string }) => Blob;
    URL?: { createObjectURL(blob: Blob): string; revokeObjectURL(url: string): void };
  };
  if (!scope.Blob || !scope.URL?.createObjectURL) return null;
  return scope.URL.createObjectURL(new scope.Blob([PROCESSOR_SOURCE], { type: "application/javascript" }));
}

export type AudioWorkletMixerOptionsV2 = {
  context: AudioWorkletContextV2;
  /** Test/host injection; browser path uses global AudioWorkletNode. */
  createNode?: (name: string, context: AudioWorkletContextV2) => AudioWorkletNodeV2;
  moduleUrl?: string;
};

export function createAudioWorkletMixerV2(options: AudioWorkletMixerOptionsV2): AudioWorkletMixerV2 {
  const context = options.context;
  const supported = Boolean(context.audioWorklet) && (
    Boolean(options.createNode) || typeof (globalThis as { AudioWorkletNode?: unknown }).AudioWorkletNode === "function"
  );
  let node: AudioWorkletNodeV2 | null = null;
  let moduleUrl: string | null = null;
  let disposed = false;
  let generation = 0;
  const ready = (async () => {
    if (!supported || !context.audioWorklet) return false;
    moduleUrl = options.moduleUrl ?? createModuleUrl();
    if (!moduleUrl) return false;
    try {
      await context.audioWorklet.addModule(moduleUrl);
      if (disposed) return false;
      const ctor = options.createNode ?? ((name: string, ctx: AudioWorkletContextV2) => {
        const AudioWorkletNodeCtor = (globalThis as { AudioWorkletNode: new (context: unknown, name: string) => AudioWorkletNodeV2 }).AudioWorkletNode;
        return new AudioWorkletNodeCtor(ctx, name);
      });
      node = ctor(PROCESSOR_NAME, context);
      node.connect(context.destination);
      node.port.postMessage({ type: "reset", generation });
      return true;
    } catch {
      node = null;
      return false;
    }
  })();

  return {
    supported,
    ready,
    get node() { return node; },
    connect(destination = context.destination) { if (node) node.connect(destination); },
    push(chunk) {
      if (disposed || !node || chunk.data.length === 0) return;
      node.port.postMessage({ type: "chunk", ...chunk, generation }, [chunk.data.buffer]);
    },
    removeInput(inputId) { node?.port.postMessage({ type: "remove", inputId, generation }); },
    reset(nextGeneration) {
      generation = nextGeneration;
      node?.port.postMessage({ type: "reset", generation });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      node?.disconnect?.();
      node?.port.close?.();
      const scope = globalThis as typeof globalThis & { URL?: { revokeObjectURL(url: string): void } };
      if (moduleUrl && !options.moduleUrl) scope.URL?.revokeObjectURL(moduleUrl);
      node = null;
    },
  };
}
