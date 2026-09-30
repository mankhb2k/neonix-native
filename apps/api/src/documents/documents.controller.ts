import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { HTML_TAG_PROFILE, SUPPORTED_PROPERTIES } from "@motionvideo/html-compiler";
import type { Request } from "express";
import { CompileDocumentDto } from "./dto/compile-document.dto";
import { ValidateDocumentDto } from "./dto/validate-document.dto";
import { DocumentsService } from "./documents.service";

/**
 * Best-effort client IP for rate-limiting public, unauthenticated endpoints.
 * Not meant to be spoof-proof (a caller can forge these headers when there
 * is no trusted reverse proxy in front of the app) - it only needs to make
 * casual abuse from a single source expensive to work around, not resist a
 * determined attacker. Kept local to the API boundary.
 */
function clientIpForRateLimit(req: Request): string {
  const forwardedFor = req.headers["x-forwarded-for"];
  const forwarded = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers["x-real-ip"];
  const real = Array.isArray(realIp) ? realIp[0] : realIp;
  if (real?.trim()) return real.trim();
  return req.ip ?? "unknown";
}

@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  // Public and unauthenticated (the anonymous HTML playground) - abuse
  // control is the per-IP rate limit inside DocumentsService, not any
  // account/workspace quota.
  @Post("v1/documents/compile")
  async compile(@Req() req: Request, @Body() dto: CompileDocumentDto) {
    return this.documents.compile(clientIpForRateLimit(req), dto.html, dto.durationMs);
  }

  @Post("v1/documents/validate")
  async validate(@Body() dto: ValidateDocumentDto) {
    return this.documents.validate(dto.html);
  }

  @Get("v1/capabilities")
  capabilities() {
    return {
      apiVersion: 1,
      document: {
        kind: "neonix-html-document",
        schemaVersion: 2,
        metadata: 'meta[name="neonix-document"]',
      },
      htmlTags: Object.fromEntries(
        Object.entries(HTML_TAG_PROFILE).map(([group, tags]) => [group, [...tags].sort()]),
      ),
      cssProperties: [...SUPPORTED_PROPERTIES].sort(),
      protocolVersion: 2,
    };
  }
}
