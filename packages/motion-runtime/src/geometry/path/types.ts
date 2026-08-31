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
};

export type PathFillRule = "nonzero" | "evenodd";
export type PathStrokeOptions = {
  join?: import("../../paint/paint-types").PathStrokeJoin;
  cap?: import("../../paint/paint-types").PathStrokeCap;
  dash?: import("../../paint/paint-types").PathStrokeDash;
};
