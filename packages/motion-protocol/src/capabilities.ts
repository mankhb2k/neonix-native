export const MOTION_PROTOCOL_LIMITS = Object.freeze({
  idLength: 128,
  scenesPerProject: 100,
  nodesPerScene: 2_000,
  nodesPerComponent: 2_000,
  clipsPerScene: 2_000,
  clipsPerComponent: 2_000,
  tracksPerClip: 2_000,
  keysPerTrack: 10_000,
  hierarchyDepth: 64,
  listItems: 1_000,
  assetDimension: 32_768,
  mediaDurationSeconds: 86_400,
  frameRate: 240,
  sampleRate: 384_000,
  audioChannels: 16,
  nodeDimension: 32_768,
  transformScale: 1_000,
  playbackIterations: 10_000,
  semanticTags: 64,
  enumOptions: 256,
  localeCoverage: 64,
  assetsPerArtifact: 1_024,
  variablesPerArtifact: 1_024,
  publicParamsPerComponent: 512,
  bindingsPerArtifact: 4_096,
  dependenciesPerProject: 512,
  audioTracksPerProject: 2_048,
  extensionEntries: 2_048,
  patchOperations: 2_048,
  offscreenDimension: 8_192,
  offscreenPixels: 33_554_432,
  pathContours: 64,
  pathSegmentsPerContour: 10_000,
  polygonPoints: 10_000,
  repeaterInstances: 1_000,
  repeaterGridColumns: 100,
  textAnimatorUnits: 1_000,
  modifiersPerNode: 32,
  sourceImportsPerComponent: 16,
  sourcePartsPerImport: 2_048,
  sourceElementIdsPerPart: 1_024,
  cutoutRigsPerComponent: 16,
  variantSlotsPerRig: 128,
  variantsPerSlot: 128,
  actionsPerComponent: 256,
  clipsPerAction: 512,
  lipSyncCuesPerAction: 512,
  effectsPerNode: 16,
  effectRadius: 512,
  effectOffset: 32_768,
  effectIntensity: 8,
  pathMorphTargets: 64,
  secondaryMotionChainLength: 32,
  gradientStops: 16,
  dashSegments: 32,
  dashLength: 4_096,
  pathBendAmount: 1,
  parallaxFactor: 8,
  /** Max rich-text runs per text node. */
  richTextRuns: 64,
  /** Max caption tokens per caption track. */
  captionTokensPerTrack: 4_096,
  /** Max caption cues after segmentation. */
  captionCuesPerTrack: 1_024,
  /** Max caption tracks on the project timeline. */
  captionTracksPerProject: 32,
  /** Max beat markers in AudioAnalysis. */
  audioBeatsPerAsset: 10_000,
  /** Max energy envelope samples in AudioAnalysis. */
  audioEnergySamples: 32_768,
  /** Preset distance (px) for directional entrance/exit. */
  presetDistance: 2_048,
  /** Preset overshoot scale factor. */
  presetOvershoot: 2,
  /** Highlight padding for rich-text runs. */
  richTextHighlightPadding: 128,
  /** Font scale relative multiplier for a run. */
  richTextFontScale: 4,

  // ── Phase 11 — Perspective 3D limits ──────────────────────────────

  /** Max absolute Z position in 3D space (px). */
  zPositionRange: 100_000,
  /** Max absolute rotation angle around any 3D axis (degrees). */
  rotation3DAngle: 360,
  /** Max perspective FOV (degrees). */
  perspectiveFov: 179,
  /** Min near clip distance. */
  cameraNear: 0.001,
  /** Max far clip distance. */
  cameraFar: 1_000_000,
});

/**
 * Version of the capability manifest (property/effect capability tables).
 *
 * Bump when the capability tables change in a way that could alter which
 * properties are animatable/bindable — the compiler records a hash of this
 * in `MotionRuntimeProject.capabilityFingerprint` (Phase 6).
 */
export const CAPABILITY_MANIFEST_VERSION = "2.0";

export type MotionPropertyValueKind =
  | "number"
  | "angle"
  | "vec2"
  | "color"
  | "boolean"
  | "string"
  | "asset"
  | "path"
  | "gradient"
  | "json";

