/** Frame draft types for timeline commands — no localStorage. */

export const DEFAULT_FRAME_DURATION = 5;

export type FrameDraftKind = "text" | "shape" | "image" | "video";
/**
 * Canonical shape vocabulary — mirrors the V1 `shape` payload values 1:1.
 * `rect`/`circle` were legacy aliases and are no longer accepted.
 */
export type FrameDraftShape = "rectangle" | "ellipse" | "polygon";

export type FrameDraft = {
  id: string;
  name: string;
  role?: string;
  duration: number;
  text: string;
  /** Scene node kind. Defaults to text when omitted. */
  kind?: FrameDraftKind;
  /** Shape variant when kind === "shape". Mapped to schema rectangle/ellipse. */
  shape?: FrameDraftShape;
  /** Asset reference when kind is image or video. */
  assetId?: string;
};
