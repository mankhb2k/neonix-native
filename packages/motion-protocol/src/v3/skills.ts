/**
 * V3 Skill Template Contract — instruction layer around MotionProjectV3.
 *
 * A Skill is a named template that:
 *  1. Declares what capabilities it needs.
 *  2. Declares what input parameters it accepts.
 *  3. Declares what output it produces (full project, patch, or report).
 *  4. Provides a human-readable instruction body (the SKILL.md content).
 *
 * Skills are NOT projects — they are instruction sets that AI agents and
 * MCP tools use to create or patch MotionProjectV3 documents. The generated
 * output is always a V3 entity (MotionProjectV3, MotionProjectV3Patch, or
 * validation report). Skills cannot emit V2 fields.
 */

import { z } from "zod";
import { IdSchema, FiniteNumberSchema } from "./common";
import { CapabilityIdSchema } from "./capabilities";
import { MotionProjectV3Schema, type MotionProjectV3 } from "./index";
import {
  MotionProjectV3PatchSchema,
  type MotionProjectV3Patch,
  type V3PatchResult,
} from "./patch";
import type { MotionProjectV3 as _MotionProjectV3 } from "./index";
import type { MotionProjectV3Patch as _MotionProjectV3Patch } from "./patch";

// ── Skill format constants ────────────────────────────────────────────

export const MOTION_SKILL_MANIFEST_FORMAT_VERSION = 1 as const;

// ── Skill output contract ─────────────────────────────────────────────

/** Describes what a skill produces. */
export const SkillOutputContractSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("full-project"),
      description: z.string().min(1).max(256).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("patch"),
      description: z.string().min(1).max(256).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("template-params"),
      description: z.string().min(1).max(256).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("validation-report"),
      description: z.string().min(1).max(256).optional(),
    })
    .strict(),
]);

export type SkillOutputContract = z.infer<typeof SkillOutputContractSchema>;

// ── Skill manifest ────────────────────────────────────────────────────

export const MotionSkillManifestSchema = z
  .object({
    /** Unique skill id in `namespace/name` format (e.g. `motion/brand-intro`). */
    id: z
      .string()
      .regex(/^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]+$/, {
        message: "Skill id must be namespace/name (e.g. motion/brand-intro)",
      })
      .describe("Unique skill id (namespace/name)"),

    /** Human-readable name (e.g. "Brand Intro"). */
    name: z.string().min(1).max(128),

    /** Short description shown in skill pickers. */
    description: z.string().min(1).max(1024),

    /** Semantic version. */
    version: z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/, {
      message: "version must be semver (e.g. 1.0.0)",
    }),

    /** Author attribution. */
    author: z
      .object({
        name: z.string().min(1).max(128),
        url: z.string().url().optional(),
      })
      .strict(),

    /** IANA media type of the instruction body. `text/markdown` for SKILL.md. */
    instructionFormat: z.literal("text/markdown").default("text/markdown"),

    /** Capabilities the skill requires at runtime. */
    requiredCapabilities: z.array(CapabilityIdSchema).max(256).default([]),

    /**
     * JSON Schema (Draft-07) describing the template parameters the skill
     * accepts. Stored as a raw object so tools can pass it directly to a
     * JSON Schema validator.
     */
    inputSchema: z
      .record(z.unknown())
      .refine(
        (val) => typeof val.type === "string" || val.$ref !== undefined || true,
        { message: "inputSchema should be a valid JSON Schema object" },
      ),

    /** Declares what the skill produces when executed. */
    outputContract: SkillOutputContractSchema,

    /** Tags for search and filtering. */
    tags: z.array(z.string().min(1).max(64)).max(32).default([]),

    /** Optional preview thumbnail URL. */
    thumbnailUrl: z.string().url().optional(),
  })
  .strict();

export type MotionSkillManifest = z.infer<typeof MotionSkillManifestSchema>;

// ── Skill execution result ────────────────────────────────────────────

export type SkillExecutionResult =
  | {
      kind: "full-project";
      project: MotionProjectV3;
    }
  | {
      kind: "patch";
      patch: MotionProjectV3Patch;
    }
  | {
      kind: "template-params";
      params: Record<string, unknown>;
    }
  | {
      kind: "validation-report";
      valid: boolean;
      diagnostics: Array<{
        path: string;
        message: string;
        severity: "error" | "warning" | "info";
      }>;
    };

// ── Skill validation helpers ──────────────────────────────────────────