export type MotionPropertyCapability = {
  valueKind: MotionPropertyValueKind;
  animatable: boolean;
  bindable: boolean;
  public: boolean;
  runtimeSupport: "evaluated" | "compile-time";
  min?: number;
  minExclusive?: number;
  max?: number;
};

const TRANSFORM_PROPERTIES: Readonly<Record<string, MotionPropertyCapability>> =
  Object.freeze({
    "transform.x": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
    },
    "transform.y": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
    },
    "transform.depth": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: -MOTION_PROTOCOL_LIMITS.parallaxFactor,
      max: MOTION_PROTOCOL_LIMITS.parallaxFactor,
    },
    "transform.width": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: 0,
      max: MOTION_PROTOCOL_LIMITS.nodeDimension,
    },
    "transform.height": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: 0,
      max: MOTION_PROTOCOL_LIMITS.nodeDimension,
    },
    "transform.rotation": {
      valueKind: "angle",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
    },
    "transform.scaleX": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: 0,
      max: MOTION_PROTOCOL_LIMITS.transformScale,
    },
    "transform.scaleY": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: 0,
      max: MOTION_PROTOCOL_LIMITS.transformScale,
    },
    "transform.anchorX": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: 0,
      max: 1,
    },
    "transform.anchorY": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: 0,
      max: 1,
    },
    "transform.opacity": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: 0,
      max: 1,
    },
    "transform.visible": {
      valueKind: "boolean",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
    },
    "transform.flipX": {
      valueKind: "boolean",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
    },
    "transform.flipY": {
      valueKind: "boolean",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
    },
  });

const NODE_PROPERTIES: Readonly<
  Record<string, Readonly<Record<string, MotionPropertyCapability>>>
> = Object.freeze({
  text: {
    "payload.text": {
      valueKind: "string",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
    },
    "payload.fontSize": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      minExclusive: 0,
      max: MOTION_PROTOCOL_LIMITS.nodeDimension,
    },
    "payload.counterProgress": {
      valueKind: "number",
      animatable: true,
      bindable: false,
      public: false,
      runtimeSupport: "evaluated",
      min: 0,
      max: 1,
    },
    "style.fill": {
      valueKind: "color",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
    },
  },
  shape: {
    "style.fill": {
      valueKind: "color",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
    },
    "style.fillOpacity": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: 0,
      max: 1,
    },
    "style.stroke": {
      valueKind: "color",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
    },
    "style.strokeWidth": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: 0,
      max: MOTION_PROTOCOL_LIMITS.nodeDimension,
    },
    "style.strokeOpacity": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: 0,
      max: 1,
    },
    "style.dashOffset": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: -MOTION_PROTOCOL_LIMITS.dashLength,
      max: MOTION_PROTOCOL_LIMITS.dashLength,
    },
    "payload.cornerRadius": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: 0,
      max: MOTION_PROTOCOL_LIMITS.nodeDimension,
    },
  },
  path: {
    "style.fill": {
      valueKind: "color",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
    },
    "style.fillOpacity": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: 0,
      max: 1,
    },
    "style.stroke": {
      valueKind: "color",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
    },
    "style.strokeWidth": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: 0,
      max: MOTION_PROTOCOL_LIMITS.nodeDimension,
    },
    "style.strokeOpacity": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: 0,
      max: 1,
    },
    "style.dashOffset": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: -MOTION_PROTOCOL_LIMITS.dashLength,
      max: MOTION_PROTOCOL_LIMITS.dashLength,
    },
  },
  solid: {
    "payload.width": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: 0,
      max: MOTION_PROTOCOL_LIMITS.nodeDimension,
    },
    "payload.height": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: 0,
      max: MOTION_PROTOCOL_LIMITS.nodeDimension,
    },
    "payload.color": {
      valueKind: "color",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
    },
  },
  svg: {
    "payload.assetId": {
      valueKind: "asset",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
    },
    "style.fill": {
      valueKind: "color",
      animatable: false,
      bindable: true,
      public: true,
      runtimeSupport: "compile-time",
    },
  },
  image: {
    "payload.assetId": {
      valueKind: "asset",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
    },
  },
  video: {
    "payload.assetId": {
      valueKind: "asset",
      animatable: false,
      bindable: true,
      public: true,
      runtimeSupport: "compile-time",
    },
    "payload.trimStart": {
      valueKind: "number",
      animatable: false,
      bindable: true,
      public: true,
      runtimeSupport: "compile-time",
      min: 0,
      max: MOTION_PROTOCOL_LIMITS.mediaDurationSeconds,
    },
    "payload.muted": {
      valueKind: "boolean",
      animatable: false,
      bindable: true,
      public: true,
      runtimeSupport: "compile-time",
    },
  },
  camera: {
    "payload.zoom": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      minExclusive: 0,
      max: MOTION_PROTOCOL_LIMITS.transformScale,
    },
    "payload.parallaxStrength": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: 0,
      max: MOTION_PROTOCOL_LIMITS.parallaxFactor,
    },
  },
  bone: {
    "payload.length": {
      valueKind: "number",
      animatable: false,
      bindable: true,
      public: false,
      runtimeSupport: "compile-time",
      min: 0,
      max: MOTION_PROTOCOL_LIMITS.nodeDimension,
    },
  },
  adjustment: {
    "payload.brightness": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: -1,
      max: 1,
    },
    "payload.contrast": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: 0,
      max: 4,
    },
    "payload.saturation": {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: 0,
      max: 4,
    },
  },
});

