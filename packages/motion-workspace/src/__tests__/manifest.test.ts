/**
 * Phase 10 — MotionWorkspace manifest + linker tests.
 */
import { describe, expect, it } from "vitest";
import {
  MotionWorkspaceManifestSchema,
  linkMotionWorkspace,
  MemoryWorkspaceReader,
  type MotionWorkspaceManifest,
} from "../index";

const minimalManifest: MotionWorkspaceManifest = {
  format: "motion-workspace",
  formatVersion: 1,
  metadata: {
    id: "ws.test",
    name: "Test Workspace",
  },
  composition: {
    width: 1920,
    height: 1080,
    fps: 30,
    background: "#0b1220",
  },
  sceneModules: ["intro"],
};

describe("MotionWorkspace manifest", () => {
  it("parses a minimal manifest", () => {
    const parsed = MotionWorkspaceManifestSchema.parse(minimalManifest);
    expect(parsed.formatVersion).toBe(1);
    expect(parsed.sceneModules).toEqual(["intro"]);
  });

  it("rejects missing required fields", () => {
    expect(() =>
      MotionWorkspaceManifestSchema.parse({ format: "motion-workspace" }),
    ).toThrow();
  });

  it("rejects empty sceneModules", () => {
    expect(() =>
      MotionWorkspaceManifestSchema.parse({
        ...minimalManifest,
        sceneModules: [],
      }),
    ).toThrow();
  });

  it("defaults profile to embedded-components", () => {
    const parsed = MotionWorkspaceManifestSchema.parse(minimalManifest);
    expect(parsed.profile).toBe("embedded-components");
  });
});

describe("MemoryWorkspaceReader", () => {
  it("reads a manifest", async () => {
    const reader = new MemoryWorkspaceReader(minimalManifest);
    const manifest = await reader.readManifest();
    expect(manifest.metadata.name).toBe("Test Workspace");
  });

  it("reads added modules", async () => {
    const reader = new MemoryWorkspaceReader(minimalManifest);
    reader.addModule({
      name: "intro",
      module: "scene",
      content: JSON.stringify({
        name: "Intro",
        duration: 5,
        nodes: [
          {
            id: "title",
            type: "text",
            parentId: null,
            transform: { x: 960, y: 540, width: 800, height: 160 },
            payload: {
              content: { kind: "plain", text: "Hello" },
              fontSize: 48,
              color: "#ffffff",
              alignment: "center",
            },
          },
        ],
        clips: [],
      }),
    });

    const mod = await reader.readModule("intro", "scene");
    expect(mod.name).toBe("intro");
    expect(mod.module).toBe("scene");
  });

  it("throws for missing module", async () => {
    const reader = new MemoryWorkspaceReader(minimalManifest);
    await expect(reader.readModule("missing", "scene")).rejects.toThrow();
  });
});

describe("linkMotionWorkspace", () => {
  it("links a single-scene workspace into a valid MotionProject", async () => {
    const reader = new MemoryWorkspaceReader(minimalManifest);
    reader.addModule({
      name: "intro",
      module: "scene",
      content: JSON.stringify({
        duration: 5,
        nodes: [
          {
            id: "title",
            type: "text",
            parentId: null,
            transform: { x: 960, y: 540, width: 800, height: 160 },
            payload: {
              content: { kind: "plain", text: "Hello World" },
              fontSize: 64,
              color: "#ffffff",
              alignment: "center",
            },
          },
        ],
        clips: [],
      }),
    });

    const result = await linkMotionWorkspace(reader);
    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.error(
        "Link diagnostics:",
        JSON.stringify(result.diagnostics, null, 2),
      );
    }
    expect(result.ok).toBe(true);
    expect(result.project?.scenes).toHaveLength(1);
    expect(result.project?.scenes[0]?.id).toBe("workspace.intro");
    expect(result.project?.scenes[0]?.nodes).toHaveLength(1);
    expect(result.project?.scenes[0]?.nodes[0]?.type).toBe("text");
  });

  it("fails on missing scene module", async () => {
    const reader = new MemoryWorkspaceReader(minimalManifest);
    // Don't add the "intro" module
    const result = await linkMotionWorkspace(reader);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "scene_load")).toBe(true);
  });

  it("rejects absolute paths in asset declarations", async () => {
    const reader = new MemoryWorkspaceReader({
      ...minimalManifest,
      assets: [{ id: "logo", type: "image", path: "C:\\Users\\logo.png" }],
    });
    reader.addModule({
      name: "intro",
      module: "scene",
      content: JSON.stringify({ duration: 3, nodes: [], clips: [] }),
    });

    const result = await linkMotionWorkspace(reader);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "absolute_path")).toBe(
      true,
    );
  });

  it("merges tokens from manifest", async () => {
    const reader = new MemoryWorkspaceReader({
      ...minimalManifest,
      tokens: {
        colors: { brand: "#ff0000", accent: "#00ff00" },
        fonts: { display: "Inter" },
      },
    });
    reader.addModule({
      name: "intro",
      module: "scene",
      content: JSON.stringify({ duration: 3, nodes: [], clips: [] }),
    });

    const result = await linkMotionWorkspace(reader);
    expect(result.ok).toBe(true);
  });

  it("supports multi-scene workspace", async () => {
    const reader = new MemoryWorkspaceReader({
      ...minimalManifest,
      sceneModules: ["intro", "body", "outro"],
    });
    for (const name of ["intro", "body", "outro"]) {
      reader.addModule({
        name,
        module: "scene",
        content: JSON.stringify({ duration: 2, nodes: [], clips: [] }),
      });
    }

    const result = await linkMotionWorkspace(reader);
    expect(result.ok).toBe(true);
    expect(result.project?.scenes).toHaveLength(3);
  });
});
