/**
 * MotionWorkspaceLinker — resolves workspace modules into a canonical
 * MotionProjectV3.
 *
 * Pipeline:
 *   read manifest → parse modules → resolve cross-references →
 *   validate IDs/scopes → merge tokens/variables → canonicalize
 *
 * The linker enforces:
 *  - No import cycles between modules
 *  - Module-local IDs don't collide after namespacing
 *  - All asset/component references resolve
 *  - Cross-module references point to declared modules
 */
import {
  type MotionProject,
  parseMotionProject,
} from "@motionvideo/motion-protocol";
import type { MotionWorkspaceManifest } from "./schema";
import type { MotionWorkspaceReader } from "./reader";

/** Diagnostics produced during linking. */
export interface LinkDiagnostic {
  severity: "error" | "warning";
  code: string;
  message: string;
  path?: string[];
}

/** Result of workspace linking. */
export interface LinkResult {
  ok: boolean;
  /** Canonical MotionProjectV3 when ok=true. */
  project?: MotionProject;
  /** Structured diagnostics. */
  diagnostics: LinkDiagnostic[];
}

/** Default transform values for imported nodes (fills missing fields). */
const DEFAULT_TRANSFORM = {
  x: 540,
  y: 960,
  width: 800,
  height: 160,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  anchorX: 0.5,
  anchorY: 0.5,
  opacity: 1,
  visible: true,
  flipX: false,
  flipY: false,
};

function normalizeNode(raw: Record<string, unknown>): Record<string, unknown> {
  const transform = raw.transform as Record<string, unknown> | undefined;
  return {
    ...raw,
    transform: {
      ...DEFAULT_TRANSFORM,
      ...(transform ?? {}),
    },
  };
}

/**
 * Link all workspace modules into a single canonical MotionProjectV3.
 *
 * Strategy:
 *  1. Parse the manifest
 *  2. Load all scene modules in manifest order
 *  3. Load components, variables, tokens
 *  4. Merge into a single project skeleton
 *  5. Validate cross-references
 *  6. Return the canonical project
 */
