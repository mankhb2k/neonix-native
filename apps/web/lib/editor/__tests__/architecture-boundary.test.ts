import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)
      ? [path]
      : [];
  });
}

function sourceFor(directory: string): string {
  return sourceFiles(join(WEB_ROOT, directory))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
}

function importStatements(source: string): string[] {
  const lines = source.split(/\r?\n/);
  const statements: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^\s*import\s/.test(lines[index] ?? "")) continue;
    let statement = lines[index] ?? "";
    while (!statement.includes(";") && index + 1 < lines.length) {
      index += 1;
      statement += `\n${lines[index]}`;
    }
    statements.push(statement);
  }
  return statements;
}

describe("web editor architecture boundary", () => {
  it("keeps compiler, playback and renderer imports out of UI and browser hooks", () => {
    const source = [
      sourceFor("components/editor"),
      sourceFor("hooks/editor"),
    ].join("\n");

    expect(source).not.toMatch(/@motionvideo\/(motion-compiler|playback-engine|canvaskit-preview)/);
    expect(source).not.toMatch(/@motionvideo\/editor-runtime/);
    expect(source).not.toMatch(/\bevaluateRuntimeProjectV3\b/);
    expect(source).not.toMatch(/\bcompileProtocolAtTime\b/);
    expect(source).not.toMatch(/\bcompileProtocol\s*\(/);
  });

  it("allows runtime types in the UI while keeping runtime execution in adapters", () => {
    const source = sourceFor("components/editor");
    const valueImports = importStatements(source).filter(
      (statement) =>
        !/^\s*import\s+type\b/.test(statement) &&
        statement.includes("@motionvideo/motion-runtime"),
    );

    expect(valueImports).toEqual([]);
  });

  it("keeps stage overlay runtime queries behind the named stage adapter", () => {
    const overlay = readFileSync(
      join(WEB_ROOT, "components/editor/stage/tools/transform/TransformTool.tsx"),
      "utf8",
    );
    const stageAdapter = readFileSync(
      join(WEB_ROOT, "lib/editor/stage/runtime-query.ts"),
      "utf8",
    );

    expect(overlay).not.toMatch(/@motionvideo\/editor-runtime/);
    expect(overlay).not.toMatch(/\bsampleEditorLayerAtTime\b/);
    expect(overlay).not.toMatch(/\bRuntimeFrameV3\b|\bpaintFrame\b|\bmatrix4\b/);
    expect(overlay).not.toMatch(/\bbuildPlayheadTransformPatch(?:es)?\b/);
    expect(overlay).not.toMatch(/useStagePreviewOverrides|\.setPreview\s*\(/);
    expect(stageAdapter).toContain("sampleEditorLayerAtTime");
  });

  it("keeps the editor stage frame path delegated to playback", () => {
    const renderer = readFileSync(
      join(WEB_ROOT, "components/editor/stage/StageRenderer.tsx"),
      "utf8",
    );
    const overlayStore = readFileSync(
      join(WEB_ROOT, "lib/store/stage-interaction-store.ts"),
      "utf8",
    );

    expect(renderer).toContain("externalPlayback");
    expect(renderer).toContain("registerPlaybackFrameSink");
    expect(overlayStore).not.toMatch(/RuntimeFrameV3|matrix4|paintFrame/);
  });

  it("keeps runtime execution inside named browser adapters", () => {
    const source = sourceFiles("lib/editor")
      .filter((path) => !/\.test\.(ts|tsx)$/.test(path))
      .filter((path) => !path.includes("\\playback\\") && !path.includes("/playback/"))
      .filter((path) => !path.endsWith("\\text\\measurement.ts") && !path.endsWith("/text/measurement.ts"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(source).not.toMatch(/\bcompileProtocol\s*\(/);
    expect(source).not.toMatch(/\bcompileProtocolAtTime\s*\(/);
    expect(source).not.toMatch(/\bevaluateRuntimeProjectV3\s*\(/);
    expect(source).not.toMatch(/\bcreatePlaybackEngine\s*\(/);
  });

  it("uses playback duration as the transport duration source", () => {
    const timelineShell = readFileSync(
      join(WEB_ROOT, "components/editor/timeline/TimelineShell.tsx"),
      "utf8",
    );
    expect(timelineShell).toContain("useTimelinePlaybackPort");
    expect(timelineShell).not.toContain("useTransportStore");
    expect(timelineShell).not.toContain("projection.contentEnd");
  });

  it("keeps global editor shortcuts out of timeline actions", () => {
    const timelineActions = readFileSync(
      join(WEB_ROOT, "hooks/editor/timeline/use-timeline-actions.ts"),
      "utf8",
    );
    const keyboardBridge = readFileSync(
      join(WEB_ROOT, "hooks/editor/use-editor-keyboard-bridge.ts"),
      "utf8",
    );

    expect(timelineActions).not.toContain("addEventListener(\"keydown\"");
    expect(keyboardBridge).toContain("editorIntentFromShortcut");
    expect(keyboardBridge).toContain("resolveEditorIntent");
  });
});
