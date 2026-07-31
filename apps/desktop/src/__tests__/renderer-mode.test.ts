import { afterEach, describe, expect, it } from "vitest";
import {
  getRendererMode,
  setPackagedHint,
  useViteProductionBundle,
} from "../shared/renderer-mode";

describe("getRendererMode", () => {
  afterEach(() => {
    delete process.env.MOTIONVIDEO_RENDERER;
    delete process.env.MOTIONVIDEO_VITE_PROD;
    setPackagedHint(false);
  });

  it("defaults to vite when env is unset", () => {
    expect(getRendererMode()).toBe("vite");
  });

  it("honors MOTIONVIDEO_RENDERER=legacy", () => {
    process.env.MOTIONVIDEO_RENDERER = "legacy";
    expect(getRendererMode()).toBe("legacy");
  });

  it("honors MOTIONVIDEO_RENDERER=vite", () => {
    process.env.MOTIONVIDEO_RENDERER = "vite";
    expect(getRendererMode()).toBe("vite");
  });
});

describe("useViteProductionBundle", () => {
  afterEach(() => {
    delete process.env.MOTIONVIDEO_RENDERER;
    delete process.env.MOTIONVIDEO_VITE_PROD;
    setPackagedHint(false);
  });

  it("is true when packaged and mode is vite", () => {
    setPackagedHint(true);
    expect(useViteProductionBundle()).toBe(true);
  });

  it("is true when MOTIONVIDEO_VITE_PROD=1", () => {
    process.env.MOTIONVIDEO_VITE_PROD = "1";
    expect(useViteProductionBundle()).toBe(true);
  });

  it("is false in legacy mode even when packaged", () => {
    process.env.MOTIONVIDEO_RENDERER = "legacy";
    setPackagedHint(true);
    expect(useViteProductionBundle()).toBe(false);
  });
});
