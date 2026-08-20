/** Backend-neutral paint data owned by the V2 runtime contract. */

export type PaintFillSolid = { type: "solid"; color: string };
export type PaintFillGradient = {
  type: "linear-gradient" | "radial-gradient";
  angle?: number;
  cx?: number;
  cy?: number;
  radius?: number;
  stops: Array<{ offset: number; color: string }>;
};
export type PaintFill = PaintFillSolid | PaintFillGradient;

export type RenderMediaFit = "contain" | "cover" | "fill" | "none";
export type RenderNormalizedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PathPoint = { x: number; y: number };
export type PathContour = {
  id: string;
  start: PathPoint;
  segments: Array<
    | { kind: "line"; to: PathPoint }
    | {
        kind: "cubic";
        control1: PathPoint;
        control2: PathPoint;
        to: PathPoint;
      }
  >;
  closed: boolean;
};

export type RuntimeEffect =
  | { id: string; type: "blur"; radius: number; seed?: number }
  | {
      id: string;
      type: "shadow" | "glow" | "inner-glow";
      color: string;
      opacity: number;
      blur?: number;
      radius?: number;
      offset?: { x: number; y: number };
      seed?: number;
    }
  | {
      id: string;
      type: "noise";
      amount: number;
      scale: number;
      opacity: number;
      animated: boolean;
      seed?: number;
    }
  | {
      id: string;
      type: "color-adjust";
      brightness?: number;
      contrast?: number;
      saturation?: number;
      hueRotate?: number;
      seed?: number;
    };
