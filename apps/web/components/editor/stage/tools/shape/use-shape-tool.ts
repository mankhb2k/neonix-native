"use client";

import { useLibraryPointerGesture } from "@/hooks/editor/use-library-pointer-gesture";
import type { ShapeTool } from "./ShapesDropdown";

export function useShapeTool(shape: ShapeTool, label: string) {
  return useLibraryPointerGesture({
    kind: "shape",
    id: `shape-${shape}`,
    label,
    shape: shape === "path" ? "polygon" : shape,
    duration: 5,
  });
}
