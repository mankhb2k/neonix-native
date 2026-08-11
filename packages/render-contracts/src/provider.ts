/**
 * Phase 6 — Provider-neutral preview/render contract.
 *
 * Every renderer (Pixi, Remotion, server canvas, MCP preview, future
 * WebGPU renderer) implements the same request/result shapes so callers
 * never couple to a specific backend.
 *
 * ## Usage
 *
 * ```ts
 * // Describe a provider:
 * const pixiCaps: ProviderCapabilities = {
 *   providerId: "pixi-preview",
 *   displayName: "Pixi.js Preview",
 *   version: "8.0.0",
 *   backend: "webgl",
 *   supportedNodeTypes: ["group","text","image","video","shape","path","svg","camera","solid","adjustment"],
 *   supportedEffects: ["drop-shadow","blur","tint"],
 *   supportedTransitions: ["cut","fade","crossfade"],
 *   maxResolution: { width: 3840, height: 2160 },
 *   supportsAlpha: true,
 *   supportsAudio: false,
 *   supportsFinalExport: false,
 * };
 *
 * // Request a preview frame:
 * const req: PreviewFrameRequest = {
 *   kind: "preview-frame",
 *   project: compiledIr,
 *   timeSeconds: 1.5,
 *   width: 1080,
 *   height: 1920,
 *   format: "png",
 *   quality: 90,
 *   providerId: "pixi-preview",
 *   background: "#ffffff",
 * };
 * ```
 */

import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════
// Phase 8 — Group compositing contract
// ═══════════════════════════════════════════════════════════════════════

/**
 * Group compositing mode — aligns all renderers on group layer behaviour.
 *
 * V3 group semantics (see `docs/motion-format-v3.md` § Group Layer
 * Semantics) define two compositing modes for `type: "group"` nodes:
 *
 * ## `pass-through`
 *
 * Children render directly into the parent context. The group is a
 * structural container only — no isolation boundary.
 *
 * - Children inherit parent transform, opacity, visibility.
 * - Group effects/blendMode apply to each child individually (not
 *   composited as a single unit).
 * - Providers should NOT create an offscreen surface.
 * - This is the **default** mode when `compositing` is absent.
 *
 * ## `isolate`
 *
 * Children render into an offscreen surface first. The group's
 * opacity, effects, blendMode, and mask apply to the composited
 * result as a single unit.
 *
 * - Providers MUST create an offscreen surface (RenderTexture,
 *   OffscreenCanvas, etc.) at the group's logical dimensions.
 * - Children paint into the offscreen surface.
 * - The offscreen surface is composited into the parent context with
 *   the group's transform/filters applied.
 * - This is required for group-level blend modes and effects.
 *
 * ## Provider requirements
 *
 * - **Canvas (export)**: `OffscreenCanvas` → `drawImage()` with
 *   `globalAlpha` and `globalCompositeOperation`.
 * - **Pixi.js (preview)**: `RenderTexture` + `Sprite` proxy with
 *   container filters.
 * - **Remotion (export)**: HTML `<div>` wrapper with `opacity` +
 *   `mix-blend-mode` + `filter` CSS; children absolutely positioned
 *   inside.
 *
 * ## Recommendation
 *
 * `isolate` is **RECOMMENDED for the first implementation**. The
 * offscreen infrastructure already exists in Pixi (RenderTexture pool)
 * and Canvas (OffscreenCanvas). `pass-through` is the default and
 * requires no special handling.
 */
export type GroupCompositingMode = "pass-through" | "isolate";

/**
 * Provider requirements for group compositing.
 *
 * Every renderer MUST declare which compositing modes it supports in
 * `ProviderCapabilities.supportedGroupCompositingModes`.
 */
export const GROUP_COMPOSITING_MODES: readonly GroupCompositingMode[] = [
  "pass-through",
  "isolate",
] as const;

