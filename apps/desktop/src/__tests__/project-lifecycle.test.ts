import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createProjectFileService } from "../main/services/project-file-service";
import { createRecentProjectService } from "../main/services/recent-project-service";
import { DesktopIpcError, DesktopIpcErrorCode } from "../shared/ipc/errors";
import {
  buildBlankDesktopProject,
  EDITOR_ENVELOPE_VERSION,
  EDITOR_PROJECT_FORMAT,
  parseDesktopProjectFile,
  ProjectFileParseError,
  serializeDesktopProjectEnvelope,
} from "../shared/project-file/envelope";

describe("parseDesktopProjectFile", () => {
  it("parses a blank envelope", () => {
    const { documentJson, projectId } = buildBlankDesktopProject({
      name: "Demo",
      createId: (p) => `${p}_fixed`,
    });
    const envelope = parseDesktopProjectFile(documentJson);
    expect(envelope.format).toBe(EDITOR_PROJECT_FORMAT);
    expect(envelope.formatVersion).toBe(EDITOR_ENVELOPE_VERSION);
    expect(envelope.project.metadata.id).toBe(projectId);
    expect(envelope.project.metadata.name).toBe("Demo");
  });

  it("rejects corrupt JSON", () => {
    expect(() => parseDesktopProjectFile("{nope")).toThrow(ProjectFileParseError);
    try {
      parseDesktopProjectFile("{nope");
    } catch (error) {
      expect(error).toMatchObject({ code: "CORRUPT_FILE" });
    }
  });

  it("rejects wrong format", () => {
    expect(() =>
      parseDesktopProjectFile(
        JSON.stringify({ format: "other", formatVersion: 1, project: {} }),
      ),
    ).toThrow(/Expected format/);
  });

  it("rejects unsupported formatVersion", () => {
    const blank = buildBlankDesktopProject();
    const raw = JSON.parse(blank.documentJson) as Record<string, unknown>;
    raw.formatVersion = EDITOR_ENVELOPE_VERSION + 5;
    try {
      parseDesktopProjectFile(JSON.stringify(raw));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectFileParseError);
      expect((error as ProjectFileParseError).code).toBe("UNSUPPORTED_VERSION");
    }
  });
});

describe("project-file-service atomic save", () => {
  it("writes via temp rename and keeps original on rename failure", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-project-"));
    const filePath = path.join(dir, "demo.mt");
    const { documentJson } = buildBlankDesktopProject({ name: "Original" });
    fs.writeFileSync(filePath, documentJson);

    const original = fs.readFileSync(filePath, "utf8");
    const next = buildBlankDesktopProject({ name: "Updated" }).documentJson;

    const service = createProjectFileService({
      beforeRename: () => {
        throw new Error("simulated rename failure");
      },
    });

    await expect(service.saveAtomic(filePath, next)).rejects.toBeInstanceOf(
      DesktopIpcError,
    );
    try {
      await service.saveAtomic(filePath, next);
    } catch (error) {
      expect(error).toBeInstanceOf(DesktopIpcError);
      expect((error as DesktopIpcError).code).toBe(
        DesktopIpcErrorCode.SAVE_FAILED,
      );
    }

    expect(fs.readFileSync(filePath, "utf8")).toBe(original);
  });

  it("creates .bak and can reopen after successful overwrite", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-project-"));
    const filePath = path.join(dir, "demo.mt");
    const first = buildBlankDesktopProject({ name: "V1" });
    fs.writeFileSync(filePath, first.documentJson);

    const second = buildBlankDesktopProject({ name: "V2" });
    const service = createProjectFileService();
    await service.saveAtomic(filePath, second.documentJson);

    expect(fs.existsSync(`${filePath}.bak`)).toBe(true);
    const bak = parseDesktopProjectFile(fs.readFileSync(`${filePath}.bak`, "utf8"));
    expect(bak.project.metadata.name).toBe("V1");

    const reopened = service.openPath(filePath);
    expect(parseDesktopProjectFile(reopened.documentJson).project.metadata.name).toBe(
      "V2",
    );
  });

  it("rejects save when MotionProject body is invalid", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-project-"));
    const filePath = path.join(dir, "demo.mt");
    const blank = buildBlankDesktopProject({ name: "Bad" });
    const broken = JSON.parse(blank.documentJson) as {
      project: { format: string };
    };
    broken.project.format = "not-a-motion-project";
    const service = createProjectFileService();
    await expect(
      service.saveAtomic(filePath, `${JSON.stringify(broken)}\n`),
    ).rejects.toMatchObject({ code: DesktopIpcErrorCode.CORRUPT_FILE });
  });

  it("maps corrupt file on openPath", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-project-"));
    const filePath = path.join(dir, "bad.mt");
    fs.writeFileSync(filePath, "{not-an-envelope}");
    const service = createProjectFileService();
    try {
      service.openPath(filePath);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DesktopIpcError);
      expect((error as DesktopIpcError).code).toBe(
        DesktopIpcErrorCode.CORRUPT_FILE,
      );
    }
  });
});

describe("recent-project-service", () => {
  it("touches and orders recent entries", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-recent-"));
    const recent = createRecentProjectService({
      userDataPath: dir,
      pruneMissing: false,
    });

    recent.touch({
      id: "a",
      name: "A",
      path: "/tmp/a.mt",
      openedAt: "2020-01-01T00:00:00.000Z",
    });
    recent.touch({
      id: "b",
      name: "B",
      path: "/tmp/b.mt",
      openedAt: "2020-01-02T00:00:00.000Z",
    });
    recent.touch({
      id: "a",
      name: "A2",
      path: "/tmp/a.mt",
      openedAt: "2020-01-03T00:00:00.000Z",
    });

    const list = recent.list();
    expect(list[0]?.id).toBe("a");
    expect(list[0]?.name).toBe("A2");
    expect(list[1]?.id).toBe("b");
  });
});

describe("serialize round-trip", () => {
  it("keeps envelope stable", () => {
    const { envelope } = buildBlankDesktopProject({ createId: (p) => `${p}_x` });
    const again = parseDesktopProjectFile(
      serializeDesktopProjectEnvelope(envelope),
    );
    expect(again.project.metadata.id).toBe(envelope.project.metadata.id);
  });
});
