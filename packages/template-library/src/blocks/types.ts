export type MotionBlockKind =
  | "text"
  | "shape"
  | "media"
  | "chart"
  | "character"
  | "camera"
  | "audio"
  | "effects"
  | "icon"
  | "logo"
  | "cta"
  | "transition";

/**
 * Timeline / motion role — orthogonal to kind (target).
 * Timing is NOT an intent: delay/duration/easing live on AnimationSchema.
 */
export type MotionBlockIntent =
  | "entrance"
  | "exit"
  | "emphasis"
  | "transform"
  | "transition"
  | "camera"
  | "effects";

/** Top-level Motion Library shelf (folder = section) */
export type MotionLibraryShelfId =
  | "text"
  | "shape"
  | "media"
  | "chart"
  | "character"
  | "camera"
  | "entrance"
  | "exit"
  | "emphasis"
  | "transform"
  | "transition"
  | "timing"
  | "audio"
  | "effects";

export type MotionBlock = {
  /** Stable id, e.g. text.fade-up */
  id: string;
  name: string;
  nameVi: string;
  kind: MotionBlockKind;
  /** What the motion does on the timeline */
  intent?: MotionBlockIntent;
  /** Which library shelf owns this block (physical folder) */
  shelf: MotionLibraryShelfId;
  description: string;
  /** Default duration in seconds */
  duration: number;
  durationMin: number;
  durationMax: number;
  /** Maps to MotionProject layer animation.preset when applicable */
  preset?: string;
  tags: string[];
  /** Example Vietnamese copy for QA diacritics */
  sampleText: string;
  /** CSS @keyframes / class used by web preview lab */
  previewClass: string;
};

export type MotionLibrarySection = {
  id: MotionLibraryShelfId;
  title: string;
  titleVi: string;
  description: string;
  /** false = schema/constants only (e.g. Timing), not MotionBlocks */
  isBlockShelf: boolean;
  blocks: MotionBlock[];
};
