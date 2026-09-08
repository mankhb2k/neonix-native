import { describe, expect, it } from "vitest";
import { requestMediaElementPlayV3 } from "../../src/core/media-element-playback";

describe("media-element playback adapter", () => {
  it("contains rejected browser play promises and reports them at the adapter boundary", async () => {
    const failures: unknown[] = [];
    requestMediaElementPlayV3(
      { play: () => Promise.reject(new DOMException("superseded", "AbortError")) },
      "video",
      (failure) => failures.push(failure),
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ backend: "video", reason: { name: "AbortError" } });
  });

  it("also contains synchronous browser adapter failures", () => {
    const failures: unknown[] = [];
    requestMediaElementPlayV3(
      { play: () => { throw new Error("media detached"); } },
      "audio",
      (failure) => failures.push(failure),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ backend: "audio" });
  });
});
