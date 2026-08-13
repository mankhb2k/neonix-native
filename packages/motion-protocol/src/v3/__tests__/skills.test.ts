import { describe, expect, it } from "vitest";
import {
  MotionSkillManifestSchema,
  validateSkillManifest,
  validateMotionSkillOutput,
  getBuiltinSkill,
  BUILTIN_SKILLS,
  type MotionSkillManifest,
} from "../skills";
import type { MotionProjectV3 } from "../index";

describe("V3 Skill contract", () => {
  // ── Schema parsing ──────────────────────────────────────────────────

  it("parses a valid skill manifest", () => {
    const manifest = MotionSkillManifestSchema.parse({
      id: "test/my-skill",
      name: "My Skill",
      description: "A test skill",
      version: "1.0.0",
      author: { name: "Test Author" },
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string" },
        },
      },
      outputContract: { kind: "full-project" },
    });
    expect(manifest.id).toBe("test/my-skill");
    expect(manifest.requiredCapabilities).toEqual([]);
    expect(manifest.tags).toEqual([]);
  });

  it("parses with all optional fields", () => {
    const manifest = MotionSkillManifestSchema.parse({
      id: "motion/pro",
      name: "Pro",
      description: "Advanced skill with all fields",
      version: "2.1.0-beta.1",
      author: { name: "Author", url: "https://example.com" },
      requiredCapabilities: ["primitive.text", "anim.opacity"],
      inputSchema: {
        type: "object",
        required: ["x"],
        properties: { x: { type: "number" } },
      },
      outputContract: { kind: "patch", description: "Produces a patch" },
      tags: ["pro", "premium"],
      thumbnailUrl: "https://example.com/thumb.png",
    });
    expect(manifest.requiredCapabilities).toHaveLength(2);
    expect(manifest.tags).toEqual(["pro", "premium"]);
    expect(manifest.outputContract.kind).toBe("patch");
  });

  it("rejects malformed skill id (no namespace)", () => {
    const result = MotionSkillManifestSchema.safeParse({
      id: "no-namespace",
      name: "Bad",
      description: "Missing namespace",
      version: "1.0.0",
      author: { name: "A" },
      inputSchema: { type: "object" },
      outputContract: { kind: "full-project" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = MotionSkillManifestSchema.safeParse({
      id: "test/skill",
      name: "",
      description: "Empty name",
      version: "1.0.0",
      author: { name: "A" },
      inputSchema: { type: "object" },
      outputContract: { kind: "full-project" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid version", () => {
    const result = MotionSkillManifestSchema.safeParse({
      id: "test/skill",
      name: "Test",
      description: "Bad version",
      version: "not-semver",
      author: { name: "A" },
      inputSchema: { type: "object" },
      outputContract: { kind: "full-project" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown output contract kind", () => {
    const result = MotionSkillManifestSchema.safeParse({
      id: "test/skill",
      name: "Test",
      description: "Bad output",
      version: "1.0.0",
      author: { name: "A" },
      inputSchema: { type: "object" },
      outputContract: { kind: "video-file" as any },
    });
    expect(result.success).toBe(false);
  });

  // ── Built-in skills ─────────────────────────────────────────────────

  it("has 5 built-in skills", () => {
    expect(BUILTIN_SKILLS).toHaveLength(5);
  });

  it("all built-in skills parse correctly", () => {
    for (const skill of BUILTIN_SKILLS) {
      const result = MotionSkillManifestSchema.safeParse(skill);
      expect(result.success).toBe(true);
    }
  });

  it("getBuiltinSkill returns the correct skill", () => {
    const skill = getBuiltinSkill("motion/brand-intro");
    expect(skill).toBeDefined();
    expect(skill!.name).toBe("Brand Intro");
  });

  it("getBuiltinSkill returns undefined for unknown skill", () => {
    expect(getBuiltinSkill("nonexistent/skill")).toBeUndefined();
  });

  // ── Validation helpers ──────────────────────────────────────────────

  it("validateSkillManifest returns valid for good input", () => {
    const result = validateSkillManifest({
      id: "test/valid",
      name: "Valid",
      description: "A valid skill",
      version: "1.0.0",
      author: { name: "Tester" },
      inputSchema: { type: "object" },
      outputContract: { kind: "full-project" },
    });
    expect(result.valid).toBe(true);
  });

  it("validateSkillManifest returns invalid with diagnostics", () => {
    const result = validateSkillManifest({
      id: "bad",
      name: "",
      description: "",
      version: "x",
      author: {},
      inputSchema: {},
      outputContract: { kind: "nope" },
    });
    expect(result.valid).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("validateMotionSkillOutput rejects V2 sceneOrder output", () => {
    const manifest: MotionSkillManifest = {
      id: "test/skill",
      name: "Test",
      description: "Test",
      version: "1.0.0",
      author: { name: "Tester" },
      instructionFormat: "text/markdown",
      requiredCapabilities: [],
      inputSchema: { type: "object" },
      outputContract: { kind: "full-project" },
      tags: [],
    };
    const projectWithSceneOrder: MotionProjectV3 = {
      format: "motion-project",
      formatVersion: 3,
      metadata: { id: "p1", name: "P", locale: "en-US" },
      composition: {
        width: 1080,
        height: 1920,
        fps: 30,
        background: "#fff",
        colorSpace: "srgb",
        audioSampleRate: 48000,
      },
      capabilities: { required: [] },
      dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
      tokens: {},
      variables: [],
      assets: [],
      components: [],
      scenes: [],
      timeline: {
        sceneOrder: [] as any,
        visualTracks: [],
        audioTracks: [],
        captionTracks: [],
      } as any,
      bindings: [],
      extensions: {},
    };
    const result = validateMotionSkillOutput(manifest, {
      kind: "full-project",
      project: projectWithSceneOrder,
    });
    expect(result.valid).toBe(false);
    expect(
      result.diagnostics.some((d) => d.message.includes("sceneOrder")),
    ).toBe(true);
  });

  it("validateMotionSkillOutput rejects scene.transition on scenes", () => {
    const manifest: MotionSkillManifest = {
      id: "test/skill",
      name: "Test",
      description: "Test",
      version: "1.0.0",
      author: { name: "Tester" },
      instructionFormat: "text/markdown",
      requiredCapabilities: [],
      inputSchema: { type: "object" },
      outputContract: { kind: "full-project" },
      tags: [],
    };
    const projectWithSceneTransition = {
      format: "motion-project",
      formatVersion: 3,
      metadata: { id: "p1", name: "P", locale: "en-US" },
      composition: {
        width: 1080,
        height: 1920,
        fps: 30,
        background: "#fff",
        colorSpace: "srgb",
        audioSampleRate: 48000,
      },
      capabilities: {},
      dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
      tokens: {},
      variables: [],
      assets: [],
      components: [],
      scenes: [
        {
          id: "s1",
          name: "Scene 1",
          duration: 5,
          nodes: [],
          transition: { type: "fade", duration: 0.5 },
        },
      ],
      timeline: {
        visualTracks: [],
        audioTracks: [],
        captionTracks: [],
      },
      bindings: [],
      extensions: {},
    } as any;
    const result = validateMotionSkillOutput(manifest, {
      kind: "full-project",
      project: projectWithSceneTransition,
    });
    expect(result.valid).toBe(false);
    expect(
      result.diagnostics.some((d) => d.message.includes("scene.transition")),
    ).toBe(true);
  });

  it("validateMotionSkillOutput rejects formatVersion: 2", () => {
    const manifest: MotionSkillManifest = {
      id: "test/skill",
      name: "Test",
      description: "Test",
      version: "1.0.0",
      author: { name: "Tester" },
      instructionFormat: "text/markdown",
      requiredCapabilities: [],
      inputSchema: { type: "object" },
      outputContract: { kind: "full-project" },
      tags: [],
    };
    const projectWithV2Format = {
      format: "motion-project",
      formatVersion: 2,
      metadata: { id: "p1", name: "P", locale: "en-US" },
      composition: {
        width: 1080,
        height: 1920,
        fps: 30,
        background: "#fff",
        colorSpace: "srgb",
        audioSampleRate: 48000,
      },
      capabilities: {},
      dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
      tokens: {},
      variables: [],
      assets: [],
      components: [],
      scenes: [],
      timeline: {
        visualTracks: [],
        audioTracks: [],
        captionTracks: [],
      },
      bindings: [],
      extensions: {},
    } as any;
    const result = validateMotionSkillOutput(manifest, {
      kind: "full-project",
      project: projectWithV2Format,
    });
    expect(result.valid).toBe(false);
    expect(
      result.diagnostics.some((d) => d.message.includes("formatVersion")),
    ).toBe(true);
  });

  it("validateMotionSkillOutput rejects mismatched output kind", () => {
    const manifest: MotionSkillManifest = {
      id: "test/skill",
      name: "Test",
      description: "Test",
      version: "1.0.0",
      author: { name: "Tester" },
      instructionFormat: "text/markdown",
      requiredCapabilities: [],
      inputSchema: { type: "object" },
      outputContract: { kind: "patch" },
      tags: [],
    };
    const result = validateMotionSkillOutput(manifest, {
      kind: "full-project",
      project: {
        format: "motion-project",
        formatVersion: 3,
        metadata: { id: "p1", name: "P", locale: "en-US" },
        composition: {
          width: 1080,
          height: 1920,
          fps: 30,
          background: "#fff",
          colorSpace: "srgb",
          audioSampleRate: 48000,
        },
        capabilities: { required: [] },
        dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
        tokens: {},
        variables: [],
        assets: [],
        components: [],
        scenes: [],
        timeline: {
          visualTracks: [],
          audioTracks: [],
          captionTracks: [],
        },
        bindings: [],
        extensions: {},
      },
    });
    expect(result.valid).toBe(false);
    expect(
      result.diagnostics.some((d) => d.message.includes("does not match")),
    ).toBe(true);
  });

  it("validateMotionSkillOutput accepts valid project", () => {
    const manifest: MotionSkillManifest = {
      id: "test/skill",
      name: "Test",
      description: "Test",
      version: "1.0.0",
      author: { name: "Tester" },
      instructionFormat: "text/markdown",
      requiredCapabilities: [],
      inputSchema: { type: "object" },
      outputContract: { kind: "full-project" },
      tags: [],
    };
    const project: MotionProjectV3 = {
      format: "motion-project",
      formatVersion: 3,
      metadata: { id: "p1", name: "Valid Project", locale: "en-US" },
      composition: {
        width: 1080,
        height: 1920,
        fps: 30,
        background: "#ffffff",
        colorSpace: "srgb",
        audioSampleRate: 48000,
      },
      capabilities: { required: [] },
      dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
      tokens: {},
      variables: [],
      assets: [],
      components: [],
      scenes: [],
      timeline: {
        visualTracks: [],
        audioTracks: [],
        captionTracks: [],
      },
      bindings: [],
      extensions: {},
    };
    const result = validateMotionSkillOutput(manifest, {
      kind: "full-project",
      project,
    });
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("validateMotionSkillOutput rejects invalid project JSON", () => {
    const manifest: MotionSkillManifest = {
      id: "test/skill",
      name: "Test",
      description: "Test",
      version: "1.0.0",
      author: { name: "Tester" },
      instructionFormat: "text/markdown",
      requiredCapabilities: [],
      inputSchema: { type: "object" },
      outputContract: { kind: "full-project" },
      tags: [],
    };
    const result = validateMotionSkillOutput(manifest, {
      kind: "full-project",
      project: { not: "a project" } as any,
    });
    expect(result.valid).toBe(false);
  });

  it("validateMotionSkillOutput validates patch output", () => {
    const manifest: MotionSkillManifest = {
      id: "test/skill",
      name: "Test",
      description: "Test",
      version: "1.0.0",
      author: { name: "Tester" },
      instructionFormat: "text/markdown",
      requiredCapabilities: [],
      inputSchema: { type: "object" },
      outputContract: { kind: "patch" },
      tags: [],
    };
    const result = validateMotionSkillOutput(manifest, {
      kind: "patch",
      patch: {} as any,
    });
    expect(result.valid).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("validateMotionSkillOutput skips validation for template-params", () => {
    const manifest: MotionSkillManifest = {
      id: "test/skill",
      name: "Test",
      description: "Test",
      version: "1.0.0",
      author: { name: "Tester" },
      instructionFormat: "text/markdown",
      requiredCapabilities: [],
      inputSchema: { type: "object" },
      outputContract: { kind: "template-params" },
      tags: [],
    };
    const result = validateMotionSkillOutput(manifest, {
      kind: "template-params",
      params: { x: 1 },
    });
    expect(result.valid).toBe(true);
  });
});
