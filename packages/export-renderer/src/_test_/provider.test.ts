/**
 * Phase 6 — Provider-neutral preview/render contract tests.
 */
import { describe, expect, it } from "vitest";
import {
  ProviderInfoSchema,
  ProviderCapabilitiesSchema,
  PreviewFrameRequestSchema,
  PreviewContactSheetRequestSchema,
  DraftVideoRequestSchema,
  FinalRenderRequestSchema,
} from "../contracts/provider";

// ── ProviderInfo ─────────────────────────────────────────────────────

describe("ProviderInfo", () => {
  it("accepts a valid native preview provider", () => {
    const parsed = ProviderInfoSchema.safeParse({
      providerId: "preview-webgl2",
      displayName: "Native WebGL2 Preview",
      version: "0.0.1",
      backend: "webgl",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a valid native-vps-export provider", () => {
    const parsed = ProviderInfoSchema.safeParse({
      providerId: "native-vps-export",
      displayName: "Native VPS Export",
      version: "4.0.506",
      backend: "server",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a server canvas worker", () => {
    const parsed = ProviderInfoSchema.safeParse({
      providerId: "canvas-worker",
      displayName: "Canvas 2D Worker",
      version: "1.0.0",
      backend: "server",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown backend", () => {
    const parsed = ProviderInfoSchema.safeParse({
      providerId: "bad",
      displayName: "Bad",
      version: "1",
      backend: "directx",
    });
    expect(parsed.success).toBe(false);
  });
});

// ── ProviderCapabilities ─────────────────────────────────────────────

describe("ProviderCapabilities", () => {
  const previewCaps = {
    providerId: "preview-webgl2",
    displayName: "Native WebGL2 Preview",
    version: "0.0.1",
    backend: "webgl" as const,
    supportedNodeTypes: [
      "group",
      "text",
      "image",
      "video",
      "shape",
      "path",
      "svg",
      "camera",
      "solid",
      "adjustment",
    ],
    supportedEffects: ["drop-shadow", "blur", "tint"],
    supportedTransitions: ["cut", "fade", "crossfade"],
    maxResolution: { width: 3840, height: 2160 },
    supportsAlpha: true,
    supportsAudio: false,
    supportsFinalExport: false,
  };

  const nativeVpsCaps = {
    providerId: "native-vps-export",
    displayName: "Native VPS Export",
    version: "4.0.506",
    backend: "server" as const,
    supportedNodeTypes: [
      "group",
      "text",
      "image",
      "video",
      "shape",
      "svg",
      "solid",
    ],
    supportedEffects: [],
    supportedTransitions: [],
    maxResolution: { width: 7680, height: 4320 },
    supportsAlpha: true,
    supportsAudio: true,
    supportsFinalExport: true,
  };

  it("accepts native preview capabilities", () => {
    expect(ProviderCapabilitiesSchema.safeParse(previewCaps).success).toBe(true);
  });

  it("accepts native VPS export capabilities", () => {
    expect(ProviderCapabilitiesSchema.safeParse(nativeVpsCaps).success).toBe(
      true,
    );
  });

  it("rejects empty supportedNodeTypes", () => {
    const bad = { ...previewCaps, supportedNodeTypes: [] };
    expect(ProviderCapabilitiesSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects zero max resolution", () => {
    const bad = {
      ...previewCaps,
      maxResolution: { width: 0, height: 1080 },
    };
    expect(ProviderCapabilitiesSchema.safeParse(bad).success).toBe(false);
  });
});

// ── PreviewFrameRequest ──────────────────────────────────────────────

describe("PreviewFrameRequest", () => {
  it("accepts minimal request", () => {
    const parsed = PreviewFrameRequestSchema.safeParse({
      kind: "preview-frame",
      project: {},
      timeSeconds: 1.5,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.format).toBe("png");
    expect(parsed.data?.quality).toBe(90);
  });

  it("accepts full request with all fields", () => {
    const parsed = PreviewFrameRequestSchema.safeParse({
      kind: "preview-frame",
      project: {},
      timeSeconds: 2.0,
      width: 1080,
      height: 1920,
      format: "jpeg",
      quality: 85,
      providerId: "preview-webgl2",
      background: "#000000",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.format).toBe("jpeg");
  });

  it("rejects negative time", () => {
    const parsed = PreviewFrameRequestSchema.safeParse({
      kind: "preview-frame",
      project: {},
      timeSeconds: -1,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid format", () => {
    const parsed = PreviewFrameRequestSchema.safeParse({
      kind: "preview-frame",
      project: {},
      timeSeconds: 0,
      format: "gif",
    });
    expect(parsed.success).toBe(false);
  });

  it("defaults format to png and quality to 90", () => {
    const parsed = PreviewFrameRequestSchema.parse({
      kind: "preview-frame",
      project: {},
      timeSeconds: 0,
    });
    expect(parsed.format).toBe("png");
    expect(parsed.quality).toBe(90);
  });
});

// ── PreviewContactSheetRequest ───────────────────────────────────────

describe("PreviewContactSheetRequest", () => {
  it("accepts minimal request", () => {
    const parsed = PreviewContactSheetRequestSchema.safeParse({
      kind: "preview-contact-sheet",
      project: {},
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.columns).toBe(5);
    expect(parsed.data?.rows).toBe(4);
    expect(parsed.data?.thumbnailSize).toBe(256);
  });

  it("rejects 0 columns", () => {
    const parsed = PreviewContactSheetRequestSchema.safeParse({
      kind: "preview-contact-sheet",
      project: {},
      columns: 0,
    });
    expect(parsed.success).toBe(false);
  });
});

// ── DraftVideoRequest ────────────────────────────────────────────────

describe("DraftVideoRequest", () => {
  it("accepts minimal request", () => {
    const parsed = DraftVideoRequestSchema.safeParse({
      kind: "draft-video",
      project: {},
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.width).toBe(480);
    expect(parsed.data?.codec).toBe("vp8");
  });

  it("rejects invalid codec", () => {
    const parsed = DraftVideoRequestSchema.safeParse({
      kind: "draft-video",
      project: {},
      codec: "mpeg2",
    });
    expect(parsed.success).toBe(false);
  });
});

// ── FinalRenderRequest ───────────────────────────────────────────────

describe("FinalRenderRequest", () => {
  it("accepts minimal request", () => {
    const parsed = FinalRenderRequestSchema.safeParse({
      kind: "final-render",
      project: {},
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.codec).toBe("h264");
    expect(parsed.data?.pixelFormat).toBe("yuv420p");
    expect(parsed.data?.crf).toBe(23);
    expect(parsed.data?.privacy).toBe("private");
  });

  it("accepts full production request", () => {
    const parsed = FinalRenderRequestSchema.safeParse({
      kind: "final-render",
      project: {},
      width: 1920,
      height: 1080,
      fps: 60,
      startTime: 0,
      endTime: 30,
      codec: "h265",
      pixelFormat: "yuv444p",
      crf: 18,
      privacy: "public",
      providerId: "native-vps-export",
      background: "#000000",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects crf out of range", () => {
    const parsed = FinalRenderRequestSchema.safeParse({
      kind: "final-render",
      project: {},
      crf: 52,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects privacy invalid value", () => {
    const parsed = FinalRenderRequestSchema.safeParse({
      kind: "final-render",
      project: {},
      privacy: "world-readable",
    });
    expect(parsed.success).toBe(false);
  });
});

// ── Type-level: native preview & native VPS as providers ──────────────

describe("Native preview and native VPS described as providers", () => {
  it("Native WebGL2 can be described as a provider", () => {
    const caps = ProviderCapabilitiesSchema.parse({
      providerId: "preview-webgl2",
      displayName: "Native WebGL2 Preview",
      version: "8.0.0",
      backend: "webgl",
      supportedNodeTypes: [
        "group",
        "text",
        "image",
        "shape",
        "path",
        "camera",
        "solid",
      ],
      supportedEffects: ["drop-shadow", "blur"],
      supportedTransitions: ["cut", "fade", "crossfade"],
      maxResolution: { width: 4096, height: 4096 },
      supportsAlpha: true,
      supportsAudio: false,
      supportsFinalExport: false,
    });
    expect(caps.providerId).toBe("preview-webgl2");
    expect(caps.backend).toBe("webgl");
    expect(caps.supportsAlpha).toBe(true);
    expect(caps.supportsFinalExport).toBe(false);
  });

  it("Native VPS can be described as a provider", () => {
    const caps = ProviderCapabilitiesSchema.parse({
      providerId: "native-vps-export",
      displayName: "Native VPS Export",
      version: "4.0.506",
      backend: "server",
      supportedNodeTypes: [
        "group",
        "text",
        "image",
        "video",
        "shape",
        "svg",
        "solid",
      ],
      supportedEffects: [],
      supportedTransitions: [],
      maxResolution: { width: 7680, height: 4320 },
      supportsAlpha: true,
      supportsAudio: true,
      supportsFinalExport: true,
    });
    expect(caps.providerId).toBe("native-vps-export");
    expect(caps.backend).toBe("server");
    expect(caps.supportsAudio).toBe(true);
    expect(caps.supportsFinalExport).toBe(true);
  });

  it("a future WebGPU renderer can implement the same contract", () => {
    const caps = ProviderCapabilitiesSchema.parse({
      providerId: "webgpu-renderer",
      displayName: "WebGPU Renderer",
      version: "0.1.0",
      backend: "webgpu",
      supportedNodeTypes: [
        "group",
        "text",
        "image",
        "video",
        "shape",
        "path",
        "svg",
        "camera",
        "solid",
        "adjustment",
      ],
      supportedEffects: [
        "drop-shadow",
        "blur",
        "tint",
        "color-matrix",
        "displacement",
      ],
      supportedTransitions: ["cut", "fade", "crossfade", "slide", "wipe"],
      maxResolution: { width: 8192, height: 8192 },
      supportsAlpha: true,
      supportsAudio: false,
      supportsFinalExport: true,
    });
    expect(caps.backend).toBe("webgpu");
    expect(caps.supportsFinalExport).toBe(true);
  });
});
