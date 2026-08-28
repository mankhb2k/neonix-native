import {
  multiplyMatrix4,
  composeLocalMatrix4,
  evaluateRuntimeProjectV2,
  frameIndexAtTime,
  orthographicProjectionMatrix,
  perspectiveProjectionMatrix,
  rotationMatrixX,
  rotationMatrixY,
  rotationMatrixZ,
  translationMatrix3D,
  type Matrix4,
  type PaintCommandBuffer,
  type RuntimeNodeV2,
  type RuntimeAudioClipV2,
  type RuntimeAudioProjectV2,
  type RuntimeAudioSourceV2,
  type RuntimeAudioTrackV2,
  type RuntimeProjectV2,
  type RuntimeVisualProjectV3,
  type RuntimeEffect,
  type RuntimeMaskV2,
  identityMatrix4,
  interpolatePathContours,
  tessellateClosedPath,
      tessellatePathStroke,
} from "@motionvideo/motion-runtime";
import {
  isV2AtomCertified,
  isV2AudioCapabilityCertified,
  parseMotionProtocol,
  type MotionProtocolV2,
} from "@motionvideo/motion-protocol";

function viewProjectionMatrix4(project: MotionProtocolV2): {
  worldToClipMatrix: Matrix4;
} {
  const { width, height } = project.composition;
  const view = project.composition.view;
  const viewTranslate = translationMatrix3D(
    -view.transform.translate.x,
    -view.transform.translate.y,
    -view.transform.translate.z,
  );
  const viewRotation = multiplyMatrix4(
    multiplyMatrix4(
      rotationMatrixX(-view.transform.rotate.x),
      rotationMatrixY(-view.transform.rotate.y),
    ),
    rotationMatrixZ(-view.transform.rotate.z),
  );
  const viewMatrix = multiplyMatrix4(viewTranslate, viewRotation);
  const projection = view.projection;
  const projectionMatrix =
    projection?.kind === "perspective"
      ? perspectiveProjectionMatrix(
          width,
          height,
          projection.fov,
          projection.near,
          projection.far,
        )
      : orthographicProjectionMatrix(
          width,
          height,
          projection.zoom,
          projection.near,
          projection.far,
        );
  return {
    worldToClipMatrix: multiplyMatrix4(projectionMatrix, viewMatrix),
  };
}

const DEFAULT_RECTANGLE_STROKE_WIDTH = 4;
const DEFAULT_PATH_STROKE_WIDTH = 1;

function lowerEffects(
  effects: Array<{
    id: string;
    type: "color-adjust" | "blur" | "drop-shadow" | "outer-glow" | "inner-glow" | "noise";
    brightness?: number;
    contrast?: number;
    saturation?: number;
    hueRotate?: number;
    radius?: number;
    x?: number;
    y?: number;
    blur?: number;
    color?: string;
    opacity?: number;
    scale?: number;
    amount?: number;
    seed?: number;
  }> | undefined,
): RuntimeEffect[] | undefined {
  if (!effects?.length) return undefined;
  // Preserve authoring order. A later effect always receives the prior result.
  return effects.map((effect) => {
    const capability = effect.type === "blur"
      ? "effect.blur"
      : effect.type === "drop-shadow"
        ? "effect.drop-shadow"
        : effect.type === "outer-glow"
          ? "effect.outer-glow"
          : effect.type === "inner-glow"
            ? "effect.inner-glow"
          : effect.type === "noise" ? "effect.noise" : "effect.color-adjust";
    if (!isV2AtomCertified(capability)) {
      throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
    }
    return { ...effect } as RuntimeEffect;
  });
}

function lowerBlendMode(layer: MotionProtocolV2["layers"][number]): "normal" | "multiply" | "screen" | "add" {
  const blendMode = layer.composite?.blendMode ?? "normal";
  const capability = `composite.blend.${blendMode}`;
  if (!isV2AtomCertified(capability)) {
    throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
  }
  return blendMode;
}

function requireCertifiedAudioCapability(capability: string): void {
  if (!isV2AudioCapabilityCertified(capability)) {
    throw new Error(`Uncertified Protocol V2 audio capability: ${capability}`);
  }
}

