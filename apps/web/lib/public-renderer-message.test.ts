import { describe, expect, it } from "vitest";
import { publicRendererMessage } from "./public-renderer-message";

describe("publicRendererMessage", () => {
  it("replaces internal renderer codenames with public-facing terms", () => {
    expect(publicRendererMessage("CanvasKit failed to load Skia WASM binary")).toBe(
      "preview renderer failed to load native renderer browser runtime binary",
    );
  });

  it("strips stack trace frames and Node's uncaught-exception version banner", () => {
    const crash = [
      "Error: write EPIPE",
      "    at afterWriteDispatched (node:internal/stream_base_commons:160:15)",
      "    at writeGeneric (node:internal/stream_base_commons:151:3)",
      "",
      "Node.js v22.23.3",
    ].join("\n");
    const sanitized = publicRendererMessage(crash);
    expect(sanitized).toBe("Error: write EPIPE");
    expect(sanitized).not.toContain("v22.23.3");
    expect(sanitized).not.toContain("node:internal");
  });

  it("redacts absolute filesystem paths embedded in a message", () => {
    expect(publicRendererMessage("Cannot find module D:\\NextJS\\neonix\\packages\\render-native\\src\\render-job.ts"))
      .toBe("Cannot find module <path>");
    expect(publicRendererMessage("open /app/dist/render-job.js: no such file or directory"))
      .toBe("open <path>: no such file or directory");
  });
});
