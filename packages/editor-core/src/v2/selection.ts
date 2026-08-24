export type V2EditorSelection =
  | { kind: "none" }
  | { kind: "clips"; ids: string[]; primaryId: string }
  | { kind: "layer"; layerId: string };

const EMPTY_IDS: string[] = [];

export function v2SelectionNone(): V2EditorSelection {
  return { kind: "none" };
}

export function v2SelectionClips(
  ids: readonly string[],
  primaryId?: string,
): V2EditorSelection {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return v2SelectionNone();
  return {
    kind: "clips",
    ids: unique,
    primaryId:
      primaryId && unique.includes(primaryId)
        ? primaryId
        : unique[unique.length - 1]!,
  };
}

export function v2SelectedClipIds(selection: V2EditorSelection): string[] {
  return selection.kind === "clips" ? selection.ids : EMPTY_IDS;
}
