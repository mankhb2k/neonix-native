import type { PaintCommand, PaintCommandBuffer } from "@motionvideo/motion-runtime";
import {
  matrix4ForQuad,
  packMatrix4F32,
  worldToClipMatrixForPaint,
  gradientUniforms,
} from "../math";
import { cssColorToRgba } from "../shared/color";
import { mediaLayout } from "../media";
import { createTextAtlas, type TextAtlas } from "../text-atlas";
import { buildEffectPassPlan, colorAdjustUniforms, type EffectPassPlan } from "../shared/effects";
import { blurPyramidPlan } from "../shared/blur";
import type { PreviewBackend } from "../backend";
import {
  BUFFER_COPY_DST,
  BUFFER_INDEX,
  BUFFER_UNIFORM,
  BUFFER_VERTEX,
  EFFECT_TEXTURE_FORMAT,
  MSAA_SAMPLE_COUNT,
  TEXTURE_BINDING,
  TEXTURE_COPY_DST,
  TEXTURE_RENDER_ATTACHMENT,
  UNIFORM_BYTES,
  UNIFORM_FLOATS,
  createBackendObjects,
  webgpuContext,
  writeMatrix4,
  type BlendMode,
} from "./resources";
import {
  createClipMaskPostObjects,
  createInnerGlowPostObjects,
  createPostObjects,
} from "./passes";
import type {
  PreviewAsset,
  PreviewDiagnostic,
  PreviewRendererOptions,
  PreviewRenderStats,
  WebGPUContextLike,
  WebGPUDeviceLike,
  WebGPUInitOptions,
  WebGPUTextureLike,
  WebGPUBufferLike,
  WebGPUCommandEncoderLike,
} from "../shared/types";
import {
  decideTextureUpdate,
  previewAssetRevision,
  type PreviewAssetRevision,
} from "../shared/texture-upload-policy";