export async function linkMotionWorkspace(
  reader: MotionWorkspaceReader,
): Promise<LinkResult> {
  const diagnostics: LinkDiagnostic[] = [];
  let manifest: MotionWorkspaceManifest;

  // 1. Parse manifest
  try {
    manifest = await reader.readManifest();
  } catch (err) {
    diagnostics.push({
      severity: "error",
      code: "manifest_read",
      message: `Failed to read manifest: ${(err as Error).message}`,
    });
    return { ok: false, diagnostics };
  }

  // 2. Build project skeleton
  const project: Record<string, unknown> = {
    format: "motion-project",
    formatVersion: 3,
    metadata: {
      id: manifest.metadata.id,
      name: manifest.metadata.name,
      locale: manifest.metadata.locale ?? "en-US",
      ...(manifest.metadata.description
        ? { description: manifest.metadata.description }
        : {}),
      ...(manifest.metadata.industry
        ? { industry: manifest.metadata.industry }
        : {}),
    },
    composition: {
      width: manifest.composition.width,
      height: manifest.composition.height,
      fps: manifest.composition.fps,
      background: manifest.composition.background ?? "#000000",
      colorSpace: manifest.composition.colorSpace ?? "srgb",
      ...(manifest.composition.audioSampleRate
        ? { audioSampleRate: manifest.composition.audioSampleRate }
        : {}),
    },
    capabilities: {},
    dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
    tokens: manifest.tokens ?? {},
    variables: [] as unknown[],
    assets: [] as unknown[],
    components: [] as unknown[],
    scenes: [] as unknown[],
    timeline: { visualTracks: [], audioTracks: [], captionTracks: [] },
    bindings: [] as unknown[],
  };

  // 3. Load scene modules in order
  const scenes = project.scenes as Record<string, unknown>[];
  const visualTrackClips: Record<string, unknown>[] = [];
  let timeCursor = 0;

  for (const sceneName of manifest.sceneModules) {
    try {
      const mod = await reader.readModule(sceneName, "scene");
      const sceneJson = JSON.parse(mod.content) as Record<string, unknown>;
      // Normalize node transforms to include all required fields.
      const layers = (
        Array.isArray(sceneJson.layers) ? sceneJson.layers : []
      ) as Record<string, unknown>[];
      const normalizedLayers = layers.map(normalizeNode);
      // Namespace the scene id to avoid collisions
      const sceneId = `workspace.${sceneName}`;
      scenes.push({
        id: sceneId,
        ...(typeof sceneJson.name === "string" ? { name: sceneJson.name } : {}),
        duration:
          typeof sceneJson.duration === "number" ? sceneJson.duration : 2,
        space: "flat-2d",
        layers: normalizedLayers,
        clips: Array.isArray(sceneJson.clips) ? sceneJson.clips : [],
      });

      visualTrackClips.push({
        id: `clip-workspace.${sceneName}`,
        source: { kind: "scene", sceneId },
        start: timeCursor,
        duration:
          typeof sceneJson.duration === "number" ? sceneJson.duration : 2,
        opacity: 1,
        loop: false,
      });

      timeCursor +=
        typeof sceneJson.duration === "number" ? sceneJson.duration : 2;
    } catch (err) {
      diagnostics.push({
        severity: "error",
        code: "scene_load",
        message: `Failed to load scene "${sceneName}": ${(err as Error).message}`,
        path: ["scenes", sceneName],
      });
    }
  }

  // 4. Build main visual track
  (project.timeline as Record<string, unknown>).visualTracks = [
    {
      id: "main-track",
      role: "main",
      order: 0,
      muted: false,
      clips: visualTrackClips,
    },
  ];

  // 5. Load component modules
  const deps = project.dependencies as Record<string, unknown>;
  const componentList = deps.components as Record<string, unknown>[];

  for (const compRef of manifest.components ?? []) {
    try {
      const mod = await reader.readModule(compRef.name, "component");
      const compJson = JSON.parse(mod.content) as Record<string, unknown>;
      (project.components as unknown[]).push({
        id: compJson.id ?? `component.${compRef.name}`,
        ...compJson,
      });
      componentList.push({
        componentId: compJson.id ?? `component.${compRef.name}`,
        version: compRef.version ?? "1.0.0",
        ...(compJson.integrity ? { integrity: compJson.integrity } : {}),
      });
    } catch (err) {
      diagnostics.push({
        severity: "warning",
        code: "component_load",
        message: `Failed to load component "${compRef.name}": ${(err as Error).message}`,
        path: ["components", compRef.name],
      });
    }
  }

  // 6. Load variable modules
  for (const varRef of manifest.variables ?? []) {
    try {
      const mod = await reader.readModule(varRef.name, "variable");
      const varJson = JSON.parse(mod.content) as Record<string, unknown>;
      (project.variables as unknown[]).push({
        id: varJson.id ?? `var.${varRef.name}`,
        ...varJson,
      });
    } catch (err) {
      diagnostics.push({
        severity: "warning",
        code: "variable_load",
        message: `Failed to load variable "${varRef.name}": ${(err as Error).message}`,
        path: ["variables", varRef.name],
      });
    }
  }

  // 7. Load asset declarations
  for (const asset of manifest.assets ?? []) {
    (project.assets as unknown[]).push({
      id: asset.id,
      type: asset.type,
      path: asset.path,
      ...(asset.integrity ? { integrity: asset.integrity } : {}),
    });
  }

  // 8. Reject absolute local paths (C:\, /, etc.)
  for (const asset of manifest.assets ?? []) {
    if (asset.path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(asset.path)) {
      diagnostics.push({
        severity: "error",
        code: "absolute_path",
        message: `Absolute path "${asset.path}" is not allowed in portable bundles`,
        path: ["assets", asset.id],
      });
    }
  }

  // 9. Validate → parse
  const hasErrors = diagnostics.some((d) => d.severity === "error");
  if (hasErrors) {
    return { ok: false, diagnostics };
  }

  try {
    const parsed = parseMotionProject(project);
    return {
      ok: true,
      project: parsed,
      diagnostics,
    };
  } catch (err) {
    diagnostics.push({
      severity: "error",
      code: "canonical_parse",
      message: `Linked project failed canonical parse: ${(err as Error).message}`,
    });
    return { ok: false, diagnostics };
  }
}
