import type {
  PaintCommandBuffer,
  RenderMediaFit,
  RenderNormalizedRect,
  RuntimeFrameV2,
} from "@motionvideo/motion-runtime";

export type PreviewBackendKind = "webgl2" | "webgpu";
export type PreviewBackendPreference = PreviewBackendKind | "auto";

export type PreviewAssetKind = "image" | "video";

/** A decoded source owned by the host application, not by this renderer. */
export type PreviewAsset = {
  source: TexImageSource;
  width: number;
  height: number;
  kind?: PreviewAssetKind;
};

export type PreviewAssetResolver = (input: {
  assetId: string;
  uri?: string;
  kind: PreviewAssetKind;
}) => PreviewAsset | null | undefined;

export type PreviewDiagnostic = {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  key?: string;
  layerId?: string;
};

export type PreviewRenderStats = {
  backend: PreviewBackendKind;
  drawCalls: number;
  skippedCommands: number;
  frameTimeMs: number;
  diagnostics: readonly PreviewDiagnostic[];
};

export type PreviewRendererOptions = {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  backend?: PreviewBackendPreference;
  width?: number;
  height?: number;
  devicePixelRatio?: number;
  preserveDrawingBuffer?: boolean;
  background?: string;
  assets?: ReadonlyMap<string, PreviewAsset>;
  resolveAsset?: PreviewAssetResolver;
  onDiagnostic?: (diagnostic: PreviewDiagnostic) => void;
  webgpu?: WebGPUInitOptions;
};

export type PreviewRenderer = {
  readonly backend: PreviewBackendKind;
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;
  paintFrame(frame: RuntimeFrameV2): void;
  paintCommands(buffer: PaintCommandBuffer): void;
  resize(width: number, height: number, devicePixelRatio?: number): void;
  setAsset(assetId: string, asset: PreviewAsset): void;
  removeAsset(assetId: string): void;
  getStats(): PreviewRenderStats;
  captureImageBitmap(): Promise<ImageBitmap | null>;
  dispose(): void;
};

export type WebGPUContextLike = {
  configure(descriptor: {
    device: WebGPUDeviceLike;
    format: string;
    alphaMode?: "opaque" | "premultiplied";
  }): void;
  getCurrentTexture(): WebGPUTextureLike;
};

export type WebGPUDeviceLike = {
  queue: WebGPUQueueLike;
  createShaderModule(descriptor: { code: string }): WebGPUShaderModuleLike;
  createBuffer(descriptor: {
    size: number;
    usage: number;
  }): WebGPUBufferLike;
  createTexture(descriptor: {
    size: { width: number; height: number };
    format: string;
    usage: number;
    sampleCount?: number;
  }): WebGPUTextureLike;
  createSampler(descriptor: {
    magFilter?: "nearest" | "linear";
    minFilter?: "nearest" | "linear";
  }): WebGPUSamplerLike;
  createBindGroupLayout(descriptor: {
    entries: readonly Record<string, unknown>[];
  }): WebGPUBindGroupLayoutLike;
  createPipelineLayout(descriptor: {
    bindGroupLayouts: readonly WebGPUBindGroupLayoutLike[];
  }): WebGPUPipelineLayoutLike;
  createRenderPipeline(descriptor: Record<string, unknown>): WebGPURenderPipelineLike;
  createBindGroup(descriptor: {
    layout: WebGPUBindGroupLayoutLike;
    entries: readonly Record<string, unknown>[];
  }): WebGPUBindGroupLike;
  createCommandEncoder(): WebGPUCommandEncoderLike;
};

export type WebGPUQueueLike = {
  writeBuffer(buffer: WebGPUBufferLike, offset: number, data: ArrayBufferView): void;
  writeTexture?: (
    destination: { texture: WebGPUTextureLike },
    data: ArrayBufferView,
    dataLayout: { bytesPerRow: number; rowsPerImage: number },
    size: { width: number; height: number; depthOrArrayLayers?: number },
  ) => void;
  copyExternalImageToTexture?: (
    source: { source: TexImageSource },
    destination: { texture: WebGPUTextureLike },
    copySize: { width: number; height: number },
  ) => void;
  submit(commandBuffers: readonly WebGPUCommandBufferLike[]): void;
  onSubmittedWorkDone?: () => Promise<void>;
};

export type WebGPUInitOptions = {
  /** Native GPUDevice or a test double. Kept opaque so @webgpu/types is optional. */
  device: unknown;
  /** Native GPUCanvasContext or a test double. */
  context?: unknown;
  format?: string;
};

export type WebGPUShaderModuleLike = object;
export type WebGPUBufferLike = { destroy?: () => void };
export type WebGPUTextureLike = {
  createView(): WebGPUTextureViewLike;
  destroy?: () => void;
};
export type WebGPUSamplerLike = object;
export type WebGPUBindGroupLayoutLike = object;
export type WebGPUPipelineLayoutLike = object;
export type WebGPURenderPipelineLike = {
  getBindGroupLayout(index: number): WebGPUBindGroupLayoutLike;
};
export type WebGPUBindGroupLike = object;
export type WebGPUTextureViewLike = object;
export type WebGPUCommandBufferLike = object;
export type WebGPUCommandEncoderLike = {
  beginRenderPass(descriptor: {
    colorAttachments: readonly Record<string, unknown>[];
  }): WebGPURenderPassEncoderLike;
  finish(): WebGPUCommandBufferLike;
};
export type WebGPURenderPassEncoderLike = {
  setPipeline(pipeline: WebGPURenderPipelineLike): void;
  setVertexBuffer(slot: number, buffer: WebGPUBufferLike): void;
  setIndexBuffer(buffer: WebGPUBufferLike, indexFormat: "uint16" | "uint32"): void;
  setBindGroup(index: number, bindGroup: WebGPUBindGroupLike): void;
  draw(vertexCount: number, instanceCount?: number): void;
  drawIndexed(indexCount: number, instanceCount?: number): void;
  end(): void;
};

export type PreviewMediaDraw = {
  fit?: RenderMediaFit;
  crop?: RenderNormalizedRect;
};