function lowerAudioSource(
  asset: Extract<MotionProtocolV2["assets"][number], { kind: "audio" | "video" }>,
): RuntimeAudioSourceV2 {
  const derivative = asset.kind === "video" ? asset.audio : undefined;
  return {
    assetId: asset.id,
    kind: asset.kind,
    uri: asset.uri,
    ...(asset.mimeType ? { mimeType: asset.mimeType } : {}),
    ...(asset.duration !== undefined ? { duration: asset.duration } : {}),
    ...(asset.kind === "audio" && asset.sampleRate !== undefined
      ? { sampleRate: asset.sampleRate }
      : {}),
    ...(asset.kind === "audio" && asset.channels !== undefined
      ? { channels: asset.channels }
      : {}),
    ...(asset.integrity ? { integrity: asset.integrity } : {}),
    ...(derivative ? {
      audioUri: derivative.uri,
      ...(derivative.mimeType ? { audioMimeType: derivative.mimeType } : {}),
      ...(derivative.duration !== undefined ? { audioDuration: derivative.duration } : {}),
      ...(derivative.sampleRate !== undefined ? { audioSampleRate: derivative.sampleRate } : {}),
      ...(derivative.channels !== undefined ? { audioChannels: derivative.channels } : {}),
      ...(derivative.integrity ? { audioIntegrity: derivative.integrity } : {}),
    } : {}),
  };
}

/** Zero-length protocol fades are an explicit no-op and are omitted at runtime. */
function isActiveFade(fade: { duration: number } | undefined): fade is { duration: number } {
  return fade !== undefined && fade.duration > 0;
}

function lowerAudio(project: MotionProtocolV2): RuntimeAudioProjectV2 {
  const assetsById = new Map(project.assets.map((asset) => [asset.id, asset]));
  const tracks: RuntimeAudioTrackV2[] = project.audio.tracks.map((track) => {
    requireCertifiedAudioCapability("audio.timing");
    requireCertifiedAudioCapability("audio.gain");
    requireCertifiedAudioCapability("audio.pan");
    if (track.muted) requireCertifiedAudioCapability("audio.track.mute");

    const clips: RuntimeAudioClipV2[] = track.clips.map((clip) => {
      requireCertifiedAudioCapability("audio.asset");
      requireCertifiedAudioCapability("audio.timing");
      requireCertifiedAudioCapability("audio.trim");
      requireCertifiedAudioCapability("audio.gain");
      if (isActiveFade(clip.fadeIn) || isActiveFade(clip.fadeOut)) requireCertifiedAudioCapability("audio.fade");

      const asset = assetsById.get(clip.assetId);
      if (!asset || (asset.kind !== "audio" && asset.kind !== "video")) {
        throw new Error(`Protocol V2 audio clip ${clip.id} references an invalid source asset`);
      }
      if (asset.kind === "video") requireCertifiedAudioCapability("audio.video-source");
      return {
        id: clip.id,
        assetId: clip.assetId,
        source: lowerAudioSource(asset),
        timing: { ...clip.timing },
        trim: { ...clip.trim },
        playbackRate: clip.playbackRate,
        loop: false,
        gainDb: clip.gainDb,
        ...(isActiveFade(clip.fadeIn) ? { fadeIn: { ...clip.fadeIn } } : {}),
        ...(isActiveFade(clip.fadeOut) ? { fadeOut: { ...clip.fadeOut } } : {}),
      };
    });

    for (let left = 0; left < clips.length; left += 1) {
      for (let right = left + 1; right < clips.length; right += 1) {
        const first = clips[left]!;
        const second = clips[right]!;
        const overlaps = first.timing.start < second.timing.start + second.timing.duration &&
          second.timing.start < first.timing.start + first.timing.duration;
        if (overlaps) requireCertifiedAudioCapability("audio.track.overlap");
      }
    }

    return {
      id: track.id,
      gainDb: track.gainDb,
      pan: track.pan,
      muted: track.muted,
      clips,
    };
  });

  return {
    sampleRate: project.audio.sampleRate,
    tracks,
  };
}

