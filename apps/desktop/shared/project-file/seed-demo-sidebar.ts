/**
 * Dev / UI-fixture demo: sidebar catalog only (no timeline clips/lanes).
 * Adds fake audio assets so AudioPanel has drag tiles.
 */

import {
  buildBlankDesktopProject,
  serializeDesktopProjectEnvelope,
  type DesktopProjectEnvelope,
} from "./envelope";

type CreateId = (prefix: string) => string;

/** Fake audio assets for AudioPanel (project.assets only). */
export function demoAudioAssets(createId: CreateId = (p) => `${p}_demo`) {
  return [
    {
      id: createId("asset_bgm"),
      assetType: "audio" as const,
      uri: "demo://audio/bgm-bed.mp3",
      integrity: "sha256-demo-bgm",
      mimeType: "audio/mpeg" as const,
      duration: 8,
      codec: "mp3",
      sampleRate: 44100,
      channels: 2,
    },
    {
      id: createId("asset_sfx"),
      assetType: "audio" as const,
      uri: "demo://audio/sfx-hit.wav",
      integrity: "sha256-demo-sfx",
      mimeType: "audio/wav" as const,
      duration: 2.5,
      codec: "pcm",
      sampleRate: 44100,
      channels: 1,
    },
    {
      id: createId("asset_vo"),
      assetType: "audio" as const,
      uri: "demo://audio/voiceover.mp3",
      integrity: "sha256-demo-vo",
      mimeType: "audio/mpeg" as const,
      duration: 5,
      codec: "mp3",
      sampleRate: 44100,
      channels: 1,
    },
  ];
}

/**
 * Append demo audio assets onto the envelope. Does not touch timelineClips /
 * timelineLanes / scenes / audioTracks.
 */
export function seedDemoSidebarAssets(
  envelope: DesktopProjectEnvelope,
  createId: CreateId = (prefix) => `${prefix}_demo`,
): DesktopProjectEnvelope {
  const existing = Array.isArray(envelope.project.assets)
    ? envelope.project.assets
    : [];
  const demo = demoAudioAssets(createId);
  const existingIds = new Set(
    existing
      .map((row) =>
        typeof row === "object" && row != null && "id" in row
          ? String((row as { id: unknown }).id)
          : "",
      )
      .filter(Boolean),
  );
  const merged = [
    ...existing,
    ...demo.filter((asset) => !existingIds.has(asset.id)),
  ];

  return {
    ...envelope,
    project: {
      ...envelope.project,
      assets: merged,
    },
  };
}

export function buildDemoSidebarDocumentJson(input?: {
  name?: string;
  createId?: CreateId;
}): { envelope: DesktopProjectEnvelope; documentJson: string; projectId: string } {
  const createId =
    input?.createId ??
    ((prefix: string) =>
      `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`);

  const blank = buildBlankDesktopProject({
    name: input?.name ?? "Demo Sidebar",
    createId,
  });
  const envelope = seedDemoSidebarAssets(blank.envelope, createId);
  return {
    envelope,
    documentJson: serializeDesktopProjectEnvelope(envelope),
    projectId: blank.projectId,
  };
}
