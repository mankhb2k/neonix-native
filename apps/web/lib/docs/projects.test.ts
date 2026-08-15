import { describe, expect, it } from "vitest";
import { compileMotionProject } from "@motionvideo/motion-compiler";
import { parseMotionProjectV1 } from "@motionvideo/motion-protocol";
import { attemptParse } from "./parse-result";
import {
  AUDIO_FADE,
  DEPTH_DEMO,
  INVALID_DUPLICATE_ID,
  INVALID_EXTRA_KEY,
  INVALID_FORMAT_VERSION,
  INVALID_MISSING_REF,
  INVALID_TRANSFORM_Z,
  MINIMAL_EMPTY,
  SINGLE_ROOT,
} from "./projects";

describe("docs fixtures", () => {
  it("accepts authored examples", () => {
    expect(attemptParse(MINIMAL_EMPTY).ok).toBe(true);
    expect(attemptParse(SINGLE_ROOT).ok).toBe(true);
    expect(attemptParse(DEPTH_DEMO).ok).toBe(true);
    expect(attemptParse(AUDIO_FADE).ok).toBe(true);
  });

  it("rejects invalid examples", () => {
    expect(attemptParse(INVALID_TRANSFORM_Z).ok).toBe(false);
    expect(attemptParse(INVALID_MISSING_REF).ok).toBe(false);
    expect(attemptParse(INVALID_FORMAT_VERSION).ok).toBe(false);
    expect(attemptParse(INVALID_EXTRA_KEY).ok).toBe(false);
    expect(attemptParse(INVALID_DUPLICATE_ID).ok).toBe(false);
  });

  it("compiles visual examples to runtime IR", () => {
    expect(() => compileMotionProject(parseMotionProjectV1(SINGLE_ROOT))).not.toThrow();
    expect(() => compileMotionProject(parseMotionProjectV1(DEPTH_DEMO))).not.toThrow();
    expect(() => compileMotionProject(parseMotionProjectV1(AUDIO_FADE))).not.toThrow();
  });
});
