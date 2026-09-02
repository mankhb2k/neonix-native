export type {
  PathContour,
  PathMesh,
  PathPoint,
  PathStrokeCap,
  PathStrokeDash,
  PathStrokeJoin,
  PathStrokeMesh,
} from "../../paint/paint-types";

export type CanonicalContour = {
  id: string;
  points: import("../../paint/paint-types").PathPoint[];
  closed: boolean;
  pathLength?: number;
};

export type PathFillRule = "nonzero" | "evenodd";
export type PathStrokeOptions = {
  join?: import("../../paint/paint-types").PathStrokeJoin;
  cap?: import("../../paint/paint-types").PathStrokeCap;
  miterLimit?: number;
  dash?: import("../../paint/paint-types").PathStrokeDash;
  /** Maximum allowed sagitta for generated round joins/caps in local units. */
  roundTolerance?: number;
};
