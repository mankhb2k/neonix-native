export type NodeTargetRef = {
  sceneId: string;
  nodeId: string;
};

export type TransformPatch = {
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  /** When true with scaleX or scaleY, apply the same absolute scale to both axes. */
  lockAspect?: boolean;
};

export type MetadataPatch = {
  name?: string;
  visible?: boolean;
};

/** Solid color strings only (gradients stay advanced / out of MVP editors). */
export type StylePatch = {
  fill?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
};

export type TextPayloadPatch = {
  text?: string;
  fontSize?: number;
  fontWeight?: number;
  align?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
};

export type MediaPayloadPatch = {
  fit?: "contain" | "cover" | "fill" | "none";
  /** Origin always required; width/height omit → preserve per-target crop size. */
  crop?: {
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
};

export type AudioTrackPatch = {
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
};

export type EffectStackPatch =
  | { op: "remove"; effectId: string }
  | { op: "reorder"; effectIds: string[] }
  | {
      op: "upsert-blur";
      effectId: string;
      radius: number;
    };

export type DocumentPropertyCommand =
  | {
      type: "set-node-transform";
      targets: NodeTargetRef[];
      patch: TransformPatch;
    }
  | {
      type: "set-node-opacity";
      targets: NodeTargetRef[];
      opacity: number;
    }
  | {
      type: "set-node-metadata";
      targets: NodeTargetRef[];
      patch: MetadataPatch;
    }
  | {
      type: "set-node-style";
      targets: NodeTargetRef[];
      patch: StylePatch;
    }
  | {
      type: "set-node-text";
      targets: NodeTargetRef[];
      patch: TextPayloadPatch;
    }
  | {
      type: "set-node-media";
      targets: NodeTargetRef[];
      patch: MediaPayloadPatch;
    }
  | {
      type: "set-audio-track";
      audioTrackId: string;
      patch: AudioTrackPatch;
    }
  | {
      type: "set-node-effects";
      targets: NodeTargetRef[];
      patch: EffectStackPatch;
    }
  | {
      type: "set-property-keyframe";
      targets: NodeTargetRef[];
      property: string;
      t: number;
      v: number | string | boolean;
      easing?: "linear" | "easeIn" | "easeOut" | "easeInOut" | "spring" | "step";
    };

export type PropertyDomainEvent =
  | {
      type: "node-transform-changed";
      targets: NodeTargetRef[];
    }
  | {
      type: "node-opacity-changed";
      targets: NodeTargetRef[];
    }
  | {
      type: "node-metadata-changed";
      targets: NodeTargetRef[];
    }
  | {
      type: "node-style-changed";
      targets: NodeTargetRef[];
    }
  | {
      type: "node-text-changed";
      targets: NodeTargetRef[];
    }
  | {
      type: "node-media-changed";
      targets: NodeTargetRef[];
    }
  | {
      type: "audio-track-changed";
      audioTrackId: string;
    }
  | {
      type: "node-effects-changed";
      targets: NodeTargetRef[];
    }
  | {
      type: "property-keyframe-changed";
      targets: NodeTargetRef[];
      property: string;
    };
