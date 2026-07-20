import type { CompiledProject } from "../compiler";

/** Placeholder for Motion Canvas / headless Chromium render */
export async function renderCompiledProject(
  compiled: CompiledProject,
): Promise<{ projectId: string; ok: true }> {
  return { projectId: compiled.projectId, ok: true };
}
