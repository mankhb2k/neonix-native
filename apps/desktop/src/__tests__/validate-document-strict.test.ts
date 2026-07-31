import { describe, expect, it } from "vitest";
import {
  parseTimelineClipsStrict,
  TimelineParseError,
} from "@motionvideo/editor-core";
import { DesktopIpcErrorCode } from "../shared/ipc/errors";
import { buildBlankDesktopProject } from "../shared/project-file/envelope";
import { validateDesktopDocumentJson } from "../shared/project-file/validate-document";
import { createProjectFileService } from "../main/services/project-file-service";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("strict timeline parse (Wave 3)", () => {
  it("rejects garbage clip shapes", () => {
    expect(() => parseTimelineClipsStrict([{ foo: "bar" }])).toThrow(
      TimelineParseError,
    );
  });

  it("maps garbage clips to CORRUPT_FILE on validate/save", async () => {
    const blank = buildBlankDesktopProject({ createId: (p) => `${p}_badclip` });
    const broken = JSON.parse(blank.documentJson) as {
      timelineClips: unknown[];
    };
    broken.timelineClips = [{ foo: "bar" }];
    const json = `${JSON.stringify(broken)}\n`;

    expect(() => validateDesktopDocumentJson(json)).toThrowError(
      /timelineClips\[0\]|not a valid TimelineClip/,
    );

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-val-"));
    const filePath = path.join(dir, "demo.mt");
    const service = createProjectFileService();
    await expect(service.saveAtomic(filePath, json)).rejects.toMatchObject({
      code: DesktopIpcErrorCode.CORRUPT_FILE,
    });
  });
});
