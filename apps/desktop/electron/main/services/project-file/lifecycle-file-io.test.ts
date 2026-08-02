/**
 * Logic-5 / P1 — real project-file-service open → edit → save → reopen.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createProjectFileService } from "./project-file.service";
import {
  buildBlankDesktopProject,
  EDITOR_PROJECT_FORMAT,
  parseDesktopProjectFile,
} from "../../../../shared/project-file/envelope";

describe("lifecycle file IO (Logic-5)", () => {
  it("saveAtomic + openPath round-trip with motion-editor-project envelope", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-life-io-"));
    const filePath = path.join(dir, "demo.mt");
    const blank = buildBlankDesktopProject({ name: "Life" });
    expect(JSON.parse(blank.documentJson).format).toBe(EDITOR_PROJECT_FORMAT);

    const service = createProjectFileService();
    await service.saveAtomic(filePath, blank.documentJson);

    const opened = service.openPath(filePath);
    expect(opened.projectId).toBe(blank.projectId);

    const envelope = parseDesktopProjectFile(opened.documentJson);
    envelope.project.metadata.name = "Edited";
    const { serializeDesktopProjectEnvelope } = await import(
      "../../../../shared/project-file/envelope"
    );
    const editedJson = serializeDesktopProjectEnvelope(envelope);
    await service.saveAtomic(filePath, editedJson);

    const reopened = service.openPath(filePath);
    expect(parseDesktopProjectFile(reopened.documentJson).project.metadata.name).toBe(
      "Edited",
    );
    expect(fs.existsSync(`${filePath}.bak`)).toBe(true);
  });
});