export function motionPropertyCapability(
  nodeType: string,
  property: string,
): MotionPropertyCapability | undefined {
  const transform = TRANSFORM_PROPERTIES[property];
  if (transform) return transform;
  if (/^modifiers\.[^.]+\.progress$/.test(property))
    return {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: 0,
      max: 1,
    };
  if (/^modifiers\.[^.]+\.(start|end)$/.test(property))
    return {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: 0,
      max: 1,
    };
  if (/^modifiers\.[^.]+\.offset$/.test(property))
    return {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
    };
  if (/^modifiers\.[^.]+\.amount$/.test(property))
    return {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: -MOTION_PROTOCOL_LIMITS.pathBendAmount,
      max: MOTION_PROTOCOL_LIMITS.pathBendAmount,
    };
  if (/^modifiers\.[^.]+\.weight$/.test(property))
    return {
      valueKind: "number",
      animatable: true,
      bindable: true,
      public: true,
      runtimeSupport: "evaluated",
      min: 0,
      max: 1,
    };
  const effectMatch = /^effects\.[^.]+\.([^.]+)$/.exec(property);
  if (effectMatch) {
    for (const type of ["blur", "shadow", "glow", "color-adjust"] as const) {
      const capability = motionEffectPropertyCapability(type, effectMatch[1]!);
      if (capability) return capability;
    }
  }
  if (
    nodeType === "component" &&
    property.startsWith("payload.props.") &&
    property.length > "payload.props.".length
  ) {
    return {
      valueKind: "json",
      animatable: false,
      bindable: true,
      public: true,
      runtimeSupport: "compile-time",
    };
  }
  return NODE_PROPERTIES[nodeType]?.[property];
}

export type MotionPropertyCapabilityEntry = MotionPropertyCapability & {
  property: string;
};