function lowerEmbeddedVideoAudio(
  project: MotionProtocolV2,
  layerContexts: ReadonlyMap<string, LayerContext>,
): RuntimeAudioTrackV2[] {
  const assetsById = new Map(project.assets.map((asset) => [asset.id, asset]));
  return project.layers.flatMap((layer) => {
    if (layer.type !== "video" || !layer.payload.audio) return [];
    for (const capability of ["audio.asset", "audio.timing", "audio.trim", "audio.gain"]) {
      requireCertifiedAudioCapability(capability);
    }
    if (isActiveFade(layer.payload.audio.fadeIn) || isActiveFade(layer.payload.audio.fadeOut)) {
      requireCertifiedAudioCapability("audio.fade");
    }
    const asset = assetsById.get(layer.payload.assetId);
    if (!asset || asset.kind !== "video") {
      throw new Error(`Embedded video audio ${layer.id} references an invalid video asset`);
    }
    const context = layerContexts.get(layer.id);
    if (!context || context.timing.duration <= 0) return [];
    return [{
      id: `embedded-audio:${layer.id}`,
      gainDb: 0,
      pan: 0,
      muted: !layer.payload.audio.enabled,
      clips: [{
        id: `embedded-audio:${layer.id}:clip`,
        assetId: asset.id,
        source: lowerAudioSource(asset),
        timing: { ...context.timing },
        trim: {
          start: layer.payload.trimStart ?? 0,
          ...(layer.payload.trimEnd !== undefined ? { end: layer.payload.trimEnd } : {}),
        },
        playbackRate: 1,
        loop: false,
        gainDb: layer.payload.audio.gainDb,
        ...(isActiveFade(layer.payload.audio.fadeIn) ? { fadeIn: { ...layer.payload.audio.fadeIn } } : {}),
        ...(isActiveFade(layer.payload.audio.fadeOut) ? { fadeOut: { ...layer.payload.audio.fadeOut } } : {}),
      }],
    }];
  });
}

function lowerMask(
  layer: MotionProtocolV2["layers"][number],
  layersById: ReadonlyMap<string, MotionProtocolV2["layers"][number]>,
): RuntimeMaskV2 | undefined {
  const mask = layer.composite?.mask;
  if (!mask) return undefined;
  if (layer.type !== "group") {
    throw new Error(`Protocol V2 mask must target a group: ${layer.id}`);
  }
  const capability = `mask.${mask.mode}`;
  if (!isV2AtomCertified(capability)) {
    throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
  }
  const source = layersById.get(mask.sourceLayerId);
  if (!source || source.parentLayerId !== layer.id || source.type === "group" || (mask.mode === "clip" && source.type !== "shape")) {
    throw new Error(`Protocol V2 ${mask.mode} mask source is invalid: ${layer.id}`);
  }
  return { mode: mask.mode, sourceId: source.id };
}

type LayerContext = {
  localMatrix: Matrix4;
  worldMatrix: Matrix4;
  opacity: number;
  visible: boolean;
  timing: { start: number; duration: number };
};

/** Options accepted by the canonical Protocol compiler. */
export type CompileProtocolOptions = Record<string, never>;
/** @deprecated Use CompileProtocolOptions. */
export type CompileProtocolV2Options = CompileProtocolOptions;

