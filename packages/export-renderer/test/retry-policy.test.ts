import { describe, expect, it } from "vitest";
import { errorCode, isPermanentRenderError, isRetryableRenderError } from "../src/retry-policy";

describe("render retry policy", () => {
  it("stops permanent integrity and ownership failures", () => {
    expect(errorCode("RUNTIME_CHECKSUM_MISMATCH: abc/def")).toBe("RUNTIME_CHECKSUM_MISMATCH");
    expect(isPermanentRenderError("RUNTIME_CHECKSUM_MISMATCH: abc/def")).toBe(true);
    expect(isRetryableRenderError("RUNTIME_CHECKSUM_MISMATCH: abc/def")).toBe(false);
    expect(isRetryableRenderError("R2_SOURCE_NOT_FOUND: missing")).toBe(false);
  });

  it("allows bounded retry for transient worker failures", () => {
    expect(isPermanentRenderError("FFMPEG_FAILED: process exited")).toBe(false);
    expect(isRetryableRenderError("FFMPEG_FAILED: process exited")).toBe(true);
    expect(isRetryableRenderError("WORKER_SIGTERM: render interrupted")).toBe(true);
    expect(isRetryableRenderError("CHECKSUM_MISMATCH: size differs")).toBe(true);
  });
});