// ═══════════════════════════════════════════════════════════════════════
// Provider metadata
// ═══════════════════════════════════════════════════════════════════════

/**
 * Unique provider identifier.
 *
 * Convention: `<backend>-<variant>`, e.g. `"pixi-preview"`,
 * `"remotion-export"`, `"canvas-worker"`.
 */
export type ProviderId = string;

export const ProviderIdSchema = z.string().min(2).max(64);

/**
 * Immutable provider metadata returned by every renderer so tooling
 * can query capabilities before requesting frames.
 */
export interface ProviderInfo {
  providerId: ProviderId;
  displayName: string;
  version: string;
  backend: "webgl" | "webgpu" | "canvas" | "remotion" | "server" | "unknown";
}

export const ProviderInfoSchema = z
  .object({
    providerId: ProviderIdSchema,
    displayName: z.string().min(1).max(128),
    version: z.string().min(1).max(64),
    backend: z.enum([
      "webgl",
      "webgpu",
      "canvas",
      "remotion",
      "server",
      "unknown",
    ]),
  })
  .strict();

/**
 * What a renderer advertises it can handle.
 *
 * MCP tools use this to select a compatible provider and to surface
 * capability gaps in diagnostics.
 */
export interface ProviderCapabilities extends ProviderInfo {
  /** Node types the provider can rasterise. */
  supportedNodeTypes: string[];
  /** Effect names the provider can render (e.g. "drop-shadow", "blur"). */
  supportedEffects: string[];
  /** Transition types the provider can composite (e.g. "cut", "fade"). */
  supportedTransitions: string[];
  /** Phase 8 — Group compositing mode. */
  supportedGroupCompositingModes?: GroupCompositingMode[];
  /** Maximum output resolution (in pixels). */
  maxResolution: { width: number; height: number };
  /** Whether the provider can produce RGBA output (necessary for overlays). */
  supportsAlpha: boolean;
  /** Whether the provider can produce audio output. */
  supportsAudio: boolean;
  /** Whether the provider supports a full-quality final export pipeline. */
  supportsFinalExport: boolean;
}

export const ProviderCapabilitiesSchema = ProviderInfoSchema.extend({
  supportedNodeTypes: z.array(z.string().min(1)).min(1),
  supportedEffects: z.array(z.string().min(1)).default([]),
  supportedTransitions: z.array(z.string().min(1)).default([]),
  maxResolution: z
    .object({
      width: z.number().int().positive().max(16384),
      height: z.number().int().positive().max(16384),
    })
    .strict(),
  supportsAlpha: z.boolean(),
  supportsAudio: z.boolean(),
  supportsFinalExport: z.boolean(),
}).strict();

// ═══════════════════════════════════════════════════════════════════════
// Preview frame
// ═══════════════════════════════════════════════════════════════════════

/**
 * Request a single rasterised frame from a provider.
 */
export interface PreviewFrameRequest {
  kind: "preview-frame";
  /** The compiled runtime IR to render from. */
  project: unknown;
  /** Time within the composition, in seconds. */
  timeSeconds: number;
  /** Output width (px). Defaults to the composition width. */
  width?: number;
  /** Output height (px). Defaults to the composition height. */
  height?: number;
  /** Output image format. */
  format: "png" | "jpeg";
  /** JPEG quality (1–100). Ignored for PNG. */
  quality?: number;
  /** Which provider to route to. */
  providerId?: ProviderId;
  /** Background colour when the composition background is transparent. */
  background?: string;
}

export const PreviewFrameRequestSchema = z
  .object({
    kind: z.literal("preview-frame"),
    project: z.unknown(),
    timeSeconds: z.number().nonnegative().finite(),
    width: z.number().int().positive().max(16384).optional(),
    height: z.number().int().positive().max(16384).optional(),
    format: z.enum(["png", "jpeg"]).default("png"),
    quality: z.number().int().min(1).max(100).default(90),
    providerId: ProviderIdSchema.optional(),
    background: z.string().min(1).max(9).optional(),
  })
  .strict();

