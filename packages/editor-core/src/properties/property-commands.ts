import type { TimelineDocument } from "../document/document";

export type NodeTargetRef = {
  /** Id của layer gốc (top-level ancestor) — trước đây gọi là "sceneId". */
  rootLayerId: string;
  /** Id của layer đang edit. */
  layerId: string;
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

/** Scene-local layer timing (Layer Mode in/out). */
export type LayerTimingPatch = {
  start: number;
  duration: number;
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
      /** Layer mode row order — layerIds top→bottom (highest zIndex first). */
      type: "reorder-scene-layers";
      sceneId: string;
      layerIds: string[];
    }
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
      type: "set-node-timing";
      targets: NodeTargetRef[];
      timing: LayerTimingPatch;
    }
  | {
      type: "set-property-keyframe";
      targets: NodeTargetRef[];
      property: string;
      t: number;
      v: number | string | boolean;
      easing?:
        | "linear"
        | "easeIn"
        | "easeOut"
        | "easeInOut"
        | "spring"
        | "step";
    }
  | {
      type: "move-property-keyframe";
      targets: NodeTargetRef[];
      property: string;
      t: number;
      newT: number;
      newV?: number | string | boolean;
    }
  | {
      type: "delete-property-keyframe";
      targets: NodeTargetRef[];
      property: string;
      t: number;
    }
  | {
      type: "set-keyframe-easing";
      targets: NodeTargetRef[];
      property: string;
      t: number;
      easing: "linear" | "easeIn" | "easeOut" | "easeInOut" | "spring" | "step";
    };

export type PropertyDomainEvent =
  | {
      type: "scene-layers-reordered";
      sceneId: string;
      layerIds: string[];
    }
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
      type: "node-timing-changed";
      targets: NodeTargetRef[];
    }
  | {
      type: "property-keyframe-changed";
      targets: NodeTargetRef[];
      property: string;
    };

/** Kết quả của executePropertyCommand — cùng union như trước khi tách dispatcher. */
export type PropertyCommandResult =
  | {
      status: "applied";
      document: TimelineDocument;
      events: PropertyDomainEvent[];
    }
  | {
      status: "rejected";
      reason:
        | "no_project"
        | "empty_targets"
        | "missing_node"
        | "invalid_value"
        | "invalid_protocol"
        | "invalid_document";
      message: string;
    };
