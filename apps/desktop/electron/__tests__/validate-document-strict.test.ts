import { describe, expect, it } from "vitest";
import {
  parseTimelineClipsStrict,
  parseTimelineLanesStrict,
  TimelineParseError,
} from "@motionvideo/editor-core";
import { DesktopIpcErrorCode } from "../../shared/ipc/errors";
import { buildBlankDesktopProject } from "../../shared/project-file/envelope";
import { validateDesktopDocumentJson } from "../../shared/project-file/validate-document";
import { createProjectFileService } from "../main/services/project-file-service";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("strict timeline parse (UI-0)", () => {
  it("rejects garbage clip shapes", () => {
    expect(() => parseTimelineClipsStrict([{ foo: "bar" }])).toThrow(
      TimelineParseError,
    );
  });

  it("rejects missing sceneId instead of inventing from id", () => {
    expect(() =>
      parseTimelineClipsStrict([
        {
          kind: "scene",
          id: "c1",
          name: "Clip",
          laneId: "main",
          startTime: 0,
          duration: 1,
        },
      ]),
    ).toThrow(/sceneId/);
  });

  it("rejects legacy track-only clips", () => {
    expect(() =>
      parseTimelineClipsStrict([
        {
          id: "c1",
          name: "Clip",
          track: "main",
          startTime: 0,
          duration: 1,
          sceneId: "s1",
        },
      ]),
    ).toThrow(/kind|laneId/);
  });

  it("rejects legacy main lane kind", () => {
    expect(() =>
      parseTimelineLanesStrict([
        { id: "l1", kind: "main", name: "Main", order: 0 },
      ]),
    ).toThrow(/visual|audio|legacy/i);
  });

  it("rejects empty id/name and non-integer order", () => {
    expect(() =>
      parseTimelineLanesStrict([
        { id: "", kind: "visual", role: "base", name: "Main", order: 0 },
      ]),
    ).toThrow(/id/);
    expect(() =>
      parseTimelineLanesStrict([
        {
          id: "l1",
          kind: "visual",
          role: "base",
          name: "Main",
          order: 1.5,
        },
      ]),
    ).toThrow(/order/);
  });

  it("rejects wrong-typed optional booleans instead of canonicalizing", () => {
    expect(() =>
      parseTimelineLanesStrict([
        {
          id: "l1",
          kind: "visual",
          role: "base",
          name: "Main",
          order: 0,
          locked: "yes",
        },
      ]),
    ).toThrow(/locked.*boolean/i);
    expect(() =>
      parseTimelineLanesStrict([
        {
          id: "l1",
          kind: "audio",
          role: "audio",
          name: "A",
          order: 1,
          muted: 1,
        },
      ]),
    ).toThrow(/muted.*boolean/i);
  });

  it("does not clamp negative times — rejects them", () => {
    expect(() =>
      parseTimelineClipsStrict([
        {
          kind: "scene",
          id: "c1",
          name: "Clip",
          laneId: "main",
          sceneId: "s1",
          startTime: -1,
          duration: 1,
        },
      ]),
    ).toThrow(/startTime/);
  });

  it("maps garbage clips to CORRUPT_FILE on validate/save", async () => {
    const blank = buildBlankDesktopProject({ createId: (p) => `${p}_badclip` });
    const broken = JSON.parse(blank.documentJson) as {
      timelineClips: unknown[];
    };
    broken.timelineClips = [{ foo: "bar" }];
    const json = `${JSON.stringify(broken)}\n`;

    expect(() => validateDesktopDocumentJson(json)).toThrowError(
      /timelineClips\[0\]/,
    );

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-val-"));
    const filePath = path.join(dir, "demo.mt");
    const service = createProjectFileService();
    await expect(service.saveAtomic(filePath, json)).rejects.toMatchObject({
      code: DesktopIpcErrorCode.CORRUPT_FILE,
    });
  });

  it("accepts blank desktop project", () => {
    const blank = buildBlankDesktopProject({ createId: (p) => `${p}_ok` });
    expect(() => validateDesktopDocumentJson(blank.documentJson)).not.toThrow();
  });
});