export function createWebGPUBackend(
  options: PreviewRendererOptions,
  init: WebGPUInitOptions,
  report: (diagnostic: PreviewDiagnostic) => void,
): PreviewBackend {
  const device = init.device as WebGPUDeviceLike;
  const context = (init.context as WebGPUContextLike | undefined) ?? webgpuContext(options.canvas);
  if (!context) throw new Error("preview-renderer: WebGPU context is not available");
  const format = init.format ?? "bgra8unorm";
  context.configure({ device, format, alphaMode: "premultiplied" });
  const objects = createBackendObjects(device, format);
  const singleSampleObjects = createBackendObjects(device, EFFECT_TEXTURE_FORMAT, 1);
  const blendObjects = new Map<BlendMode, ReturnType<typeof createBackendObjects>>([
    ["normal", objects],
    ["multiply", createBackendObjects(device, format, MSAA_SAMPLE_COUNT, "multiply")],
    ["screen", createBackendObjects(device, format, MSAA_SAMPLE_COUNT, "screen")],
  ]);
  const singleSampleBlendObjects = new Map<BlendMode, ReturnType<typeof createBackendObjects>>([
    ["normal", singleSampleObjects],
    ["multiply", createBackendObjects(device, EFFECT_TEXTURE_FORMAT, 1, "multiply")],
    ["screen", createBackendObjects(device, EFFECT_TEXTURE_FORMAT, 1, "screen")],
  ]);
  const postObjects = createPostObjects(device, format);
  const postMsaaObjects = createPostObjects(device, format, MSAA_SAMPLE_COUNT);
  const postMsaaPremultipliedObjects = createPostObjects(device, format, MSAA_SAMPLE_COUNT, true);
  const clipMaskPostMsaaObjects = createClipMaskPostObjects(device, format);
  const effectPostObjects = createPostObjects(device, EFFECT_TEXTURE_FORMAT);
  const effectPostPremultipliedObjects = createPostObjects(device, EFFECT_TEXTURE_FORMAT, 1, true);
  const innerGlowPostObjects = createInnerGlowPostObjects(device, EFFECT_TEXTURE_FORMAT);
  const clipMaskPostEffectObjects = createClipMaskPostObjects(device, EFFECT_TEXTURE_FORMAT, 1);
  const assets = new Map(options.assets ?? []);
  const textures = new Map<string, WebGPUTextureLike>();
  const textureSizes = new Map<string, { width: number; height: number }>();
  const uploadedAssetRevisions = new Map<string, PreviewAssetRevision>();
  const textAtlases = new Map<string, TextAtlas>();
  const whiteTexture = device.createTexture({
    size: { width: 1, height: 1 },
    format: "rgba8unorm",
    usage: TEXTURE_BINDING | TEXTURE_COPY_DST,
  });
  device.queue.writeTexture?.(
    { texture: whiteTexture },
    new Uint8Array([255, 255, 255, 255]),
    { bytesPerRow: 4, rowsPerImage: 1 },
    { width: 1, height: 1 },
  );
  const transientBuffers = new Set<WebGPUBufferLike>();
  const transientGradientTextures = new Set<WebGPUTextureLike>();
  const diagnostics: PreviewDiagnostic[] = [];
  let width = (options.width ?? options.canvas.width) || 1;
  let height = (options.height ?? options.canvas.height) || 1;
  let dpr = options.devicePixelRatio ?? 1;
  let msaaTexture: WebGPUTextureLike | null = null;
  let msaaWidth = 0;
  let msaaHeight = 0;
  let stageTextures: [WebGPUTextureLike, WebGPUTextureLike] | null = null;
  type EffectLevel = { width: number; height: number; a: WebGPUTextureLike; b: WebGPUTextureLike };
  let effectSourceTexture: WebGPUTextureLike | null = null;
  let effectLevels: EffectLevel[] = [];
  let createLayerTexture: ((targetWidth: number, targetHeight: number) => WebGPUTextureLike) | null = null;
  let stageWidth = 0;
  let stageHeight = 0;
  let effectWidth = 0;
  let effectHeight = 0;
  let textureUploads = 0;
  let videoTextureUploads = 0;
  let lastStats: PreviewRenderStats = { backend: "webgpu", drawCalls: 0, skippedCommands: 0, frameTimeMs: 0, textureUploads: 0, videoTextureUploads: 0, diagnostics };

  const pushDiagnostic = (diagnostic: PreviewDiagnostic) => {
    const maxDiagnostics = Math.max(0, Math.floor(options.maxDiagnostics ?? 64));
    if (maxDiagnostics === 0) {
      report(diagnostic);
      return;
    }
    if (diagnostics.length >= maxDiagnostics) diagnostics.splice(0, diagnostics.length - maxDiagnostics + 1);
    diagnostics.push(diagnostic);
    report(diagnostic);
  };

  const textureFor = (assetId: string, asset: PreviewAsset): WebGPUTextureLike | null => {
    const existing = textures.get(assetId);
    const revision = previewAssetRevision(assetId, asset);
    const decision = decideTextureUpdate(uploadedAssetRevisions.get(assetId) ?? null, revision);
    if (existing && decision.kind === "reuse") return existing;
    if (!asset.pixels && !device.queue.copyExternalImageToTexture) {
      pushDiagnostic({ severity: "warning", code: "webgpu_external_image_unavailable", message: "This WebGPU device cannot upload texture image assets" });
      return null;
    }
    if (existing && decision.kind === "recreate-and-upload") {
      existing.destroy?.();
      textures.delete(assetId);
      textureSizes.delete(assetId);
      uploadedAssetRevisions.delete(assetId);
    }
    const texture = textures.get(assetId) ?? device.createTexture({
      size: { width: asset.width, height: asset.height },
      format: "rgba8unorm",
      // Chromium/Dawn requires RenderAttachment for copyExternalImageToTexture
      // when the source is an HTMLVideoElement.
      usage: TEXTURE_BINDING | TEXTURE_COPY_DST | TEXTURE_RENDER_ATTACHMENT,
    });
    if (asset.pixels && device.queue.writeTexture) {
      device.queue.writeTexture(
        { texture },
        asset.pixels,
        { bytesPerRow: asset.width * 4, rowsPerImage: asset.height },
        { width: asset.width, height: asset.height },
      );
    } else {
      device.queue.copyExternalImageToTexture?.({ source: asset.source }, { texture }, { width: asset.width, height: asset.height });
    }
    textures.set(assetId, texture);
    textureSizes.set(assetId, { width: asset.width, height: asset.height });
    uploadedAssetRevisions.set(assetId, revision);
    textureUploads += 1;
    if (asset.kind === "video") videoTextureUploads += 1;
    return texture;
  };

  const ensureMsaaTexture = (targetWidth: number, targetHeight: number): WebGPUTextureLike => {
    const nextWidth = Math.max(1, Math.round(targetWidth));
    const nextHeight = Math.max(1, Math.round(targetHeight));
    if (msaaTexture && msaaWidth === nextWidth && msaaHeight === nextHeight) {
      return msaaTexture;
    }
    msaaTexture?.destroy?.();
    msaaTexture = device.createTexture({
      size: { width: nextWidth, height: nextHeight },
      format,
      usage: TEXTURE_RENDER_ATTACHMENT,
      sampleCount: MSAA_SAMPLE_COUNT,
    });
    msaaWidth = nextWidth;
    msaaHeight = nextHeight;
    return msaaTexture;
  };

  const disposeStageTargets = () => {
    stageTextures?.[0].destroy?.();
    stageTextures?.[1].destroy?.();
    stageTextures = null;
    stageWidth = 0;
    stageHeight = 0;
  };

  const disposeEffectTargets = () => {
    effectSourceTexture?.destroy?.();
    for (const level of effectLevels) {
      level.a.destroy?.();
      level.b.destroy?.();
    }
    effectSourceTexture = null;
    effectLevels = [];
    effectWidth = 0;
    effectHeight = 0;
  };

  const disposeRenderTargets = () => {
    disposeStageTargets();
    disposeEffectTargets();
  };

  const ensureStageTargets = (targetWidth: number, targetHeight: number) => {
    const nextWidth = Math.max(1, Math.round(targetWidth));
    const nextHeight = Math.max(1, Math.round(targetHeight));
    if (stageTextures && stageWidth === nextWidth && stageHeight === nextHeight) return;
    disposeStageTargets();
    const createStageTexture = () => device.createTexture({
      size: { width: nextWidth, height: nextHeight },
      format,
      usage: TEXTURE_BINDING | TEXTURE_RENDER_ATTACHMENT,
    });
    stageTextures = [createStageTexture(), createStageTexture()];
    stageWidth = nextWidth;
    stageHeight = nextHeight;
  };

  const ensureEffectTargets = (targetWidth: number, targetHeight: number) => {
    const nextWidth = Math.max(1, Math.round(targetWidth));
    const nextHeight = Math.max(1, Math.round(targetHeight));
    if (effectSourceTexture && effectLevels.length > 0 && effectWidth === nextWidth && effectHeight === nextHeight) return;
    disposeEffectTargets();
    const createEffectTexture = (levelWidth: number, levelHeight: number) => device.createTexture({
      size: { width: levelWidth, height: levelHeight },
      format: EFFECT_TEXTURE_FORMAT,
      usage: TEXTURE_BINDING | TEXTURE_RENDER_ATTACHMENT,
    });
    createLayerTexture = (layerWidth, layerHeight) => createEffectTexture(layerWidth, layerHeight);
    effectSourceTexture = createEffectTexture(nextWidth, nextHeight);
    let levelWidth = nextWidth;
    let levelHeight = nextHeight;
    for (let level = 0; level < 9; level += 1) {
      effectLevels.push({
        width: levelWidth,
        height: levelHeight,
        a: createEffectTexture(levelWidth, levelHeight),
        b: createEffectTexture(levelWidth, levelHeight),
      });
      if (levelWidth === 1 && levelHeight === 1) break;
      levelWidth = Math.max(1, Math.ceil(levelWidth / 2));
      levelHeight = Math.max(1, Math.ceil(levelHeight / 2));
    }
    effectWidth = nextWidth;
    effectHeight = nextHeight;
  };

  const paint = (buffer: PaintCommandBuffer): PreviewRenderStats => {
    const started = performance.now();
    diagnostics.length = 0;
    const frame = buffer.commands.find((command) => command.op === "beginFrame");
    const background = cssColorToRgba(
      frame?.op === "beginFrame" ? frame.background ?? options.background : options.background,
    );
    const encoder = device.createCommandEncoder();
    const target = context.getCurrentTexture().createView();
    const physicalWidth = Math.max(1, options.canvas.width);
    const physicalHeight = Math.max(1, options.canvas.height);
    ensureStageTargets(physicalWidth, physicalHeight);
    const stages = stageTextures!;
    const multisampleTarget = ensureMsaaTexture(physicalWidth, physicalHeight).createView();
    const post = (
      nextPass: ReturnType<WebGPUCommandEncoderLike["beginRenderPass"]>,
      texture: WebGPUTextureLike,
      params: readonly [number, number, number, number] = [0, 0, 0, 0],
      postPipeline = postObjects,
      adjustments: EffectPassPlan["sourceColorAdjust"] | undefined = undefined,
      shadow?: { color: readonly [number, number, number, number]; offsetX: number; offsetY: number; compositeAlpha?: number },
      noiseEffect?: { scale: number; amount: number; opacity: number; seed: number },
    ) => {
      const uniform = device.createBuffer({ size: 144, usage: BUFFER_UNIFORM | BUFFER_COPY_DST });
      transientBuffers.add(uniform);
      const data = new Float32Array(36);
      data.set(params, 0);
      data.set(colorAdjustUniforms(adjustments), 4);
      data.set(shadow?.color ?? [0, 0, 0, 0], 24);
      data.set([shadow?.offsetX ?? 0, shadow?.offsetY ?? 0, shadow?.compositeAlpha ?? 1, 0], 28);
      data.set([noiseEffect?.scale ?? 0, noiseEffect?.amount ?? 0, noiseEffect?.opacity ?? 0, noiseEffect?.seed ?? 0], 32);
      device.queue.writeBuffer(uniform, 0, data);
      const bindGroup = device.createBindGroup({ layout: postPipeline.layout, entries: [{ binding: 0, resource: { buffer: uniform } }, { binding: 1, resource: texture.createView() }, { binding: 2, resource: objects.sampler }] });
      nextPass.setPipeline(postPipeline.pipeline);
      nextPass.setVertexBuffer(0, objects.vertexBuffer);
      nextPass.setBindGroup(0, bindGroup);
      nextPass.draw(4);
    };
    const postClipMask = (
      nextPass: ReturnType<WebGPUCommandEncoderLike["beginRenderPass"]>,
      content: WebGPUTextureLike,
      coverage: WebGPUTextureLike,
      compositeAlpha: number,
      mode: "clip" | "alpha" | "inverse-alpha" | "luma",
      pipelineObjects = clipMaskPostMsaaObjects,
    ) => {
      const uniform = device.createBuffer({ size: 16, usage: BUFFER_UNIFORM | BUFFER_COPY_DST });
      transientBuffers.add(uniform);
      device.queue.writeBuffer(uniform, 0, new Float32Array([compositeAlpha, mode === "inverse-alpha" ? 1 : 0, mode === "luma" ? 1 : 0, 0]));
      const bindGroup = device.createBindGroup({
        layout: pipelineObjects.layout,
        entries: [
          { binding: 0, resource: { buffer: uniform } },
          { binding: 1, resource: content.createView() },
          { binding: 2, resource: coverage.createView() },
          { binding: 3, resource: objects.sampler },
        ],
      });
      nextPass.setPipeline(pipelineObjects.pipeline);
      nextPass.setVertexBuffer(0, objects.vertexBuffer);
      nextPass.setBindGroup(0, bindGroup);
      nextPass.draw(4);
    };
    const beginStagePass = (output: WebGPUTextureLike, source?: WebGPUTextureLike) => {
      const nextPass = encoder.beginRenderPass({
        colorAttachments: [{ view: multisampleTarget, resolveTarget: output.createView(), clearValue: { r: background[0], g: background[1], b: background[2], a: background[3] }, loadOp: "clear", storeOp: "discard" }],
      });
      if (source) post(nextPass, source, [0, 0, 0, 0], postMsaaObjects);
      return nextPass;
    };
    let stageIndex = 0;
    let pass: ReturnType<WebGPUCommandEncoderLike["beginRenderPass"]> | null = beginStagePass(stages[stageIndex]);
    let activeObjects = objects;
    let activeEffectScope: { key: string; layerId?: string; plan: EffectPassPlan } | null = null;
    type LayerSurface = { content: WebGPUTextureLike; mask?: WebGPUTextureLike };
    type LayerScope = {
      key: string;
      layerId?: string;
      surface: LayerSurface;
      parentTarget: WebGPUTextureLike | null;
      target: "content" | "mask";
      mode?: "clip" | "alpha" | "inverse-alpha" | "luma";
      sourceKey?: string;
      compositeAlpha: number;
    };
    const isLayerMaskMode = (mode: string): mode is NonNullable<LayerScope["mode"]> =>
      mode === "clip" || mode === "alpha" || mode === "inverse-alpha" || mode === "luma";
    const layerScopes: LayerScope[] = [];
    const sourceColorAdjust = () =>
      activeEffectScope?.plan.requiresOffscreen
        ? undefined
        : activeEffectScope?.plan.sourceColorAdjust;
    const closePass = () => {
      pass?.end();
      pass = null;
    };
    const ensureStagePass = () => {
      if (pass) return;
      stageIndex = stageIndex === 0 ? 1 : 0;
      pass = beginStagePass(stages[stageIndex], stages[stageIndex === 0 ? 1 : 0]);
      activeObjects = objects;
    };
    const ensureClipMaskPass = (sourceKey: string) => {
      const scope = layerScopes.at(-1);
      if (!scope) return null;
      const target = scope.sourceKey === sourceKey && scope.surface.mask ? "mask" : "content";
      if (scope.target === target && pass) return target === "mask" ? scope.mode ?? null : null;
      closePass();
      const targetTexture = target === "mask" ? scope.surface.mask! : scope.surface.content;
      pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: targetTexture.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: target === "mask" ? "clear" : "load",
          storeOp: "store",
        }],
      });
      scope.target = target;
      activeObjects = singleSampleObjects;
      return target === "mask" ? scope.mode ?? null : null;
    };
    const objectsForTransform = (nextTransform: Extract<PaintCommand, { op: "setTransform" }>) => {
      const mode = nextTransform.blendMode ?? "normal";
      const table = activeObjects === singleSampleObjects
        ? singleSampleBlendObjects
        : blendObjects;
      return table.get(mode) ?? table.get("normal")!;
    };
    let transform: Extract<PaintCommand, { op: "setTransform" }> | null = null;
    const firstCommand = buffer.commands[0];
    if (!firstCommand || firstCommand.op !== "beginFrame") {
      throw new Error("Preview renderer requires beginFrame as the first command");
    }
    let projection = worldToClipMatrixForPaint(firstCommand);
    let drawCalls = 0;
    let skippedCommands = 0;
    const transientLayerTextures: WebGPUTextureLike[] = [];
    const gradientTextureFor = (lut: Uint8Array | undefined): WebGPUTextureLike => {
      if (!lut) return whiteTexture;
      const texture = device.createTexture({ size: { width: 256, height: 1 }, format: "rgba8unorm", usage: TEXTURE_BINDING | TEXTURE_COPY_DST });
      device.queue.writeTexture?.({ texture }, lut, { bytesPerRow: 256 * 4, rowsPerImage: 1 }, { width: 256, height: 1 });
      transientGradientTextures.add(texture);
      return texture;
    };
    for (const command of buffer.commands) {
      if (command.op === "beginFrame") {
        projection = worldToClipMatrixForPaint(command);
      } else if (command.op === "setTransform") {
        transform = command;
      } else if (command.op === "drawSolid" || command.op === "drawShape") {
        if (!activeEffectScope?.plan.requiresOffscreen && layerScopes.length === 0) ensureStagePass();
        if (activeEffectScope && !activeEffectScope.plan.supported) {
          skippedCommands += 1;
          continue;
        }
        if (!transform || !transform.visible || transform.alpha <= 0) {
          skippedCommands += 1;
          continue;
        }
        if (command.op === "drawShape" && command.shape === "polygon") {
          skippedCommands += 1;
          pushDiagnostic({ severity: "info", code: "preview_op_pending", message: "polygon shape is pending in the native preview backend", key: command.key, layerId: command.layerId });
          continue;
        }
        const maskMode = ensureClipMaskPass(command.key);
        const isMaskSource = maskMode !== null;
        const isClipMaskSource = maskMode === "clip";
        const drawObjects = isMaskSource ? singleSampleObjects : objectsForTransform(transform);
        const color = isClipMaskSource ? [1, 1, 1, transform.alpha] : cssColorToRgba(command.fill);
        if (!isClipMaskSource) color[3] *= transform.alpha * (command.op === "drawShape" ? command.fillOpacity ?? 1 : 1);
        const uniform = device.createBuffer({ size: UNIFORM_BYTES, usage: BUFFER_UNIFORM | BUFFER_COPY_DST });
        transientBuffers.add(uniform);
        const data = new Float32Array(UNIFORM_FLOATS);
        const baseMatrix = packMatrix4F32(transform.matrix4);
        writeMatrix4(data, 0, projection);
        writeMatrix4(data, 16, matrix4ForQuad(baseMatrix, 0, 0, command.width, command.height));
        data.set(color, 32);
        data[36] = command.op === "drawShape"
          ? command.shape === "ellipse" ? 1 : command.cornerRadius && command.cornerRadius > 0 ? 2 : 0
          : 0;
        data[37] = 0;
        const stroke = !isClipMaskSource && command.op === "drawShape" && (command.shape === "rectangle" || command.shape === "ellipse") && command.stroke
          ? cssColorToRgba(command.stroke)
          : [0, 0, 0, 0];
        if (!isClipMaskSource) stroke[3] *= transform.alpha * (command.op === "drawShape" ? command.strokeOpacity ?? 1 : 1);
        const strokeWidth = !isClipMaskSource && command.op === "drawShape" && (command.shape === "rectangle" || command.shape === "ellipse") && command.stroke
          ? command.strokeWidth ?? 4
          : 0;
        data[38] = strokeWidth / command.width;
        data[39] = strokeWidth / command.height;
        data.set(stroke, 40);
        data.set([
          command.op === "drawShape" ? command.cornerRadius ?? 0 : 0,
          command.width,
          command.height,
          0,
        ], 44);
        const gradients = isClipMaskSource ? gradientUniforms(undefined, 1) : gradientUniforms(
          command.op === "drawShape" ? command.fillPaint : undefined,
          transform.alpha * (command.op === "drawShape" ? command.fillOpacity ?? 1 : 1),
        );
        color[3] *= gradients.solidOpacity ?? 1;
        data.set(gradients.start, 48);
        data.set(gradients.end, 52);
        data.set(gradients.params, 56);
        data.set(gradients.radius, 60);
        data.set(gradients.stops, 64);
        data.set(gradients.offsets, 96);
        data.set(gradients.meta, 104);
        data.set(gradients.patternGeometry, 108);
        data.set(gradients.patternColors, 140);
        data.set(gradients.patternMeta, 172);
        data.set(gradients.patternTransform, 176);
        data.set(colorAdjustUniforms(isMaskSource ? undefined : sourceColorAdjust()), 184);
        device.queue.writeBuffer(uniform, 0, data);
        const gradientTexture = gradientTextureFor(gradients.lut);
        const bindGroup = device.createBindGroup({ layout: drawObjects.layout, entries: [{ binding: 0, resource: { buffer: uniform } }, { binding: 1, resource: whiteTexture.createView() }, { binding: 2, resource: drawObjects.sampler }, { binding: 3, resource: gradientTexture.createView() }, { binding: 4, resource: drawObjects.gradientSampler }] });
        pass!.setPipeline(drawObjects.pipeline);
        pass!.setVertexBuffer(0, drawObjects.vertexBuffer);
        pass!.setBindGroup(0, bindGroup);
        pass!.draw(4);
        drawCalls += 1;
      } else if (command.op === "drawPath") {
        const maskMode = ensureClipMaskPass(command.key);
        if (!activeEffectScope?.plan.requiresOffscreen && layerScopes.length === 0) ensureStagePass();
        if (activeEffectScope && !activeEffectScope.plan.supported) {
          skippedCommands += 1;
          continue;
        }
        if (!transform || !transform.visible || transform.alpha <= 0) {
          skippedCommands += 1;
          continue;
        }
        const pathWidth = command.width ?? command.mesh?.bounds.width ?? 1;
        const pathHeight = command.height ?? command.mesh?.bounds.height ?? 1;
        const meshes = [
          command.fill && command.mesh
            ? { mesh: command.mesh, color: maskMode === "clip" ? [1, 1, 1, 1] : cssColorToRgba(command.fill), opacity: maskMode === "clip" ? 1 : command.fillOpacity ?? 1, fillPaint: maskMode === "clip" ? undefined : command.fillPaint }
            : null,
          !maskMode && command.stroke && command.strokeMesh
            ? { mesh: command.strokeMesh, color: cssColorToRgba(command.stroke), opacity: command.strokeOpacity ?? 1, fillPaint: command.strokePaint }
            : null,
        ].filter((entry) => entry !== null).map((entry) => entry!);
        if (meshes.length === 0) {
          skippedCommands += 1;
          pushDiagnostic({ severity: "warning", code: "preview_path_mesh_missing", message: "drawPath requires a Runtime-resolved fill or stroke mesh", key: command.key, layerId: command.layerId });
          continue;
        }
        const drawObjects = maskMode ? singleSampleObjects : objectsForTransform(transform);
        for (const pathDraw of meshes) {
          const vertexData = new Float32Array(pathDraw.mesh.vertices.length * 2);
          for (let index = 0; index < pathDraw.mesh.vertices.length / 2; index += 1) {
            vertexData[index * 4] = pathDraw.mesh.vertices[index * 2]!;
            vertexData[index * 4 + 1] = pathDraw.mesh.vertices[index * 2 + 1]!;
            vertexData[index * 4 + 2] = pathDraw.mesh.vertices[index * 2]! / pathWidth;
            vertexData[index * 4 + 3] = pathDraw.mesh.vertices[index * 2 + 1]! / pathHeight;
          }
          const vertexBuffer = device.createBuffer({ size: vertexData.byteLength, usage: BUFFER_VERTEX | BUFFER_COPY_DST });
          const indexData = new Uint32Array(pathDraw.mesh.indices);
          const indexBuffer = device.createBuffer({ size: indexData.byteLength, usage: BUFFER_INDEX | BUFFER_COPY_DST });
          transientBuffers.add(vertexBuffer);
          transientBuffers.add(indexBuffer);
          device.queue.writeBuffer(vertexBuffer, 0, vertexData);
          device.queue.writeBuffer(indexBuffer, 0, indexData);
          const uniform = device.createBuffer({ size: UNIFORM_BYTES, usage: BUFFER_UNIFORM | BUFFER_COPY_DST });
          transientBuffers.add(uniform);
          const data = new Float32Array(UNIFORM_FLOATS);
          const color = [...pathDraw.color];
          color[3] *= transform.alpha * pathDraw.opacity;
          writeMatrix4(data, 0, projection);
          writeMatrix4(data, 16, packMatrix4F32(transform.matrix4));
          data.set(color, 32);
          data.set([0, 0, 0, 0], 36);
          data.set([0, 0, 0, 0], 40);
          data.set([0, pathWidth, pathHeight, 0], 44);
          const gradients = gradientUniforms(pathDraw.fillPaint, transform.alpha * pathDraw.opacity);
          color[3] *= gradients.solidOpacity ?? 1;
          data.set(gradients.start, 48);
          data.set(gradients.end, 52);
          data.set(gradients.params, 56);
          data.set(gradients.radius, 60);
          data.set(gradients.stops, 64);
          data.set(gradients.offsets, 96);
          data.set(gradients.meta, 104);
          data.set(gradients.patternGeometry, 108);
          data.set(gradients.patternColors, 140);
          data.set(gradients.patternMeta, 172);
          data.set(gradients.patternTransform, 176);
          data.set(colorAdjustUniforms(maskMode ? undefined : sourceColorAdjust()), 184);
          device.queue.writeBuffer(uniform, 0, data);
          const gradientTexture = gradientTextureFor(gradients.lut);
          const bindGroup = device.createBindGroup({ layout: drawObjects.layout, entries: [{ binding: 0, resource: { buffer: uniform } }, { binding: 1, resource: whiteTexture.createView() }, { binding: 2, resource: drawObjects.sampler }, { binding: 3, resource: gradientTexture.createView() }, { binding: 4, resource: drawObjects.gradientSampler }] });
          pass!.setPipeline(drawObjects.pathPipeline);
          pass!.setVertexBuffer(0, vertexBuffer);
          pass!.setIndexBuffer(indexBuffer, "uint32");
          pass!.setBindGroup(0, bindGroup);
          pass!.drawIndexed(indexData.length);
          drawCalls += 1;
        }
      } else if (command.op === "drawImage" || command.op === "drawVideo") {
        const maskMode = ensureClipMaskPass(command.key);
        if (maskMode === "clip") {
          skippedCommands += 1;
          pushDiagnostic({ severity: "error", code: "preview_clip_mask_source_invalid", message: "Clip-mask sources must render as a rectangle or ellipse shape", key: command.key, layerId: command.layerId });
          continue;
        }
        if (!activeEffectScope?.plan.requiresOffscreen && layerScopes.length === 0) ensureStagePass();
        if (activeEffectScope && !activeEffectScope.plan.supported) {
          skippedCommands += 1;
          continue;
        }
        if (!transform || !transform.visible || transform.alpha <= 0 || (command.op === "drawVideo" && command.mediaVisible === false)) {
          skippedCommands += 1;
          continue;
        }
        const asset = assets.get(command.assetId) ?? options.resolveAsset?.({ assetId: command.assetId, uri: command.uri, kind: command.op === "drawVideo" ? "video" : "image" });
        if (!asset) {
          skippedCommands += 1;
          pushDiagnostic({ severity: "warning", code: "preview_asset_missing", message: `Asset ${command.assetId} is not loaded`, key: command.key, layerId: command.layerId });
          continue;
        }
        const image = textureFor(command.assetId, asset);
        if (!image) {
          skippedCommands += 1;
          continue;
        }
        const drawObjects = maskMode ? singleSampleObjects : objectsForTransform(transform);
        const uniform = device.createBuffer({ size: UNIFORM_BYTES, usage: BUFFER_UNIFORM | BUFFER_COPY_DST });
        transientBuffers.add(uniform);
        const data = new Float32Array(UNIFORM_FLOATS);
        const layout = mediaLayout(command.width, command.height, asset.width, asset.height, command.fit, command.op === "drawImage" ? command.crop : undefined);
        const baseMatrix = packMatrix4F32(transform.matrix4);
        writeMatrix4(data, 0, projection);
        writeMatrix4(data, 16, matrix4ForQuad(baseMatrix, layout.x, layout.y, layout.width, layout.height));
        data.set([1, 1, 1, transform.alpha], 32);
        data[36] = 0;
        data[37] = 1;
        data[38] = 0;
        data[39] = 0;
        data.set([layout.uv.x, layout.uv.y, layout.uv.width, layout.uv.height], 40);
        data.set([0, 0, 0, 0], 44);
        data.set([0, 0, 0, 0], 48);
        data.set([0, 0, 0, 0], 52);
        data.set([0, 0, 0, 0], 56);
        data.set([0, 0, 0, 0], 60);
        data.set(colorAdjustUniforms(maskMode ? undefined : sourceColorAdjust()), 184);
        device.queue.writeBuffer(uniform, 0, data);
        const bindGroup = device.createBindGroup({ layout: drawObjects.layout, entries: [{ binding: 0, resource: { buffer: uniform } }, { binding: 1, resource: image.createView() }, { binding: 2, resource: drawObjects.sampler }, { binding: 3, resource: whiteTexture.createView() }, { binding: 4, resource: drawObjects.gradientSampler }] });
        pass!.setPipeline(drawObjects.pipeline);
        pass!.setVertexBuffer(0, drawObjects.vertexBuffer);
        pass!.setBindGroup(0, bindGroup);
        pass!.draw(4);
        drawCalls += 1;
      } else if (command.op === "drawText") {
        const maskMode = ensureClipMaskPass(command.key);
        if (maskMode === "clip") {
          skippedCommands += 1;
          pushDiagnostic({ severity: "error", code: "preview_clip_mask_source_invalid", message: "Clip-mask sources must render as a rectangle or ellipse shape", key: command.key, layerId: command.layerId });
          continue;
        }
        if (!activeEffectScope?.plan.requiresOffscreen && layerScopes.length === 0) ensureStagePass();
        if (activeEffectScope && !activeEffectScope.plan.supported) {
          skippedCommands += 1;
          continue;
        }
        if (!transform || !transform.visible || transform.alpha <= 0 || !command.glyphs?.length) {
          skippedCommands += 1;
          if (!command.glyphs?.length) pushDiagnostic({ severity: "warning", code: "preview_text_layout_missing", message: "drawText requires Runtime-resolved glyph outlines", key: command.key, layerId: command.layerId });
          continue;
        }
        const atlas = textAtlases.get(command.key) ?? createTextAtlas(command);
        if (!atlas) {
          skippedCommands += 1;
          pushDiagnostic({ severity: "warning", code: "preview_text_atlas_failed", message: "Unable to build the text glyph atlas", key: command.key, layerId: command.layerId });
          continue;
        }
        textAtlases.set(command.key, atlas);
        const image = textures.get(atlas.id) ?? textureFor(atlas.id, atlas.asset);
        if (!image) {
          skippedCommands += 1;
          continue;
        }
        const drawObjects = maskMode ? singleSampleObjects : objectsForTransform(transform);
        const color = cssColorToRgba(command.fill);
        color[3] *= transform.alpha;
        const baseMatrix = packMatrix4F32(transform.matrix4);
        for (const glyph of atlas.glyphs) {
          const uniform = device.createBuffer({ size: UNIFORM_BYTES, usage: BUFFER_UNIFORM | BUFFER_COPY_DST });
          transientBuffers.add(uniform);
          const data = new Float32Array(UNIFORM_FLOATS);
          writeMatrix4(data, 0, projection);
          writeMatrix4(data, 16, matrix4ForQuad(baseMatrix, glyph.x, glyph.y, glyph.width, glyph.height));
          data.set(color, 32);
          data.set([0, 2, 0, 0], 36);
          data.set([glyph.uv.x, glyph.uv.y, glyph.uv.width, glyph.uv.height], 40);
          data.set([0, 0, 0, 0], 44);
          data.set([0, 0, 0, 0], 48);
          data.set([0, 0, 0, 0], 52);
          data.set([0, 0, 0, 0], 56);
          data.set([0, 0, 0, 0], 60);
          data.set(colorAdjustUniforms(maskMode ? undefined : sourceColorAdjust()), 184);
          device.queue.writeBuffer(uniform, 0, data);
          const bindGroup = device.createBindGroup({ layout: drawObjects.layout, entries: [{ binding: 0, resource: { buffer: uniform } }, { binding: 1, resource: image.createView() }, { binding: 2, resource: drawObjects.sampler }, { binding: 3, resource: whiteTexture.createView() }, { binding: 4, resource: drawObjects.gradientSampler }] });
          pass!.setPipeline(drawObjects.pipeline);
          pass!.setVertexBuffer(0, drawObjects.vertexBuffer);
          pass!.setBindGroup(0, bindGroup);
          pass!.draw(4);
          drawCalls += 1;
        }
      } else if (command.op === "unsupported") {
        skippedCommands += 1;
        pushDiagnostic({ severity: "error", code: "preview_unsupported_command", message: command.message, key: command.key, layerId: command.layerId });
      } else if (command.op === "beginLayer" && command.effectProgram) {
        if (activeEffectScope) {
          pushDiagnostic({ severity: "error", code: "preview_nested_effect_scope_unsupported", message: "Nested effect scopes are not implemented yet", key: command.key, layerId: command.layerId });
          continue;
        }
        const plan = buildEffectPassPlan(command.effectProgram);
        for (const diagnostic of plan.diagnostics) {
          pushDiagnostic({ severity: "error", code: diagnostic.code, message: diagnostic.message, key: command.key, layerId: command.layerId });
        }
        activeEffectScope = { key: command.key, layerId: command.layerId, plan };
        if (!plan.requiresOffscreen || !plan.supported) continue;
        ensureEffectTargets(physicalWidth, physicalHeight);
        closePass();
        pass = encoder.beginRenderPass({
          colorAttachments: [{ view: effectSourceTexture!.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "clear", storeOp: "store" }],
        });
        activeObjects = singleSampleObjects;
      } else if (command.op === "endLayer" && activeEffectScope) {
        const scope = activeEffectScope;
        if (!scope || scope.key !== command.key) {
          pushDiagnostic({ severity: "error", code: "preview_effect_scope_invalid", message: "endLayer has no matching effect scope", key: command.key });
          continue;
        }
        if (!scope.plan.requiresOffscreen || !scope.plan.supported) {
          activeEffectScope = null;
          continue;
        }
        if ((!scope.plan.shadow && !scope.plan.outerGlow && !scope.plan.innerGlow && scope.plan.blurs.length === 0 && scope.plan.sourceNoise.length === 0 && scope.plan.outputNoise.length === 0) || !effectSourceTexture) {
          pushDiagnostic({ severity: "error", code: "preview_offscreen_scope_invalid", message: "Offscreen effect scope has no supported blur surface", key: command.key, layerId: scope.layerId });
          activeEffectScope = null;
          continue;
        }
        closePass();
        const runEffectPost = (
          source: WebGPUTextureLike,
          targetTexture: WebGPUTextureLike,
          params: readonly [number, number, number, number],
          adjustments: EffectPassPlan["sourceColorAdjust"] | undefined = undefined,
          shadow?: { color: readonly [number, number, number, number]; offsetX: number; offsetY: number },
          noiseEffect?: { scale: number; amount: number; opacity: number; seed: number },
        ) => {
          const effectPass = encoder.beginRenderPass({
            colorAttachments: [{ view: targetTexture.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "clear", storeOp: "store" }],
          });
          post(effectPass, source, params, effectPostObjects, adjustments, shadow, noiseEffect);
          effectPass.end();
          drawCalls += 1;
        };
        const runInnerGlowPost = (
          source: WebGPUTextureLike,
          blurred: WebGPUTextureLike,
          targetTexture: WebGPUTextureLike,
          tint: readonly [number, number, number, number],
        ) => {
          const uniform = device.createBuffer({ size: 16, usage: BUFFER_UNIFORM | BUFFER_COPY_DST });
          transientBuffers.add(uniform);
          device.queue.writeBuffer(uniform, 0, new Float32Array(tint));
          const effectPass = encoder.beginRenderPass({
            colorAttachments: [{ view: targetTexture.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "clear", storeOp: "store" }],
          });
          const bindGroup = device.createBindGroup({
            layout: innerGlowPostObjects.layout,
            entries: [
              { binding: 0, resource: { buffer: uniform } },
              { binding: 1, resource: source.createView() },
              { binding: 2, resource: blurred.createView() },
              { binding: 3, resource: objects.sampler },
            ],
          });
          effectPass.setPipeline(innerGlowPostObjects.pipeline);
          effectPass.setVertexBuffer(0, objects.vertexBuffer);
          effectPass.setBindGroup(0, bindGroup);
          effectPass.draw(4);
          effectPass.end();
          drawCalls += 1;
        };

        const root = effectLevels[0]!;
        const alphaBranch = scope.plan.shadow ?? scope.plan.outerGlow;
        const innerGlow = scope.plan.innerGlow;
        const blurs = alphaBranch ? [alphaBranch.blur] : innerGlow ? [innerGlow.blur] : scope.plan.blurs;
        // Convert the isolated premultiplied sRGB source once. Pyramid and
        // Gaussian passes stay linear and premultiplied until composition.
        runEffectPost(effectSourceTexture, root.a, [0, 0, 0, -1], scope.plan.sourceColorAdjust, undefined, scope.plan.sourceNoise[0]);
        let activeTexture = root.a;
        for (const blur of blurs) {
          const sigma = Math.min(blur.radius * dpr, 256);
          const blurPlan = blurPyramidPlan(sigma, physicalWidth, physicalHeight);
          for (let levelIndex = 1; levelIndex <= blurPlan.levels; levelIndex += 1) {
            const level = effectLevels[levelIndex]!;
            runEffectPost(activeTexture, level.a, [0, 0, 0, 0]);
            activeTexture = level.a;
          }

          const blurLevel = effectLevels[blurPlan.levels]!;
          const horizontalTexture = activeTexture === blurLevel.a ? blurLevel.b : blurLevel.a;
          runEffectPost(activeTexture, horizontalTexture, [1 / blurLevel.width, 0, blurPlan.levelSigma, 0]);
          const verticalTexture = activeTexture;
          runEffectPost(horizontalTexture, verticalTexture, [0, 1 / blurLevel.height, blurPlan.levelSigma, 0]);
          activeTexture = verticalTexture;

          for (let levelIndex = blurPlan.levels - 1; levelIndex >= 0; levelIndex -= 1) {
            const level = effectLevels[levelIndex]!;
            runEffectPost(activeTexture, level.a, [0, 0, 0, 0]);
            activeTexture = level.a;
          }
        }

        if (alphaBranch) {
          const branchColor = cssColorToRgba(alphaBranch.tint.color);
          branchColor[3] *= alphaBranch.tint.opacity;
          runEffectPost(
            activeTexture,
            root.b,
            [0, 0, 0, 2],
            undefined,
            {
              color: branchColor,
              offsetX: scope.plan.shadow ? (scope.plan.shadow.offset.x * dpr) / physicalWidth : 0,
              offsetY: scope.plan.shadow ? (scope.plan.shadow.offset.y * dpr) / physicalHeight : 0,
            },
          );
          stageIndex = stageIndex === 0 ? 1 : 0;
          let previousStage = stages[stageIndex === 0 ? 1 : 0];
          let compositePass = beginStagePass(stages[stageIndex], previousStage);
          post(compositePass, root.b, [0, 0, 0, 1], postMsaaPremultipliedObjects);
          compositePass.end();
          drawCalls += 1;

          runEffectPost(effectSourceTexture, root.a, [0, 0, 0, -1]);
          stageIndex = stageIndex === 0 ? 1 : 0;
          previousStage = stages[stageIndex === 0 ? 1 : 0];
          compositePass = beginStagePass(stages[stageIndex], previousStage);
          post(compositePass, root.a, [0, 0, 0, 1], postMsaaPremultipliedObjects);
          compositePass.end();
          drawCalls += 1;
        } else if (innerGlow) {
          const tint = cssColorToRgba(innerGlow.tint.color);
          tint[3] *= innerGlow.tint.opacity;
          runInnerGlowPost(effectSourceTexture, activeTexture, root.b, tint);

          runEffectPost(effectSourceTexture, root.a, [0, 0, 0, -1]);

          stageIndex = stageIndex === 0 ? 1 : 0;
          let previousStage = stages[stageIndex === 0 ? 1 : 0];
          let compositePass = beginStagePass(stages[stageIndex], previousStage);
          post(compositePass, root.a, [0, 0, 0, 1], postMsaaPremultipliedObjects);
          compositePass.end();
          drawCalls += 1;

          stageIndex = stageIndex === 0 ? 1 : 0;
          previousStage = stages[stageIndex === 0 ? 1 : 0];
          compositePass = beginStagePass(stages[stageIndex], previousStage);
          post(compositePass, root.b, [0, 0, 0, 1], postMsaaPremultipliedObjects);
          compositePass.end();
          drawCalls += 1;
        } else if (scope.plan.outputColorAdjust.length) {
          const adjustedTexture = activeTexture === root.a ? root.b : root.a;
          runEffectPost(activeTexture, adjustedTexture, [0, 0, 0, 0], scope.plan.outputColorAdjust, undefined, scope.plan.outputNoise[0]);
          activeTexture = adjustedTexture;
        } else if (scope.plan.outputNoise.length) {
          const adjustedTexture = activeTexture === root.a ? root.b : root.a;
          runEffectPost(activeTexture, adjustedTexture, [0, 0, 0, 0], undefined, undefined, scope.plan.outputNoise[0]);
          activeTexture = adjustedTexture;
        }

        if (!alphaBranch && !innerGlow) {
          stageIndex = stageIndex === 0 ? 1 : 0;
          const previousStage = stages[stageIndex === 0 ? 1 : 0];
          const compositePass = beginStagePass(stages[stageIndex], previousStage);
          post(compositePass, activeTexture, [0, 0, 0, 1], postMsaaPremultipliedObjects);
          compositePass.end();
          drawCalls += 1;
        }
        activeEffectScope = null;
        activeObjects = objects;
      } else if (command.op === "beginLayer" && command.isolation && command.offscreen && command.compositeAlpha !== undefined && (!command.mask || isLayerMaskMode(command.mask.mode))) {
        if (activeEffectScope) {
          pushDiagnostic({ severity: "error", code: "preview_nested_layer_unsupported", message: "Nested effect scopes are not supported by the layer surface path", key: command.key, layerId: command.layerId });
          continue;
        }
        ensureEffectTargets(physicalWidth, physicalHeight);
        if (!createLayerTexture) {
          pushDiagnostic({ severity: "error", code: "preview_layer_surface_unavailable", message: "Layer surface factory is unavailable", key: command.key, layerId: command.layerId });
          continue;
        }
        const parent = layerScopes.at(-1);
        const parentTarget = parent
          ? parent.target === "mask" ? parent.surface.mask! : parent.surface.content
          : null;
        const surface: LayerSurface = {
          content: createLayerTexture(physicalWidth, physicalHeight),
          ...(command.mask ? { mask: createLayerTexture(physicalWidth, physicalHeight) } : {}),
        };
        closePass();
        pass = encoder.beginRenderPass({
          colorAttachments: [{ view: surface.content.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "clear", storeOp: "store" }],
        });
        activeObjects = singleSampleObjects;
        layerScopes.push({
          key: command.key,
          layerId: command.layerId,
          surface,
          parentTarget,
          target: "content",
          mode: command.mask && isLayerMaskMode(command.mask.mode) ? command.mask.mode : undefined,
          sourceKey: command.mask?.sourceKey,
          compositeAlpha: command.compositeAlpha,
        });
      } else if (command.op === "endLayer") {
        const scope = layerScopes.at(-1);
        if (!scope || scope.key !== command.key || !effectLevels[0]) {
          if (scope) {
            pushDiagnostic({ severity: "error", code: "preview_layer_scope_invalid", message: "endLayer has no matching layer scope", key: command.key });
          }
          continue;
        }
        layerScopes.pop();
        closePass();
        const root = effectLevels[0]!;
        const beginTargetPass = (targetTexture: WebGPUTextureLike) => encoder.beginRenderPass({
          colorAttachments: [{ view: targetTexture.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "load", storeOp: "store" }],
        });
        if (scope.surface.mask && scope.mode && scope.sourceKey) {
          const decodePass = encoder.beginRenderPass({
            colorAttachments: [{ view: root.b.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "clear", storeOp: "store" }],
          });
          post(decodePass, scope.surface.content, [0, 0, 0, -1], effectPostObjects);
          decodePass.end();
          drawCalls += 1;
          if (scope.parentTarget) {
            const compositePass = beginTargetPass(scope.parentTarget);
            postClipMask(compositePass, root.b, scope.surface.mask, scope.compositeAlpha, scope.mode, clipMaskPostEffectObjects);
            compositePass.end();
          } else {
            stageIndex = stageIndex === 0 ? 1 : 0;
            const compositePass = beginStagePass(stages[stageIndex], stages[stageIndex === 0 ? 1 : 0]);
            postClipMask(compositePass, root.b, scope.surface.mask, scope.compositeAlpha, scope.mode);
            compositePass.end();
          }
          drawCalls += 1;
        } else {
          const decodePass = encoder.beginRenderPass({
            colorAttachments: [{ view: root.a.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "clear", storeOp: "store" }],
          });
          post(decodePass, scope.surface.content, [0, 0, 0, -1], effectPostObjects);
          decodePass.end();
          drawCalls += 1;
          if (scope.parentTarget) {
            const compositePass = beginTargetPass(scope.parentTarget);
            post(compositePass, root.a, [0, 0, 0, 1], effectPostPremultipliedObjects, undefined, { color: [0, 0, 0, 0], offsetX: 0, offsetY: 0, compositeAlpha: scope.compositeAlpha });
            compositePass.end();
          } else {
            stageIndex = stageIndex === 0 ? 1 : 0;
            const compositePass = beginStagePass(stages[stageIndex], stages[stageIndex === 0 ? 1 : 0]);
            post(compositePass, root.a, [0, 0, 0, 1], postMsaaPremultipliedObjects, undefined, { color: [0, 0, 0, 0], offsetX: 0, offsetY: 0, compositeAlpha: scope.compositeAlpha });
            compositePass.end();
          }
          drawCalls += 1;
        }
        transientLayerTextures.push(scope.surface.content);
        if (scope.surface.mask) transientLayerTextures.push(scope.surface.mask);
        activeObjects = layerScopes.length === 0 ? objects : singleSampleObjects;
      } else if (command.op === "beginLayer" && (command.isolation || command.mask)) {
        pushDiagnostic({ severity: "info", code: "preview_compositing_pending", message: "Isolation and mask scopes are pending in the native preview backend", key: command.key, layerId: command.layerId });
      }
    }
    if (activeEffectScope) {
      pushDiagnostic({ severity: "error", code: "preview_effect_scope_unclosed", message: "Effect scope was not closed", key: activeEffectScope.key, layerId: activeEffectScope.layerId });
    }
    if (layerScopes.length > 0) {
      for (const scope of layerScopes) {
        pushDiagnostic({ severity: "error", code: "preview_layer_scope_unclosed", message: "Layer scope was not closed", key: scope.key, layerId: scope.layerId });
      }
    }
    closePass();
    const presentPass = encoder.beginRenderPass({
      colorAttachments: [{ view: target, clearValue: { r: background[0], g: background[1], b: background[2], a: background[3] }, loadOp: "clear", storeOp: "store" }],
    });
    post(presentPass, stages[stageIndex]);
    presentPass.end();
    device.queue.submit([encoder.finish()]);
    const submittedLayerTextures = [...transientLayerTextures];
    const submittedBuffers = [...transientBuffers];
    const submittedGradientTextures = [...transientGradientTextures];
    transientBuffers.clear();
    transientGradientTextures.clear();
    if (device.queue.onSubmittedWorkDone) {
      void device.queue.onSubmittedWorkDone().then(() => {
        for (const texture of submittedLayerTextures) texture.destroy?.();
        for (const buffer of submittedBuffers) buffer.destroy?.();
        for (const texture of submittedGradientTextures) texture.destroy?.();
      });
    } else {
      for (const texture of submittedLayerTextures) texture.destroy?.();
      for (const buffer of submittedBuffers) transientBuffers.add(buffer);
      for (const texture of submittedGradientTextures) texture.destroy?.();
    }
    lastStats = { backend: "webgpu", drawCalls, skippedCommands, frameTimeMs: performance.now() - started, textureUploads, videoTextureUploads, diagnostics: [...diagnostics] };
    return lastStats;
  };

  return {
    kind: "webgpu",
    resize(nextWidth, nextHeight, nextDpr) {
      width = nextWidth;
      height = nextHeight;
      dpr = nextDpr;
      options.canvas.width = Math.max(1, Math.round(width * dpr));
      options.canvas.height = Math.max(1, Math.round(height * dpr));
      msaaTexture?.destroy?.();
      msaaTexture = null;
      msaaWidth = 0;
      msaaHeight = 0;
      disposeRenderTargets();
    },
    paint,
    stats: () => lastStats,
    setAsset(assetId, asset) {
      assets.set(assetId, asset);
      const previousSize = textureSizes.get(assetId);
      if (previousSize && (previousSize.width !== asset.width || previousSize.height !== asset.height)) {
        textures.get(assetId)?.destroy?.();
        textures.delete(assetId);
        textureSizes.delete(assetId);
      }
      textureFor(assetId, asset);
    },
    removeAsset(assetId) {
      assets.delete(assetId);
      textures.get(assetId)?.destroy?.();
      textures.delete(assetId);
      textureSizes.delete(assetId);
      uploadedAssetRevisions.delete(assetId);
    },
    diagnostics,
    dispose() {
      objects.vertexBuffer.destroy?.();
      singleSampleObjects.vertexBuffer.destroy?.();
      whiteTexture.destroy?.();
      msaaTexture?.destroy?.();
      msaaTexture = null;
      disposeRenderTargets();
      for (const buffer of transientBuffers) buffer.destroy?.();
      transientBuffers.clear();
      for (const texture of transientGradientTextures) texture.destroy?.();
      transientGradientTextures.clear();
      for (const texture of textures.values()) texture.destroy?.();
      textures.clear();
      textureSizes.clear();
      uploadedAssetRevisions.clear();
      textAtlases.clear();
    },
  };
}
