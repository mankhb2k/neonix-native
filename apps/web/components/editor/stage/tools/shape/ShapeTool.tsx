"use client";

import { ShapesDropdown, type ShapeTool as ShapeToolId } from "./ShapesDropdown";

type Props = {
  compact?: boolean;
  menuPlacement?: "bottom" | "right";
  includePath?: boolean;
  onSelect?: (shape: ShapeToolId) => void;
};

export function ShapeTool(props: Props) {
  return <ShapesDropdown {...props} />;
}
