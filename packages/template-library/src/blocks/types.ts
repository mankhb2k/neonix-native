/** Content = cái gì trên khung. Animation = làm gì với cái đó. */
export type BlockFamily = "content" | "animation";

export type MotionBlockKind =
  | "text"
  | "shape"
  | "media"
  | "container"
  | "data"
  | "character"
  | "camera"
  | "icon"
  | "logo"
  | "cta"
  | "transition"
  | "chart";

/**
 * Timeline / motion role — chỉ meaningful khi family = animation.
 * Timing không phải intent: schedule/duration/playback nằm trên Motion Clip v2.
 */
export type MotionBlockIntent =
  | "entrance"
  | "exit"
  | "emphasis"
  | "transform"
  | "transition"
  | "camera"
  | "text-animation"
  | "number-animation"
  | "shape-animation";

/** Top-level library shelf (folder ≈ section) */
export type MotionLibraryShelfId =
  // Content
  | "text"
  | "shape"
  | "media"
  | "container"
  | "data"
  | "character"
  | "camera"
  // Animation
  | "entrance"
  | "exit"
  | "emphasis"
  | "transform"
  | "text-animation"
  | "number-animation"
  | "shape-animation"
  | "transition"
  | "camera-presets"
  // Schema-only
  | "timing";

export type MotionBlock = {
  /** Stable id — content: text.title · animation: enter.fade-up */
  id: string;
  name: string;
  nameVi: string;
  family: BlockFamily;
  kind: MotionBlockKind;
  /** Motion role — omit / ignore on pure content */
  intent?: MotionBlockIntent;
  shelf: MotionLibraryShelfId;
  description: string;
  /** Default duration (seconds). Content blocks use 0. */
  duration: number;
  durationMin: number;
  durationMax: number;
  /** Maps to Clip.source.presetId when family = animation. */
  preset?: string;
  tags: string[];
  /** Example Vietnamese copy / label for lab */
  sampleText: string;
  /** CSS class for lab preview */
  previewClass: string;
};

export type MotionLibrarySection = {
  id: MotionLibraryShelfId;
  family: BlockFamily | "meta";
  title: string;
  titleVi: string;
  description: string;
  /** false = schema/constants only (e.g. Timing) */
  isBlockShelf: boolean;
  blocks: MotionBlock[];
};
