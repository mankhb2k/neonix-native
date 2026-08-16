import type { z } from "zod";
import { LayoutConstraintCommandSchema } from "./types";

type LayoutConstraint = z.infer<typeof LayoutConstraintCommandSchema>;

/** Named layout recipes for SceneDesign -> setLayoutConstraint. */
export const LAYOUT_RECIPES = {
  "vertical-stack": {
    mode: "column",
    gap: 24,
    padding: 16,
    align: "center",
  },
  "horizontal-row": {
    mode: "row",
    gap: 16,
    padding: 8,
    align: "center",
  },
  "two-column-grid": {
    mode: "grid",
    columns: 2,
    gap: 24,
  },
} as const satisfies Record<string, LayoutConstraint>;

export type LayoutRecipeId = keyof typeof LAYOUT_RECIPES;

export function layoutRecipe(id: LayoutRecipeId): LayoutConstraint {
  return { ...LAYOUT_RECIPES[id] } as LayoutConstraint;
}