export type PreviewFrameRequestInput = z.infer<
  typeof PreviewFrameRequestSchema
>;

/**
 * A single rasterised frame returned from a provider.
 */
export interface PreviewFrameResult {
  /** Base64-encoded image data with data URI prefix. */
  imageDataUri: string;
  /** Time in seconds this frame was rendered at. */
  timeSeconds: number;
  /** Actual rendered width. */
  width: number;
  /** Actual rendered height. */
  height: number;
  /** Image format. */
  format: "png" | "jpeg";
  /** The provider that rendered this frame. */
  providerId: ProviderId;
  /** Runtime hash of the project used (deterministic fingerprint). */
  runtimeHash?: string;
  /** Any non-fatal issues encountered during rendering. */
  diagnostics: Array<{
    severity: "error" | "warning" | "info";
    message: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════
// Contact sheet
// ═══════════════════════════════════════════════════════════════════════

/**
 * Request a contact sheet (grid of thumbnail frames at sampled times).
 */
export interface PreviewContactSheetRequest {
  kind: "preview-contact-sheet";
  project: unknown;
  /** Number of columns in the grid. */
  columns?: number;
  /** Number of rows in the grid. */
  rows?: number;
  /** Thumbnail size per cell (px). */
  thumbnailSize?: number;
  format: "png" | "jpeg";
  quality?: number;
  providerId?: ProviderId;
  background?: string;
}

export const PreviewContactSheetRequestSchema = z
  .object({
    kind: z.literal("preview-contact-sheet"),
    project: z.unknown(),
    columns: z.number().int().min(1).max(20).default(5),
    rows: z.number().int().min(1).max(20).default(4),
    thumbnailSize: z.number().int().min(64).max(1024).default(256),
    format: z.enum(["png", "jpeg"]).default("png"),
    quality: z.number().int().min(1).max(100).default(90),
    providerId: ProviderIdSchema.optional(),
    background: z.string().min(1).max(9).optional(),
  })
  .strict();

export type PreviewContactSheetRequestInput = z.infer<
  typeof PreviewContactSheetRequestSchema
>;

export interface PreviewContactSheetResult {
  imageDataUri: string;
  columns: number;
  rows: number;
  totalFrames: number;
  /** Ordered list of the times sampled, one per cell. */
  sampledTimes: number[];
  width: number;
  height: number;
  format: "png" | "jpeg";
  providerId: ProviderId;
  runtimeHash?: string;
  diagnostics: Array<{
    severity: "error" | "warning" | "info";
    message: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════
// Draft video
// ═══════════════════════════════════════════════════════════════════════

/**
 * Request a fast low-resolution draft video (e.g. for quick preview).
 */
export interface DraftVideoRequest {
  kind: "draft-video";
  project: unknown;
  /** Output width (default 480). */
  width?: number;
  /** Output height (auto from aspect ratio). */
  height?: number;
  /** FPS override (defaults to composition fps). */
  fps?: number;
  /** Start time in seconds. */
  startTime?: number;
  /** End time in seconds. */
  endTime?: number;
  /** Video codec. */
  codec?: "vp8" | "vp9" | "h264" | "av1";
  providerId?: ProviderId;
  background?: string;
}

export const DraftVideoRequestSchema = z
  .object({
    kind: z.literal("draft-video"),
    project: z.unknown(),
    width: z.number().int().positive().max(1920).default(480),
    height: z.number().int().positive().max(1920).optional(),
    fps: z.number().int().positive().max(120).optional(),
    startTime: z.number().nonnegative().finite().optional(),
    endTime: z.number().positive().finite().optional(),
    codec: z.enum(["vp8", "vp9", "h264", "av1"]).default("vp8"),
    providerId: ProviderIdSchema.optional(),
    background: z.string().min(1).max(9).optional(),
  })
  .strict();

export type DraftVideoRequestInput = z.infer<typeof DraftVideoRequestSchema>;

export interface DraftVideoResult {
  /** Base64-encoded video data URI (or URL to uploaded video). */
  videoDataUri: string;
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  totalFrames: number;
  codec: string;
  /** Approximate file size in bytes. */
  fileSizeBytes?: number;
  providerId: ProviderId;
  runtimeHash?: string;
  diagnostics: Array<{
    severity: "error" | "warning" | "info";
    message: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════
// Final render
// ═══════════════════════════════════════════════════════════════════════

/**
 * Request a full-quality production render.
 */
export interface FinalRenderRequest {
  kind: "final-render";
  project: unknown;
  /** Output width (defaults to composition width). */
  width?: number;
  /** Output height (defaults to composition height). */
  height?: number;
  /** FPS override. */
  fps?: number;
  /** Start time in seconds. */
  startTime?: number;
  /** End time in seconds. */
  endTime?: number;
  /** Output codec. */
  codec?: "h264" | "h265" | "vp9" | "av1" | "prores";
  /** Pixel format. */
  pixelFormat?: "yuv420p" | "yuv422p" | "yuv444p" | "rgba";
  /** CRF / quality (0 = lossless, higher = smaller file). */
  crf?: number;
  /** Output privacy level. */
  privacy?: "private" | "public" | "upload-only";
  providerId?: ProviderId;
  background?: string;
}

export const FinalRenderRequestSchema = z
  .object({
    kind: z.literal("final-render"),
    project: z.unknown(),
    width: z.number().int().positive().max(8192).optional(),
    height: z.number().int().positive().max(8192).optional(),
    fps: z.number().int().positive().max(120).optional(),
    startTime: z.number().nonnegative().finite().optional(),
    endTime: z.number().positive().finite().optional(),
    codec: z.enum(["h264", "h265", "vp9", "av1", "prores"]).default("h264"),
    pixelFormat: z
      .enum(["yuv420p", "yuv422p", "yuv444p", "rgba"])
      .default("yuv420p"),
    crf: z.number().int().min(0).max(51).default(23),
    privacy: z.enum(["private", "public", "upload-only"]).default("private"),
    providerId: ProviderIdSchema.optional(),
    background: z.string().min(1).max(9).optional(),
  })
  .strict();

export type FinalRenderRequestInput = z.infer<typeof FinalRenderRequestSchema>;

export interface FinalRenderResult {
  /** URL to the rendered video file. */
  artifactUrl: string;
  /** Alternative URLs / formats. */
  artifacts: Array<{
    url: string;
    codec: string;
    width: number;
    height: number;
    fileSizeBytes?: number;
  }>;
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  totalFrames: number;
  providerId: ProviderId;
  renderManifest: {
    versions: {
      compiler: string;
      runtime: string;
      capabilityManifest: string;
    };
    contentHash: string;
  };
  diagnostics: Array<{
    severity: "error" | "warning" | "info";
    message: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════
// Provider registry
// ═══════════════════════════════════════════════════════════════════════

/**
 * Provider registry interface.
 *
 * A host (browser app, MCP server, CLI) registers available providers
 * and tooling queries them by id or by capability match.
 */
export interface ProviderRegistry {
  /** List all registered providers. */
  listProviders(): ProviderCapabilities[];

  /** Get a single provider's capabilities. */
  getProvider(providerId: ProviderId): ProviderCapabilities | undefined;

  /** Find providers that match all given criteria. */
  findProviders(filter: {
    minWidth?: number;
    minHeight?: number;
    supportsAlpha?: boolean;
    supportsAudio?: boolean;
    supportsFinalExport?: boolean;
    backend?: ProviderInfo["backend"];
  }): ProviderCapabilities[];

  /** Register a provider. */
  register(capabilities: ProviderCapabilities): void;

  /** Remove a provider. */
  unregister(providerId: ProviderId): boolean;
}
