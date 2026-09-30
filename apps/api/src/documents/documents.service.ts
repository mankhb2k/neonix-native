import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { compileDocument, stampNodeIds, type HtmlCompilerOptions } from "@motionvideo/html-compiler";
import { ApiError } from "../common/api-error";
import { HTML_COMPILER_FONT_ASSETS } from "../projects/html-compiler-font-assets";
import { RateLimitService } from "../rate-limit/rate-limit.service";

// Public, unauthenticated HTML-compiler surface for the anonymous HTML
// playground and doc examples - no workspace/project involved, no persistence, just a stateless
// compile/validate pass. Same html-compiler pipeline as the Track A ->
// Track B convert-json bridge in projects.service.ts (stampNodeIds +
// compileDocument + the same static font catalog); the real-browser
// layout-snapshot enhancement is deliberately omitted here too, same as
// there (disabled everywhere in production right now - see project memory).

const MAX_HTML_BYTES = 1_000_000; // 1 MB
const COMPILE_RATE_LIMIT_WINDOW_SECONDS = 60;
const COMPILE_RATE_LIMIT_MAX_REQUESTS = 20;

function assertNonEmptyHtml(html: string): void {
  if (!html.trim()) throw new ApiError(400, "html is required", "INVALID_INPUT");
}

@Injectable()
export class DocumentsService {
  constructor(private readonly rateLimit: RateLimitService) {}

  async compile(clientIp: string, html: string, durationMs: number | undefined) {
    if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
      throw new ApiError(413, `html must not exceed ${MAX_HTML_BYTES} bytes`, "PAYLOAD_TOO_LARGE");
    }
    assertNonEmptyHtml(html);

    const allowed = await this.rateLimit.checkAndIncrement(
      `documents-compile:${clientIp}`,
      COMPILE_RATE_LIMIT_WINDOW_SECONDS,
      COMPILE_RATE_LIMIT_MAX_REQUESTS,
    );
    if (!allowed) {
      throw new ApiError(429, "Too many compile requests. Please wait a moment and try again.", "RATE_LIMITED");
    }

    const options: HtmlCompilerOptions = durationMs !== undefined ? { composition: { durationMs } } : {};
    const result = this.runCompiler(html, options);
    const errors = result.diagnostics.filter((item) => item.severity === "error");
    if (result.status !== "success" || !result.protocol || errors.length > 0) {
      throw new ApiError(422, "HTML document could not be compiled", "COMPILATION_FAILED", result.diagnostics);
    }
    return {
      status: "succeeded" as const,
      protocolVersion: 2,
      composition: result.source.composition,
      protocol: result.protocol,
      diagnostics: result.diagnostics,
    };
  }

  validate(html: string) {
    assertNonEmptyHtml(html);
    const result = this.runCompiler(html, {});
    const errors = result.diagnostics.filter((item) => item.severity === "error");
    return {
      valid: result.status === "success" && errors.length === 0,
      documentHash: createHash("sha256").update(html, "utf8").digest("hex"),
      composition: result.source.composition,
      diagnostics: result.diagnostics,
      stats: { layerCount: result.protocol?.layers.length ?? 0 },
    };
  }

  private runCompiler(html: string, options: HtmlCompilerOptions) {
    return compileDocument(
      { html: stampNodeIds(html), fontAssets: HTML_COMPILER_FONT_ASSETS },
      options,
    );
  }
}
