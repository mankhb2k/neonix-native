/**
 * MotionWorkspace — multi-file authoring manifest.
 *
 * Phase 10: Workspace manifest schema, reader, linker, and canonicalizer.
 *
 * A workspace is a directory containing:
 *   workspace.mt       → MotionWorkspaceManifest (entry point)
 *   scenes/*.mt        → individual scene modules
 *   components/*.mt    → embedded component definitions
 *   assets/*           → asset files referenced by the project
 *
 * The linker resolves all modules into a single canonical MotionProjectV3.
 * Runtime/renderers NEVER import this package — it's a build-time tool.
 */
import { z } from "zod";

// ── Constants ───────────────────────────────────────────────────────────

export const MOTION_WORKSPACE_FORMAT_VERSION = 1 as const;

/** Regular expression for valid module file names (lowercase, kebab-case). */
export const MODULE_NAME_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

// ── Module References ───────────────────────────────────────────────────

/** A path reference to another module in the workspace. */
export const ModuleRefSchema = z
  .object({
    /** Module type discriminator. */
    module: z.enum(["scene", "component", "asset", "variable", "token"]),
    /** Module name (file name without extension). */
    name: z.string().regex(MODULE_NAME_REGEX),
    /** Optional version for components. */
    version: z.string().min(1).max(64).optional(),
  })
  .strict();
export type ModuleRef = z.infer<typeof ModuleRefSchema>;

// ── Manifest ────────────────────────────────────────────────────────────

export const MotionWorkspaceManifestSchema = z
  .object({
    format: z.literal("motion-workspace"),
    formatVersion: z.literal(MOTION_WORKSPACE_FORMAT_VERSION),
    /** Workspace-level metadata (identity only, no timestamps in hash). */
    metadata: z
      .object({
        id: z.string().min(1).max(128),
        name: z.string().min(1).max(256),
        description: z.string().max(1024).optional(),
        locale: z.string().min(2).max(10).optional(),
        industry: z.string().min(1).max(64).optional(),
      })
      .strict(),
    /** Composition settings (overrides per-scene settings). */
    composition: z
      .object({
        width: z.number().int().positive().max(16384),
        height: z.number().int().positive().max(16384),
        fps: z.number().int().positive().max(120),
        background: z.string().min(1).max(64).optional(),
        colorSpace: z.enum(["srgb", "display-p3"]).default("srgb"),
        audioSampleRate: z.number().int().positive().max(192000).optional(),
      })
      .strict(),
    /** Design tokens (global theme overrides). */
    tokens: z
      .object({
        colors: z.record(z.string().min(1).max(64)).optional(),
        fonts: z.record(z.string().min(1).max(128)).optional(),
      })
      .strict()
      .optional(),
    /** Scene module order (determines timeline order). */
    sceneOrder: z.array(z.string().regex(MODULE_NAME_REGEX)).min(1).max(256),
    /** Component module references. */
    components: z.array(ModuleRefSchema).max(128).default([]),
    /** Variable module references. */
    variables: z.array(ModuleRefSchema).max(256).default([]),
    /** Asset module references. */
    assets: z
      .array(
        z
          .object({
            id: z.string().min(1).max(256),
            type: z.enum(["image", "svg", "video", "audio", "font"]),
            path: z.string().min(1).max(1024),
            integrity: z.string().min(1).max(256).optional(),
          })
          .strict(),
      )
      .max(10000)
      .default([]),
    /** Bundle profile for the canonicalized output. */
    profile: z
      .enum(["embedded-components", "flattened-components"])
      .default("embedded-components"),
  })
  .strict();

export type MotionWorkspaceManifest = z.infer<
  typeof MotionWorkspaceManifestSchema
>;
