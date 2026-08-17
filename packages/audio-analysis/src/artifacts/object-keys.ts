/**
 * Deterministic R2 object-key strategy.
 *
 * Every production asset/artifact lives under a stable project namespace:
 *
 *   workspaces/{workspaceId}/projects/{projectId}/...
 *
 * This keeps analysis artifacts, generated waveforms, and render outputs
 * reproducible and permission-scoped to a single workspace/project.
 */

export type ProjectAssetType = "image" | "svg" | "video" | "audio" | "font";

/** Replace characters that are unsafe in object keys with `_`. */
export function sanitizeKeySegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** `workspaces/{workspaceId}/projects/{projectId}` */
export function projectRootKey(workspaceId: string, projectId: string): string {
  return `workspaces/${sanitizeKeySegment(workspaceId)}/projects/${sanitizeKeySegment(projectId)}`;
}

export type ProjectAssetKeyInput = {
  workspaceId: string;
  projectId: string;
  assetType: ProjectAssetType;
  assetId: string;
  ext: string;
};

/** `.../assets/{assetType}/{assetId}.{ext}` */
export function projectAssetObjectKey(input: ProjectAssetKeyInput): string {
  const ext = input.ext.replace(/^\./, "");
  return `${projectRootKey(input.workspaceId, input.projectId)}/assets/${input.assetType}/${sanitizeKeySegment(input.assetId)}.${ext}`;
}

export type AudioAnalysisKeyInput = {
  workspaceId: string;
  projectId: string;
  audioAssetId: string;
};

/** `.../analysis/audio/{audioAssetId}.audio-analysis.v1.json` */
export function audioAnalysisObjectKey(input: AudioAnalysisKeyInput): string {
  return `${projectRootKey(input.workspaceId, input.projectId)}/analysis/audio/${sanitizeKeySegment(input.audioAssetId)}.audio-analysis.v1.json`;
}

/** `.../generated/waveforms/{audioAssetId}.waveform.v1.json` */
export function waveformObjectKey(input: AudioAnalysisKeyInput): string {
  return `${projectRootKey(input.workspaceId, input.projectId)}/generated/waveforms/${sanitizeKeySegment(input.audioAssetId)}.waveform.v1.json`;
}

export type RenderArtifactKeyInput = {
  workspaceId: string;
  projectId: string;
  renderJobId: string;
  artifact: string;
};

/** `.../renders/jobs/{renderJobId}/{artifact}` */
export function renderArtifactObjectKey(input: RenderArtifactKeyInput): string {
  return `${projectRootKey(input.workspaceId, input.projectId)}/renders/jobs/${sanitizeKeySegment(input.renderJobId)}/${sanitizeKeySegment(input.artifact)}`;
}
