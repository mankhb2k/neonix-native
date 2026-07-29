/**
 * Selection union — nguồn sự thật duy nhất; các field cũ derive qua selector (STATE-02).
 */
export type EditorSelection =
  | { kind: "none" }
  | { kind: "clips"; ids: string[]; primaryId: string }
  | { kind: "node"; sceneId: string; nodeId: string };

export function selectionNone(): EditorSelection {
  return { kind: "none" };
}

export function selectionClips(ids: string[], primaryId?: string): EditorSelection {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return selectionNone();
  const primary = primaryId && unique.includes(primaryId) ? primaryId : unique[unique.length - 1];
  return { kind: "clips", ids: unique, primaryId: primary };
}

export function selectionNode(sceneId: string, nodeId: string): EditorSelection {
  return { kind: "node", sceneId, nodeId };
}

export function selectedClipIdFrom(selection: EditorSelection): string | null {
  return selection.kind === "clips" ? selection.primaryId : null;
}

export function selectedClipIdsFrom(selection: EditorSelection): string[] {
  return selection.kind === "clips" ? selection.ids : [];
}

export function selectedSceneIdFrom(selection: EditorSelection): string | null {
  if (selection.kind === "node") return selection.sceneId;
  return null;
}

export function selectedNodeIdFrom(selection: EditorSelection): string | null {
  return selection.kind === "node" ? selection.nodeId : null;
}
