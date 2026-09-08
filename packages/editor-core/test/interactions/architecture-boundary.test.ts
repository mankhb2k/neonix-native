import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function sourceFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) files.push(path);
    }
  };
  visit(root);
  return files;
}

function sourceText(root: string): string {
  return sourceFiles(root).map((path) => readFileSync(path, "utf8")).join("\n");
}

describe("package architecture boundaries", () => {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const editorSource = join(packageRoot, "packages/editor-core/src");
  const playbackSource = join(packageRoot, "packages/playback-engine/src");

  it("keeps editor-core independent from playback", () => {
    expect(sourceText(editorSource)).not.toMatch(/@motionvideo\/playback-engine|playback-engine/);
  });

  it("keeps editor-core independent from runtime compilation and evaluation", () => {
    const text = sourceText(editorSource);
    expect(text).not.toMatch(/@motionvideo\/motion-compiler|@motionvideo\/motion-runtime/);
  });

  it("keeps playback-engine independent from editor and UI packages", () => {
    const text = sourceText(playbackSource);
    expect(text).not.toMatch(/@motionvideo\/editor-core|@motionvideo\/motion-protocol/);
    expect(text).not.toMatch(/from ["'](?:react|react-dom|zustand|next)(?:\/|["'])/);
  });
});