/** Compile Atomic Protocol V2 into the canonical visual/audio Runtime IR. */
export function compileProtocol(
  input: unknown,
  _options: CompileProtocolOptions = {},
): RuntimeProjectV2 {
  const project = parseMotionProtocol(input);
  const projection = viewProjectionMatrix4(project);
  const layerById = new Map(project.layers.map((layer) => [layer.id, layer]));
  const contextCache = new Map<string, LayerContext>();

  const resolveLayerContext = (layer: MotionProtocolV2["layers"][number]): LayerContext => {
    const cached = contextCache.get(layer.id);
    if (cached) return cached;
    const localMatrix = composeLocalMatrix4(layer.transform);
    const parent = layer.parentLayerId === null ? null : layerById.get(layer.parentLayerId) ?? null;
    const parentContext = parent
      ? resolveLayerContext(parent)
      : {
          localMatrix: identityMatrix4(),
          worldMatrix: identityMatrix4(),
          opacity: 1,
          visible: true,
          timing: { start: 0, duration: Number.POSITIVE_INFINITY },
        };
    const start = parentContext.timing.start + layer.timing.start;
    const end = Math.min(
      parentContext.timing.start + parentContext.timing.duration,
      start + layer.timing.duration,
    );
    const context: LayerContext = {
      localMatrix,
      worldMatrix: multiplyMatrix4(parentContext.worldMatrix, localMatrix),
      // Group opacity is deliberately not folded into child alpha. Runtime
      // preserves group nodes so it can flatten their subtree and apply that
      // alpha exactly once at the compositing boundary.
      opacity: layer.opacity,
      visible: parentContext.visible && layer.opacity > 0 && end > start,
      timing: { start, duration: Math.max(0, end - start) },
    };
    contextCache.set(layer.id, context);
    return context;
  };

  const nodes = project.layers.map((layer): RuntimeNodeV2 | null => {
    const context = resolveLayerContext(layer);
    const blendMode = lowerBlendMode(layer);
    if (layer.type === "group") {
      for (const capability of [
        "group.transform",
        "group.timing",
        "group.opacity",
        "group.order",
      ]) {
        if (!isV2AtomCertified(capability)) {
          throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
        }
      }
      if (context.timing.duration <= 0) return null;
      const mask = lowerMask(layer, layerById);
      return {
        id: layer.id,
        parentId: layer.parentLayerId,
        order: layer.order,
        timing: context.timing,
        opacity: context.opacity,
        blendMode,
        ...(mask ? { mask } : {}),
        visible: context.visible,
        localMatrix: context.localMatrix,
        worldMatrix: context.worldMatrix,
        content: {
          kind: "group",
          width: layer.frame.width,
          height: layer.frame.height,
        },
      };
    }
    if (context.timing.duration <= 0) return null;
    if (layer.type === "image") {
      for (const capability of [
        "image.transform",
        "image.timing",
        "image.opacity",
        "image.order",
        "image.asset",
        "image.fit",
        "image.crop",
      ]) {
        if (!isV2AtomCertified(capability)) {
          throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
        }
      }
      const asset = project.assets?.find((candidate) => candidate.id === layer.payload.assetId);
      const effects = lowerEffects(layer.effects);
      return {
        id: layer.id,
        parentId: layer.parentLayerId,
        order: layer.order,
        timing: context.timing,
        opacity: context.opacity,
        blendMode,
        visible: context.visible,
        localMatrix: context.localMatrix,
        worldMatrix: context.worldMatrix,
        content: {
          kind: "image" as const,
          assetId: layer.payload.assetId,
          ...(asset?.uri ? { uri: asset.uri } : {}),
          width: layer.frame.width,
          height: layer.frame.height,
          ...(layer.payload.fit ? { fit: layer.payload.fit } : {}),
          ...(layer.payload.crop ? { crop: layer.payload.crop } : {}),
          ...(effects ? { effects } : {}),
        },
      };
    }
    if (layer.type === "video") {
      for (const capability of [
        "video.transform",
        "video.timing",
        "video.opacity",
        "video.order",
        "video.asset",
        "video.fit",
        "video.trim",
        "video.framePolicy",
      ]) {
        if (!isV2AtomCertified(capability)) {
          throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
        }
      }
      const asset = project.assets?.find((candidate) => candidate.id === layer.payload.assetId);
      if (asset?.kind !== undefined && asset.kind !== "video") {
        throw new Error(`Protocol V2 video layer ${layer.id} references a non-video asset`);
      }
      const sourceFps = asset?.kind === "video" && asset.fps !== undefined
        ? asset.fps
        : project.composition.fps;
      const effects = lowerEffects(layer.effects);
      return {
        id: layer.id,
        parentId: layer.parentLayerId,
        order: layer.order,
        timing: context.timing,
        opacity: context.opacity,
        blendMode,
        visible: context.visible,
        localMatrix: context.localMatrix,
        worldMatrix: context.worldMatrix,
        content: {
          kind: "video" as const,
          assetId: layer.payload.assetId,
          ...(asset?.uri ? { uri: asset.uri } : {}),
          width: layer.frame.width,
          height: layer.frame.height,
          ...(layer.payload.fit ? { fit: layer.payload.fit } : {}),
          trimStart: layer.payload.trimStart ?? 0,
          ...(layer.payload.trimEnd !== undefined
            ? { trimEnd: layer.payload.trimEnd }
            : asset?.kind === "video" && asset.duration !== undefined
              ? { trimEnd: asset.duration }
              : {}),
          ...(asset?.kind === "video" && asset.duration !== undefined
            ? { sourceDuration: asset.duration }
            : {}),
          sourceFps,
          // Native video audio is never an output path. Embedded audio is
          // lowered into RuntimeAudioProjectV2 below and played via WebAudio.
          muted: true,
          framePolicy: layer.payload.framePolicy ?? "floor",
          ...(effects ? { effects } : {}),
        },
      };
    }
    if (layer.type === "text") {
      for (const capability of [
        "text.transform",
        "text.timing",
        "text.opacity",
        "text.order",
        "text.font",
        layer.payload.text.includes("\n") ? "text.layout.multiline" : "text.layout.singleLine",
        "text.align",
        "text.verticalAlign",
        "text.fill",
      ]) {
        if (!isV2AtomCertified(capability)) {
          throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
        }
      }
      const asset = project.assets?.find((candidate) => candidate.id === layer.payload.fontAssetId);
      if (asset?.kind !== "font") {
        throw new Error(`Protocol V2 text layer ${layer.id} references a non-font asset`);
      }
      const effects = lowerEffects(layer.effects);
      return {
        id: layer.id,
        parentId: layer.parentLayerId,
        order: layer.order,
        timing: context.timing,
        opacity: context.opacity,
        blendMode,
        visible: context.visible,
        localMatrix: context.localMatrix,
        worldMatrix: context.worldMatrix,
        content: {
          kind: "text" as const,
          text: layer.payload.text,
          fontAssetId: layer.payload.fontAssetId,
          fontUri: asset.uri,
          fontIntegrity: asset.integrity,
          fontSize: layer.payload.fontSize,
          lineHeight: layer.payload.lineHeight,
          letterSpacing: layer.payload.letterSpacing,
          align: layer.payload.align,
          verticalAlign: layer.payload.verticalAlign,
          wrap: layer.payload.wrap,
          overflow: layer.payload.overflow,
          direction: layer.payload.direction,
          language: layer.payload.language,
          fill: layer.style.fill,
          width: layer.frame.width,
          height: layer.frame.height,
          ...(effects ? { effects } : {}),
        },
      };
    }
    if (layer.type === "path") {
      for (const capability of [
        "path.transform",
        "path.timing",
        "path.opacity",
        "path.order",
      ]) {
        if (!isV2AtomCertified(capability)) {
          throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
        }
      }
      const contours = layer.payload.morph
        ? interpolatePathContours(
            layer.payload.contours,
            layer.payload.morph.targetContours,
            layer.payload.morph.progress,
          )
        : layer.payload.contours;
      const hasFill = layer.style.fill !== undefined;
      if (hasFill && !isV2AtomCertified("path.fill")) {
        throw new Error("Uncertified Protocol V2 atom: path.fill");
      }
      if (hasFill && contours.some((contour) => !contour.closed)) {
        throw new Error(`Protocol V2 atom ${layer.id}: fill requires closed contours`);
      }
      if (layer.style.fillOpacity !== undefined && !isV2AtomCertified("path.fillOpacity")) {
        throw new Error("Uncertified Protocol V2 atom: path.fillOpacity");
      }
      if (layer.style.stroke !== undefined && !isV2AtomCertified("path.stroke")) {
        throw new Error("Uncertified Protocol V2 atom: path.stroke");
      }
      if (layer.style.strokeWidth !== undefined) {
        if (layer.style.stroke === undefined) {
          throw new Error(`Protocol V2 atom ${layer.id}: strokeWidth requires stroke`);
        }
        if (!isV2AtomCertified("path.strokeWidth")) {
          throw new Error("Uncertified Protocol V2 atom: path.strokeWidth");
        }
      }
      if (layer.style.strokeOpacity !== undefined) {
        if (layer.style.stroke === undefined) {
          throw new Error(`Protocol V2 atom ${layer.id}: strokeOpacity requires stroke`);
        }
        if (!isV2AtomCertified("path.strokeOpacity")) {
          throw new Error("Uncertified Protocol V2 atom: path.strokeOpacity");
        }
      }
      if (layer.style.stroke !== undefined) {
        for (const capability of ["path.strokeJoin", "path.strokeCap"]) {
          if (!isV2AtomCertified(capability)) {
            throw new Error(`Uncertified Protocol V2 atom: ${capability}`);
          }
        }
        if (layer.style.strokeDash && !isV2AtomCertified("path.strokeDash")) {
          throw new Error("Uncertified Protocol V2 atom: path.strokeDash");
        }
      }
      if (layer.payload.morph && !isV2AtomCertified("path.morph")) {
        throw new Error("Uncertified Protocol V2 atom: path.morph");
      }
      const strokeWidth = layer.style.strokeWidth ?? DEFAULT_PATH_STROKE_WIDTH;
      const strokeJoin = layer.style.strokeJoin ?? "miter";
      const strokeCap = layer.style.strokeCap ?? "butt";
      const strokeDash = layer.style.strokeDash
        ? { array: layer.style.strokeDash.array, offset: layer.style.strokeDash.offset ?? 0 }
        : undefined;
      const effects = lowerEffects(layer.effects);
      return {
        id: layer.id,
        parentId: layer.parentLayerId,
        order: layer.order,
        timing: context.timing,
        opacity: context.opacity,
        blendMode,
        visible: context.visible,
        localMatrix: context.localMatrix,
        worldMatrix: context.worldMatrix,
        content: {
          kind: "path" as const,
          width: layer.frame.width,
          height: layer.frame.height,
          contours,
          ...(hasFill
            ? {
                mesh: tessellateClosedPath(contours, layer.payload.fillRule),
                fill: layer.style.fill!,
              }
            : {}),
          ...(layer.style.stroke !== undefined
            ? {
                stroke: layer.style.stroke,
                strokeWidth,
                strokeMesh: tessellatePathStroke(
                  contours,
                  strokeWidth,
                  {
                    join: strokeJoin,
                    cap: strokeCap,
                    dash: strokeDash,
                  },
                ),
                ...(layer.style.strokeOpacity !== undefined
                  ? { strokeOpacity: layer.style.strokeOpacity }
                  : {}),
                strokeJoin,
                strokeCap,
                ...(strokeDash ? { strokeDash } : {}),
              }
            : {}),
          fillRule: layer.payload.fillRule,
          ...(layer.style.fillOpacity !== undefined
            ? { fillOpacity: layer.style.fillOpacity }
            : {}),
          ...(effects ? { effects } : {}),
        },
      };
    }
    const fillCapability = `${layer.type}.${layer.payload.shape}.fill`;
    if (!isV2AtomCertified(fillCapability)) {
      throw new Error(`Uncertified Protocol V2 atom: ${fillCapability}`);
    }
    const gradientFill = typeof layer.style.fill === "object" ? layer.style.fill : null;
    if (gradientFill && !isV2AtomCertified(`${layer.type}.${layer.payload.shape}.gradient`)) {
      throw new Error(`Uncertified Protocol V2 atom: ${layer.type}.${layer.payload.shape}.gradient`);
    }
    if (layer.style.stroke !== undefined) {
      const strokeCapability = `${layer.type}.${layer.payload.shape}.stroke`;
      if (!isV2AtomCertified(strokeCapability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${strokeCapability}`);
      }
    }
    if (layer.style.strokeWidth !== undefined) {
      if (layer.style.stroke === undefined) {
        throw new Error(`Protocol V2 atom ${layer.id}: strokeWidth requires stroke`);
      }
      const strokeWidthCapability = `${layer.type}.${layer.payload.shape}.strokeWidth`;
      if (!isV2AtomCertified(strokeWidthCapability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${strokeWidthCapability}`);
      }
    }
    if (layer.style.fillOpacity !== undefined) {
      const fillOpacityCapability = `${layer.type}.${layer.payload.shape}.fillOpacity`;
      if (!isV2AtomCertified(fillOpacityCapability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${fillOpacityCapability}`);
      }
    }
    if (layer.style.strokeOpacity !== undefined) {
      if (layer.style.stroke === undefined) {
        throw new Error(`Protocol V2 atom ${layer.id}: strokeOpacity requires stroke`);
      }
      const strokeOpacityCapability = `${layer.type}.${layer.payload.shape}.strokeOpacity`;
      if (!isV2AtomCertified(strokeOpacityCapability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${strokeOpacityCapability}`);
      }
    }
    if (layer.payload.cornerRadius !== undefined) {
      if (layer.payload.shape !== "rectangle") {
        throw new Error(`Protocol V2 atom ${layer.id}: cornerRadius requires rectangle`);
      }
      const cornerRadiusCapability = `${layer.type}.${layer.payload.shape}.cornerRadius`;
      if (!isV2AtomCertified(cornerRadiusCapability)) {
        throw new Error(`Uncertified Protocol V2 atom: ${cornerRadiusCapability}`);
      }
    }

    const effects = lowerEffects(layer.effects);
    return {
      id: layer.id,
        parentId: layer.parentLayerId,
      order: layer.order,
      timing: context.timing,
      opacity: context.opacity,
      blendMode,
      visible: context.visible,
      localMatrix: context.localMatrix,
      worldMatrix: context.worldMatrix,
      content: {
        kind: "shape" as const,
        shape: layer.payload.shape,
        width: layer.frame.width,
        height: layer.frame.height,
        fill: typeof layer.style.fill === "string"
          ? layer.style.fill
          : layer.style.fill.stops[0]!.color,
        ...(gradientFill ? { fillPaint: gradientFill } : {}),
        ...(layer.payload.cornerRadius !== undefined
          ? {
              cornerRadius: Math.min(
                layer.payload.cornerRadius,
                layer.frame.width / 2,
                layer.frame.height / 2,
              ),
            }
          : {}),
        ...(layer.style.fillOpacity !== undefined
          ? { fillOpacity: layer.style.fillOpacity }
          : {}),
        ...(layer.style.stroke !== undefined
          ? {
              stroke: layer.style.stroke,
              strokeWidth: layer.style.strokeWidth ?? DEFAULT_RECTANGLE_STROKE_WIDTH,
              ...(layer.style.strokeOpacity !== undefined
                ? { strokeOpacity: layer.style.strokeOpacity }
                : {}),
            }
          : {}),
        ...(effects ? { effects } : {}),
      },
    };
  }).filter((node): node is RuntimeNodeV2 => node !== null);

  const audioBase = lowerAudio(project);
  const audio: RuntimeAudioProjectV2 = {
    ...audioBase,
    tracks: [
      ...audioBase.tracks,
      ...lowerEmbeddedVideoAudio(project, contextCache),
    ],
  };
  const visualDuration = nodes.reduce(
    (duration, node) => Math.max(duration, node.timing.start + node.timing.duration),
    0,
  );
  const audioDuration = audio.tracks.reduce(
    (duration, track) => track.clips.reduce(
      (trackDuration, clip) => Math.max(trackDuration, clip.timing.start + clip.timing.duration),
      duration,
    ),
    0,
  );

  return {
    format: "motion-runtime",
    formatVersion: 2,
    id: project.id,
    composition: {
      width: project.composition.width,
      height: project.composition.height,
      fps: project.composition.fps,
      duration: Math.max(visualDuration, audioDuration),
      background: project.composition.background,
      graphId: project.id,
    },
    view: projection,
    nodes,
    audio,
  };
}

/**
 * Internal V3 visual boundary. The certified lowering implementation remains
 * shared while media/audio V3 compilation bypasses the legacy runtime shape.
 */
export function compileVisualProject(
  input: unknown,
  options: CompileProtocolOptions = {},
): RuntimeVisualProjectV3 {
  const legacy = compileProtocol(input, options);
  return {
    composition: legacy.composition,
    view: legacy.view,
    nodes: legacy.nodes,
  };
}

/** Compile V2 and evaluate one frame into the backend-neutral paint contract. */
export function compileProtocolToPaintCommands(
  input: unknown,
  options: { frame?: number; time?: number } = {},
): PaintCommandBuffer {
  const runtime = compileProtocol(input);
  const frame = options.frame ??
    (options.time == null
      ? 0
      : frameIndexAtTime(options.time, runtime.composition.fps));
  return evaluateRuntimeProjectV2(runtime, frame, {
    ...(options.time != null ? { time: options.time } : {}),
  });
}

/** @deprecated Use compileProtocol. Kept as a source-compatible migration shim. */
export const compileProtocolV2 = compileProtocol;

/** @deprecated Use compileProtocolToPaintCommands. */
export const compileProtocolV2ToPaintCommands = compileProtocolToPaintCommands;
