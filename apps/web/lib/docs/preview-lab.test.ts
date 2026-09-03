import { describe, expect, it } from "vitest";
import { compileProtocolToPaintCommands } from "@motionvideo/motion-compiler";
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
import {
  PREVIEW_LAB_CASES,
  PREVIEW_LAB_DEFAULT_CASE,
  previewLabCaseById,
  previewLabGroups,
} from "./preview-lab";

describe("Protocol V2 preview lab fixtures", () => {
  it("exposes a unique current fixture set with a valid default", () => {
    const ids = PREVIEW_LAB_CASES.map((item) => item.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(PREVIEW_LAB_DEFAULT_CASE);
    expect(previewLabCaseById(null).id).toBe(PREVIEW_LAB_DEFAULT_CASE);
    expect(previewLabCaseById("does-not-exist").id).toBe(PREVIEW_LAB_DEFAULT_CASE);
  });

  it("parses and compiles every current Protocol V2 fixture", () => {
    for (const fixture of PREVIEW_LAB_CASES) {
      const project = MotionProtocolV2Schema.parse(fixture.project);
      const buffer = compileProtocolToPaintCommands(project, {
        time: fixture.previewTime ?? 0,
      });
      expect(buffer.commands[0]?.op, fixture.id).toBe("beginFrame");
      expect(buffer.commands.at(-1)?.op, fixture.id).toBe("endFrame");
    }
  });

  it("keeps current clip, mask, group, effect, media, and audio fixtures addressable", () => {
    for (const id of [
      "clip.svg.user-space",
      "mask.svg.alpha",
      "clip-mask.svg.combined",
      "group.isolation.nested",
      "effect.blur",
      "image.preserve-aspect-ratio.meet",
      "video.frame-seek",
      "audio.mix.video-plus-music",
    ]) {
      expect(previewLabCaseById(id).id).toBe(id);
    }
  });

  it("keeps HTML compiler previews on Protocol V2", () => {
    const compilerFixtures = PREVIEW_LAB_CASES.filter((item) => item.id.startsWith("html-compiler."));
    expect(compilerFixtures.length).toBeGreaterThan(0);
    expect(compilerFixtures.every((fixture) => fixture.project.formatVersion === 2)).toBe(true);
    expect(compilerFixtures.every((fixture) => fixture.htmlCssSource?.html && fixture.htmlCssSource.css)).toBe(true);
  });

  it("organizes current fixtures by render concept", () => {
    const groups = previewLabGroups();
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((group) => group.cases.length > 0)).toBe(true);
    expect(groups.every((group) => !group.label.toLowerCase().includes("task"))).toBe(true);
  });

  it("keeps local preview assets under the preview public root", () => {
    const localUris = PREVIEW_LAB_CASES
      .flatMap((item) => item.project.assets)
      .map((asset) => asset.uri)
      .filter((uri) => uri.startsWith("/") && !uri.startsWith("/api/"));

    expect(localUris.length).toBeGreaterThan(0);
    expect(localUris.every((uri) => uri.startsWith("/preview/"))).toBe(true);
  });
});
