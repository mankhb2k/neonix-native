/**
 * MotionWorkspaceReader — pluggable file I/O for workspace modules.
 *
 * Implementations:
 *  - MemoryReader: for tests (in-memory maps)
 *  - FilesystemReader: for CLI/local tooling (Node fs)
 *
 * Runtime/renderers NEVER import this interface.
 */
import type { MotionWorkspaceManifest } from "./schema";

/** A single module read from the workspace. */
export interface WorkspaceModule {
  /** Module name (without extension). */
  name: string;
  /** Module type. */
  module: "scene" | "component" | "variable" | "token" | "asset";
  /** Raw text content of the module file. */
  content: string;
}

/** Reader interface for loading workspace modules. */
export interface MotionWorkspaceReader {
  /** Read the workspace manifest (workspace.mt). */
  readManifest(): Promise<MotionWorkspaceManifest>;

  /** Read a specific module by name and type. */
  readModule(
    name: string,
    module: "scene" | "component" | "variable" | "token",
  ): Promise<WorkspaceModule>;

  /** List all modules of a given type. */
  listModules(
    module: "scene" | "component" | "variable" | "token",
  ): Promise<string[]>;

  /** Read a raw asset file as a Buffer. */
  readAsset(path: string): Promise<Buffer>;
}

// ── Built-in Readers ────────────────────────────────────────────────────

/**
 * In-memory reader for tests.
 */
export class MemoryWorkspaceReader implements MotionWorkspaceReader {
  private manifest: MotionWorkspaceManifest;
  private modules = new Map<string, WorkspaceModule>();
  private assets = new Map<string, Buffer>();

  constructor(manifest: MotionWorkspaceManifest) {
    this.manifest = manifest;
  }

  addModule(mod: WorkspaceModule): this {
    this.modules.set(`${mod.module}/${mod.name}`, mod);
    return this;
  }

  addAsset(path: string, data: Buffer | string): this {
    this.assets.set(
      path,
      typeof data === "string" ? Buffer.from(data, "utf-8") : data,
    );
    return this;
  }

  async readManifest(): Promise<MotionWorkspaceManifest> {
    return this.manifest;
  }

  async readModule(
    name: string,
    module: "scene" | "component" | "variable" | "token",
  ): Promise<WorkspaceModule> {
    const mod = this.modules.get(`${module}/${name}`);
    if (!mod) throw new Error(`Module not found: ${module}/${name}`);
    return mod;
  }

  async listModules(
    module: "scene" | "component" | "variable" | "token",
  ): Promise<string[]> {
    const prefix = `${module}/`;
    return Array.from(this.modules.keys())
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length));
  }

  async readAsset(path: string): Promise<Buffer> {
    const data = this.assets.get(path);
    if (!data) throw new Error(`Asset not found: ${path}`);
    return data;
  }
}