export function motionEffectPropertyCapability(
  effectType: "blur" | "shadow" | "glow" | "color-adjust",
  field: string,
): MotionPropertyCapability | undefined {
  const number = (min?: number, max?: number): MotionPropertyCapability => ({
    valueKind: "number",
    animatable: true,
    bindable: true,
    public: true,
    runtimeSupport: "evaluated",
    min,
    max,
  });
  switch (effectType) {
    case "blur":
      return field === "radius"
        ? number(0, MOTION_PROTOCOL_LIMITS.effectRadius)
        : undefined;
    case "shadow":
      if (field === "offsetX" || field === "offsetY")
        return number(
          -MOTION_PROTOCOL_LIMITS.effectOffset,
          MOTION_PROTOCOL_LIMITS.effectOffset,
        );
      if (field === "blur")
        return number(0, MOTION_PROTOCOL_LIMITS.effectRadius);
      if (field === "opacity") return number(0, 1);
      if (field === "color")
        return {
          valueKind: "color",
          animatable: true,
          bindable: true,
          public: true,
          runtimeSupport: "evaluated",
        };
      return undefined;
    case "glow":
      if (field === "radius")
        return number(0, MOTION_PROTOCOL_LIMITS.effectRadius);
      if (field === "intensity")
        return number(0, MOTION_PROTOCOL_LIMITS.effectIntensity);
      if (field === "opacity") return number(0, 1);
      if (field === "color")
        return {
          valueKind: "color",
          animatable: true,
          bindable: true,
          public: true,
          runtimeSupport: "evaluated",
        };
      return undefined;
    case "color-adjust":
      if (field === "brightness") return number(-1, 1);
      if (field === "contrast" || field === "saturation") return number(0, 4);
      return undefined;
  }
}

/** Enumerable safe vocabulary for AI authoring and schema-driven controls. */
export function motionPropertyCapabilities(
  nodeType: string,
  motionPathModifierIds: readonly string[] = [],
): MotionPropertyCapabilityEntry[] {
  return [
    ...Object.entries(TRANSFORM_PROPERTIES),
    ...Object.entries(NODE_PROPERTIES[nodeType] ?? {}),
    ...motionPathModifierIds.map(
      (id) =>
        [
          `modifiers.${id}.progress`,
          motionPropertyCapability(nodeType, `modifiers.${id}.progress`)!,
        ] as const,
    ),
  ].map(([property, capability]) => ({ property, ...capability }));
}

/** Public AI/control surface only — callers must not expose non-public capabilities. */
export function publicMotionPropertyCapabilities(
  nodeType: string,
  motionPathModifierIds: readonly string[] = [],
): MotionPropertyCapabilityEntry[] {
  return motionPropertyCapabilities(nodeType, motionPathModifierIds).filter(
    (capability) => capability.public,
  );
}

export function motionLiteralMatchesValueKind(
  kind: MotionPropertyValueKind,
  value: unknown,
): boolean {
  if (kind === "json") return true;
  if (kind === "number" || kind === "angle")
    return typeof value === "number" && Number.isFinite(value);
  if (kind === "boolean") return typeof value === "boolean";
  if (kind === "vec2") {
    if (
      Array.isArray(value) &&
      value.length === 2 &&
      value.every((item) => typeof item === "number" && Number.isFinite(item))
    )
      return true;
    if (
      value !== null &&
      typeof value === "object" &&
      "x" in value &&
      "y" in value
    ) {
      const v = value as { x: unknown; y: unknown };
      return (
        typeof v.x === "number" &&
        Number.isFinite(v.x) &&
        typeof v.y === "number" &&
        Number.isFinite(v.y)
      );
    }
    return false;
  }
  return (
    typeof value === "string" || (value !== null && typeof value === "object")
  );
}

export function motionVariableTypeMatchesValueKind(
  kind: MotionPropertyValueKind,
  variableType: string,
): boolean {
  if (kind === "json") return true;
  if (kind === "asset") return variableType === "asset";
  if (kind === "color") return variableType === "color";
  if (kind === "angle") return variableType === "number";
  return kind === variableType;
}

export function motionPropertyValueError(
  capability: MotionPropertyCapability,
  value: unknown,
  property: string,
): string | undefined {
  if (!motionLiteralMatchesValueKind(capability.valueKind, value))
    return `Expected ${capability.valueKind} value for ${property}`;
  if (typeof value !== "number") return undefined;
  if (capability.min !== undefined && value < capability.min)
    return `Value ${value} is below minimum ${capability.min} for ${property}`;
  if (capability.minExclusive !== undefined && value <= capability.minExclusive)
    return `Value ${value} must be greater than ${capability.minExclusive} for ${property}`;
  if (capability.max !== undefined && value > capability.max)
    return `Value ${value} exceeds maximum ${capability.max} for ${property}`;
  return undefined;
}
