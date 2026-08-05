import { LayoutConstraintCommandSchema } from "./types";
import type { z } from "zod";

type LayoutConstraint = z.infer<typeof LayoutConstraintCommandSchema>;

/** Named layout recipes for SceneDesign → setLayoutConstraint (R3-L5). */
export const LAYOUT_RECIPES = {
  "vertical-stack": {
    kind: "stack",
    direction: "vertical",
    gap: 24,
    padding: 16,
    align: "center",
  },
  "horizontal-row": {
    kind: "stack",
    direction: "horizontal",
    gap: 16,
    padding: 8,
    align: "center",
  },
  "two-column-grid": {
    kind: "grid",
    columns: 2,
    gapX: 24,
    gapY: 24,
  },
  "center-align": {
    kind: "align",
    axis: "both",
    align: "center",
  },
} as const satisfies Record<string, LayoutConstraint>;

export type LayoutRecipeId = keyof typeof LAYOUT_RECIPES;

export function layoutRecipe(id: LayoutRecipeId): LayoutConstraint {
  return { ...LAYOUT_RECIPES[id] } as LayoutConstraint;
}
