import { describe, expect, it } from "vitest";
import { createWebGPUBackend } from "./backend";
import type {
  PreviewRendererOptions,
  WebGPUBufferLike,
  WebGPUDeviceLike,
} from "../shared/types";

describe("WebGPU preview backend", () => {
  it("submits rectangle and ellipse geometry before releasing GPU resources", async () => {
    const destroyed = new Set<WebGPUBufferLike>();
    const createdBuffers: WebGPUBufferLike[] = [];
    const bufferSizes = new Map<WebGPUBufferLike, number>();
    const uniformWrites: number[][] = [];
    const renderPasses: Array<Record<string, unknown>> = [];
    const pipelineDescriptors: Array<Record<string, unknown>> = [];
    const textureDescriptors: Array<Record<string, unknown>> = [];
    const device = {
      queue: {
        writeBuffer(buffer: WebGPUBufferLike, _offset: number, data: ArrayBufferView) {
          if (bufferSizes.get(buffer) !== 336) return;
          const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
          uniformWrites.push(Array.from(new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)));
        },
        submit() {
          expect(createdBuffers.some((buffer) => destroyed.has(buffer))).toBe(false);
        },
        onSubmittedWorkDone: () => Promise.resolve(),
      },
      createShaderModule: () => ({}),
      createBuffer: ({ size }: { size: number }) => {
        const buffer: WebGPUBufferLike = {
          destroy: () => destroyed.add(buffer),
        };
        createdBuffers.push(buffer);
        bufferSizes.set(buffer, size);
        return buffer;
      },
      createTexture: (descriptor: Record<string, unknown>) => {
        textureDescriptors.push(descriptor);
        return { createView: () => ({}) };
      },
      createSampler: () => ({}),
      createBindGroupLayout: () => ({}),
      createPipelineLayout: () => ({}),
      createRenderPipeline: (descriptor: Record<string, unknown>) => {
        pipelineDescriptors.push(descriptor);
        return { getBindGroupLayout: () => ({}) };
      },
      createBindGroup: () => ({}),
      createCommandEncoder: () => ({
        beginRenderPass: (descriptor: Record<string, unknown>) => {
          renderPasses.push(descriptor);
          return {
            setPipeline() {},
            setVertexBuffer() {},
            setBindGroup() {},
            draw() {},
            end() {},
          };
        },
        finish: () => ({}),
      }),
    } satisfies WebGPUDeviceLike;
    const context = {
      configure() {},
      getCurrentTexture: () => ({ createView: () => ({}) }),
    };
    const options: PreviewRendererOptions = {
      canvas: { width: 320, height: 180 } as OffscreenCanvas,
      width: 320,
      height: 180,
    };
    const backend = createWebGPUBackend(options, { device, context }, () => {});

    const stats = backend.paint({
      version: 1,
      diagnostics: [],
      commands: [
        {
          op: "beginFrame",
          graphId: "test",
          width: 320,
          height: 180,
          frame: 0,
          time: 0,
          background: "#101820",
          projection: {
            worldToClipMatrix: [
              2 / 320, 0, 0, 0,
              0, -2 / 180, 0, 0,
              0, 0, 1, 0,
              -1, 1, 0, 1,
            ],
          },
        },
        {
          op: "beginLayer",
          key: "rectangle-effect-scope",
          layerId: "rectangle",
          isolation: false,
          offscreen: false,
          effectProgram: {
            input: "source",
            output: "effect:grade",
            requiresOffscreen: false,
            ops: [{
              id: "grade",
              kind: "color-adjust",
              input: "source",
              output: "effect:grade",
              brightness: -0.1,
              contrast: 1.2,
              saturation: 0.5,
              hueRotate: 90,
            }],
          },
        },
        {
          op: "setTransform",
          key: "rectangle",
          matrix4: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 7, 11, 0, 1],
          alpha: 1,
          visible: true,
          order: 0,
        },
        {
          op: "drawShape",
          key: "rectangle",
          layerId: "rectangle",
          shape: "rectangle",
          fill: "#00aa88",
          width: 96,
          height: 64,
        },
        { op: "endLayer", key: "rectangle-effect-scope" },
        {
          op: "setTransform",
          key: "ellipse",
          matrix4: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 140, 40, 0, 1],
          alpha: 1,
          visible: true,
          order: 1,
        },
        {
          op: "drawShape",
          key: "ellipse",
          layerId: "ellipse",
          shape: "ellipse",
          fill: "#ff3366",
          width: 80,
          height: 40,
        },
        { op: "endFrame" },
      ],
    });

    expect(pipelineDescriptors[0]).toMatchObject({ multisample: { count: 4 } });
    expect(textureDescriptors).toContainEqual(
      expect.objectContaining({
        size: { width: 320, height: 180 },
        sampleCount: 4,
      }),
    );
    expect(textureDescriptors.some((descriptor) => descriptor.format === "rgba16float")).toBe(false);
    expect(renderPasses[0]).toMatchObject({
      colorAttachments: [
        {
          resolveTarget: expect.anything(),
        },
      ],
    });
    expect(stats.drawCalls).toBe(2);
    expect(uniformWrites).toHaveLength(2);
    expect(uniformWrites[0]![28]).toBeCloseTo(7);
    expect(uniformWrites[0]![29]).toBeCloseTo(11);
    expect(uniformWrites[0]![31]).toBe(1);
    expect(uniformWrites[0]![36]).toBe(0);
    expect(uniformWrites[0]![64]).toBe(1);
    expect(uniformWrites[0]![68]).toBeCloseTo(-0.1);
    expect(uniformWrites[0]![69]).toBeCloseTo(1.2);
    expect(uniformWrites[0]![70]).toBeCloseTo(0.5);
    expect(uniformWrites[0]![71]).toBeCloseTo(Math.PI / 2);
    expect(uniformWrites[1]![36]).toBe(1);
    expect(renderPasses[0]).toMatchObject({
      colorAttachments: [
        {
          clearValue: {
            r: 16 / 255,
            g: 24 / 255,
            b: 32 / 255,
            a: 1,
          },
        },
      ],
    });

    await Promise.resolve();
    expect(destroyed.size).toBeGreaterThan(0);
    backend.dispose();
  });
});
