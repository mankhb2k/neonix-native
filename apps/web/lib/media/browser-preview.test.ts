import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserVideoPreview } from "./browser-preview";

describe("createBrowserVideoPreview", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("decodes one frame and always revokes the source object URL", async () => {
    const objectUrl = "blob:neonix-test";
    const revokeObjectUrl = vi.fn();
    const drawImage = vi.fn();
    const poster = new Blob(["poster"], { type: "image/webp" });
    const video = new EventTarget() as EventTarget & Record<string, unknown>;
    Object.assign(video, {
      preload: "",
      muted: false,
      playsInline: false,
      src: "",
      duration: 12.34,
      videoWidth: 1920,
      videoHeight: 1080,
      readyState: 4,
      currentTime: 0,
      load: () => {
        queueMicrotask(() => {
          video.dispatchEvent(new Event("loadedmetadata"));
        });
      },
      removeAttribute: vi.fn(),
    });
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toBlob: (callback: BlobCallback) => callback(poster),
    } as unknown as HTMLCanvasElement;

    vi.spyOn(URL, "createObjectURL").mockReturnValue(objectUrl);
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(revokeObjectUrl);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "video") return video as unknown as HTMLVideoElement;
      if (tagName === "canvas") return canvas;
      return document.createElementNS("http://www.w3.org/1999/xhtml", tagName);
    });

    const result = await createBrowserVideoPreview(new File(["video"], "clip.mp4", { type: "video/mp4" }));

    expect(result.poster).toBe(poster);
    expect(result.durationMs).toBe(12340);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(drawImage).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith(objectUrl);
  });
});