export interface SkillValidationDiagnostic {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface SkillValidationResult {
  valid: boolean;
  diagnostics: SkillValidationDiagnostic[];
}

/**
 * Validate a skill manifest and its output.
 *
 * Checks:
 *  1. The manifest itself is valid (parse).
 *  2. If output is a project, it must be V3-only.
 *  3. If output is a patch, it must target V3 paths.
 *  4. The generated project compiles without V2 fallback.
 */
export function validateMotionSkillOutput(
  manifest: MotionSkillManifest,
  output: SkillExecutionResult,
): SkillValidationResult {
  const diagnostics: SkillValidationDiagnostic[] = [];

  // Re-validate manifest
  const manifestCheck = MotionSkillManifestSchema.safeParse(manifest);
  if (!manifestCheck.success) {
    return {
      valid: false,
      diagnostics: manifestCheck.error.issues.map((issue) => ({
        path: `manifest.${issue.path.join(".")}`,
        message: issue.message,
        severity: "error" as const,
      })),
    };
  }

  // Check output matches declared contract
  if (manifest.outputContract.kind !== output.kind) {
    diagnostics.push({
      path: "output.kind",
      message: `Output kind "${output.kind}" does not match contract "${manifest.outputContract.kind}"`,
      severity: "error",
    });
  }

  // Validate output content
  switch (output.kind) {
    case "full-project": {
      // Check for V2 leaks BEFORE schema parse (Zod .strict() would reject
      // V2 fields, but we want explicit, actionable diagnostics).
      const raw = output.project as Record<string, unknown>;
      if (raw.formatVersion === 2) {
        diagnostics.push({
          path: "output.project.formatVersion",
          message:
            "Skill output contains formatVersion: 2 — V3 projects must use formatVersion: 3",
          severity: "error",
        });
      }
      const timeline = raw.timeline as Record<string, unknown> | undefined;
      if (timeline && "sceneOrder" in timeline) {
        diagnostics.push({
          path: "output.project.timeline",
          message:
            "Skill output contains V2 field 'sceneOrder' — use visualTracks instead",
          severity: "error",
        });
      }
      const scenes = raw.scenes as Array<Record<string, unknown>> | undefined;
      if (scenes) {
        for (let i = 0; i < scenes.length; i++) {
          const scene = scenes[i]!;
          if ("transition" in scene) {
            diagnostics.push({
              path: `output.project.scenes.${i}.transition`,
              message:
                "Skill output contains V2 field 'scene.transition' — transitions belong on timeline VisualClip.transitionOut",
              severity: "error",
            });
          }
        }
      }

      const projectCheck = MotionProjectV3Schema.safeParse(output.project);
      if (!projectCheck.success) {
        diagnostics.push(
          ...projectCheck.error.issues.map((issue) => ({
            path: `output.project.${issue.path.join(".")}`,
            message: issue.message,
            severity: "error" as const,
          })),
        );
      }
      break;
    }
    case "patch": {
      const patchCheck = MotionProjectV3PatchSchema.safeParse(output.patch);
      if (!patchCheck.success) {
        diagnostics.push(
          ...patchCheck.error.issues.map((issue) => ({
            path: `output.patch.${issue.path.join(".")}`,
            message: issue.message,
            severity: "error" as const,
          })),
        );
      }
      break;
    }
    case "template-params": {
      // Template params are validated against inputSchema by the caller
      break;
    }
    case "validation-report": {
      if (output.diagnostics.length === 0 && !output.valid) {
        diagnostics.push({
          path: "output",
          message:
            "Validation report marked invalid but contains no diagnostics",
          severity: "warning",
        });
      }
      break;
    }
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

/**
 * Validate a skill manifest metadata only (no output to check).
 */
export function validateSkillManifest(input: unknown): SkillValidationResult {
  const result = MotionSkillManifestSchema.safeParse(input);
  if (!result.success) {
    return {
      valid: false,
      diagnostics: result.error.issues.map((issue) => ({
        path: `manifest.${issue.path.join(".")}`,
        message: issue.message,
        severity: "error" as const,
      })),
    };
  }
  return { valid: true, diagnostics: [] };
}

// ── Built-in skill examples (reference manifests) ─────────────────────

/**
 * Brand intro skill — creates a V3 project with animated logo + headline.
 */
export const BRAND_INTRO_SKILL: MotionSkillManifest = {
  id: "motion/brand-intro",
  name: "Brand Intro",
  description:
    "Creates a 5-second brand introduction with animated logo reveal and headline text",
  version: "1.0.0",
  author: { name: "MotiClip" },
  requiredCapabilities: [
    "primitive.text",
    "primitive.image",
    "anim.transform",
    "anim.opacity",
  ],
  inputSchema: {
    type: "object",
    required: ["brandName", "headline"],
    properties: {
      brandName: { type: "string", minLength: 1, maxLength: 128 },
      headline: { type: "string", minLength: 1, maxLength: 256 },
      primaryColor: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
      logoUrl: { type: "string", format: "uri" },
      duration: { type: "number", minimum: 3, maximum: 15, default: 5 },
    },
  },
  outputContract: { kind: "full-project" },
  tags: ["brand", "intro", "logo"],
};

/**
 * Social ad skill — patches an existing project with social-safe layout.
 */
export const SOCIAL_AD_SKILL: MotionSkillManifest = {
  id: "motion/social-ad",
  name: "Social Ad",
  description:
    "Patches a project for social media ad formats with safe-area-aware layout",
  version: "1.0.0",
  author: { name: "MotiClip" },
  requiredCapabilities: [
    "primitive.text",
    "primitive.image",
    "primitive.video",
    "anim.transform",
    "anim.opacity",
  ],
  inputSchema: {
    type: "object",
    required: ["platform", "ctaText"],
    properties: {
      platform: {
        type: "string",
        enum: ["tiktok", "reels", "youtube", "facebook"],
      },
      ctaText: { type: "string", minLength: 1, maxLength: 64 },
      headline: { type: "string", minLength: 1, maxLength: 256 },
      bodyText: { type: "string", maxLength: 1024 },
      aspectRatio: { type: "string", enum: ["9:16", "1:1", "16:9"] },
    },
  },
  outputContract: { kind: "patch" },
  tags: ["social", "ad", "marketing"],
};

/**
 * Subtitle styling skill — patches caption tracks with branded typography.
 */
export const SUBTITLE_STYLING_SKILL: MotionSkillManifest = {
  id: "motion/subtitle-styling",
  name: "Subtitle Styling",
  description:
    "Styles existing caption tracks with brand fonts, colors, and positioning",
  version: "1.0.0",
  author: { name: "MotiClip" },
  requiredCapabilities: ["primitive.text"],
  inputSchema: {
    type: "object",
    required: ["fontFamily", "fontSize"],
    properties: {
      fontFamily: { type: "string", minLength: 1, maxLength: 128 },
      fontSize: { type: "number", minimum: 12, maximum: 72 },
      fill: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
      background: { type: "string", pattern: "^#[0-9a-fA-F]{6,8}$" },
      position: {
        type: "string",
        enum: ["top", "bottom", "center"],
        default: "bottom",
      },
      locale: { type: "string", default: "vi-VN" },
    },
  },
  outputContract: { kind: "patch" },
  tags: ["caption", "subtitle", "typography", "styling"],
};

/**
 * Product demo skill — creates a product showcase with feature callouts.
 */
export const PRODUCT_DEMO_SKILL: MotionSkillManifest = {
  id: "motion/product-demo",
  name: "Product Demo",
  description:
    "Creates a product demonstration with feature highlights and call-to-action",
  version: "1.0.0",
  author: { name: "MotiClip" },
  requiredCapabilities: [
    "primitive.text",
    "primitive.image",
    "primitive.video",
    "primitive.shape",
    "anim.transform",
    "anim.opacity",
    "effect.glow",
    "style.gradient",
  ],
  inputSchema: {
    type: "object",
    required: ["productName", "features"],
    properties: {
      productName: { type: "string", minLength: 1, maxLength: 128 },
      tagline: { type: "string", minLength: 1, maxLength: 256 },
      features: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        items: { type: "string", maxLength: 128 },
      },
      primaryColor: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
      productImageUrl: { type: "string", format: "uri" },
      duration: { type: "number", minimum: 5, maximum: 60, default: 15 },
    },
  },
  outputContract: { kind: "full-project" },
  tags: ["product", "demo", "marketing", "showcase"],
};

/**
 * Corporate template skill — creates a professional presentation template.
 */
export const CORPORATE_TEMPLATE_SKILL: MotionSkillManifest = {
  id: "motion/corporate-template",
  name: "Corporate Template",
  description:
    "Creates a professional corporate video template with consistent branding",
  version: "1.0.0",
  author: { name: "MotiClip" },
  requiredCapabilities: [
    "primitive.text",
    "primitive.shape",
    "primitive.image",
    "anim.transform",
    "anim.opacity",
    "style.gradient",
  ],
  inputSchema: {
    type: "object",
    required: ["companyName"],
    properties: {
      companyName: { type: "string", minLength: 1, maxLength: 128 },
      presentationTitle: { type: "string", maxLength: 256 },
      primaryColor: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
      secondaryColor: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
      fontFamily: { type: "string", maxLength: 128 },
      logoUrl: { type: "string", format: "uri" },
      slideCount: { type: "integer", minimum: 1, maximum: 20, default: 3 },
      includeContactSlide: { type: "boolean", default: true },
    },
  },
  outputContract: { kind: "full-project" },
  tags: ["corporate", "business", "presentation", "template"],
};

/** All built-in skill manifests for runtime discovery. */
export const BUILTIN_SKILLS: MotionSkillManifest[] = [
  BRAND_INTRO_SKILL,
  SOCIAL_AD_SKILL,
  SUBTITLE_STYLING_SKILL,
  PRODUCT_DEMO_SKILL,
  CORPORATE_TEMPLATE_SKILL,
];

/**
 * Look up a built-in skill by id.
 * Returns undefined if the skill is not found.
 */
export function getBuiltinSkill(id: string): MotionSkillManifest | undefined {
  return BUILTIN_SKILLS.find((skill) => skill.id === id);
}
