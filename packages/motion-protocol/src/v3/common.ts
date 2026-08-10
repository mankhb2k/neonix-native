/**
 * V3 shared primitives.
 *
 * Re-exports the v2 primitives that remain stable across versions and adds
 * v3-only numeric/string helpers. Nothing here references v2 project shape.
 */
import { z } from "zod";
import {
  FiniteNumberSchema,
  IdSchema,
  LocaleIdentifierSchema,
  PropertyPathSchema,
  SemanticSchema,
  SemverSchema,
} from "../v2/common";

export const MOTION_PROJECT_V3_FORMAT_VERSION = 3 as const;
export const MOTION_WORKSPACE_FORMAT_VERSION = 1 as const;

export {
  FiniteNumberSchema,
  IdSchema,
  LocaleIdentifierSchema,
  PropertyPathSchema,
  SemanticSchema,
  SemverSchema,
};

export type {
  AspectRatio,
} from "../v2/common";

/** #rrggbb (6 hex digits). */
export const ColorHexSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Expected #rrggbb hex color");

export const NonNegativeIntegerSchema = z.number().int().nonnegative();
export const PositiveNumberSchema = z.number().positive().finite();
export const NormalizedRatioSchema = z.number().min(0).max(1).finite();
