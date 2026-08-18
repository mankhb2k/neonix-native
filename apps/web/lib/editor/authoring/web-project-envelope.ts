/**
 * Web project envelope — authoring metadata lives beside MotionProject,
 * never inside the render snapshot path (web-architecture §6).
 */

export type ElementKey = `${string}:${string}:${string}`;

export type ElementAuthoringMeta = {
  semanticKey?: string;
  origin: "ai" | "user" | "template";
  locked?: boolean;
  lockedProperties?: string[];
  userModifiedProperties?: string[];
  lastEditedRevision: number;
};

export type WebProjectEnvelope = {
  id: string;
  revision: number;
  authoring: {
    elementMeta: Record<string, ElementAuthoringMeta>;
    generation?: {
      planId: string;
      seed: string;
      model: string;
      capabilityManifestVersion: string;
      criticScore?: number;
      warnings?: string[];
    };
  };
};

export function elementKey(
  clipId: string,
  sceneId: string,
  layerId: string,
): ElementKey {
  return `${clipId}:${sceneId}:${layerId}`;
}

export function nodeElementKey(sceneId: string, layerId: string): ElementKey {
  return `scene:${sceneId}:${layerId}`;
}

export function createEmptyEnvelope(projectId: string): WebProjectEnvelope {
  return {
    id: projectId,
    revision: 1,
    authoring: { elementMeta: {} },
  };
}

export function isPropertyLocked(
  envelope: WebProjectEnvelope | null | undefined,
  sceneId: string,
  layerId: string,
  propertyPath: string,
): boolean {
  if (!envelope) return false;
  const meta = envelope.authoring.elementMeta[nodeElementKey(sceneId, layerId)];
  if (!meta) return false;
  if (meta.locked) return true;
  return meta.lockedProperties?.includes(propertyPath) ?? false;
}

export function markUserModified(
  envelope: WebProjectEnvelope,
  sceneId: string,
  layerId: string,
  propertyPaths: string[],
): WebProjectEnvelope {
  const key = nodeElementKey(sceneId, layerId);
  const prev = envelope.authoring.elementMeta[key];
  const merged = new Set([
    ...(prev?.userModifiedProperties ?? []),
    ...propertyPaths,
  ]);
  return {
    ...envelope,
    revision: envelope.revision + 1,
    authoring: {
      ...envelope.authoring,
      elementMeta: {
        ...envelope.authoring.elementMeta,
        [key]: {
          origin: prev?.origin ?? "user",
          locked: prev?.locked,
          lockedProperties: prev?.lockedProperties,
          semanticKey: prev?.semanticKey,
          userModifiedProperties: [...merged],
          lastEditedRevision: envelope.revision + 1,
        },
      },
    },
  };
}

export function isElementLocked(
  envelope: WebProjectEnvelope | null | undefined,
  sceneId: string,
  layerId: string,
): boolean {
  if (!envelope) return false;
  const meta = envelope.authoring.elementMeta[nodeElementKey(sceneId, layerId)];
  return Boolean(meta?.locked);
}

export function toggleElementLock(
  envelope: WebProjectEnvelope,
  sceneId: string,
  layerId: string,
  locked: boolean,
): WebProjectEnvelope {
  const key = nodeElementKey(sceneId, layerId);
  const prev = envelope.authoring.elementMeta[key];
  return {
    ...envelope,
    revision: envelope.revision + 1,
    authoring: {
      ...envelope.authoring,
      elementMeta: {
        ...envelope.authoring.elementMeta,
        [key]: {
          origin: prev?.origin ?? "user",
          locked,
          lockedProperties: prev?.lockedProperties,
          semanticKey: prev?.semanticKey,
          userModifiedProperties: prev?.userModifiedProperties,
          lastEditedRevision: envelope.revision + 1,
        },
      },
    },
  };
}

export function togglePropertyLock(
  envelope: WebProjectEnvelope,
  sceneId: string,
  layerId: string,
  propertyPath: string,
  locked: boolean,
): WebProjectEnvelope {
  const key = nodeElementKey(sceneId, layerId);
  const prev = envelope.authoring.elementMeta[key];
  const set = new Set(prev?.lockedProperties ?? []);
  if (locked) set.add(propertyPath);
  else set.delete(propertyPath);
  return {
    ...envelope,
    revision: envelope.revision + 1,
    authoring: {
      ...envelope.authoring,
      elementMeta: {
        ...envelope.authoring.elementMeta,
        [key]: {
          origin: prev?.origin ?? "user",
          locked: prev?.locked,
          lockedProperties: [...set],
          semanticKey: prev?.semanticKey,
          userModifiedProperties: prev?.userModifiedProperties,
          lastEditedRevision: envelope.revision + 1,
        },
      },
    },
  };
}
